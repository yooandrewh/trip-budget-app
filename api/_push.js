// Zero-dependency Web Push sender (RFC 8291 aes128gcm encryption + RFC 8292
// VAPID auth) using only node:crypto — no web-push package, no build step.
//
// Required env vars:
//   VAPID_PUBLIC_KEY   - base64url of the 65-byte uncompressed P-256 public key
//   VAPID_PRIVATE_KEY  - base64url of the private scalar d (JWK "d" field)
//   VAPID_SUBJECT      - mailto: contact (optional)

import crypto from 'node:crypto';

const b64u = (b) => Buffer.from(b).toString('base64url');
const fromB64u = (s) => Buffer.from(s, 'base64url');

function vapidJwt(audience) {
  const pubBuf = fromB64u(process.env.VAPID_PUBLIC_KEY);
  const key = crypto.createPrivateKey({
    format: 'jwk',
    key: {
      kty: 'EC', crv: 'P-256',
      d: process.env.VAPID_PRIVATE_KEY,
      x: b64u(pubBuf.subarray(1, 33)),
      y: b64u(pubBuf.subarray(33, 65)),
    },
  });
  const header = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = b64u(JSON.stringify({
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: process.env.VAPID_SUBJECT || 'mailto:aandrewyoo@gmail.com',
  }));
  const sig = crypto.sign('sha256', Buffer.from(`${header}.${payload}`), { key, dsaEncoding: 'ieee-p1363' });
  return `${header}.${payload}.${b64u(sig)}`;
}

const hkdf = (salt, ikm, info, len) => Buffer.from(crypto.hkdfSync('sha256', ikm, salt, info, len));

// Send one push. sub = { endpoint, keys: { p256dh, auth } }. Returns HTTP status
// (201 = accepted; 404/410 = subscription is dead and should be dropped).
export async function sendPush(sub, payloadObj) {
  const uaPub = fromB64u(sub.keys.p256dh);
  const authSecret = fromB64u(sub.keys.auth);

  const ecdh = crypto.createECDH('prime256v1');
  const asPub = ecdh.generateKeys();
  const shared = ecdh.computeSecret(uaPub);

  const ikm = hkdf(authSecret, shared, Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub]), 32);
  const salt = crypto.randomBytes(16);
  const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0'), 12);

  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payloadObj)), Buffer.from([2])]);
  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ct = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);

  const rs = Buffer.alloc(4);
  rs.writeUInt32BE(4096);
  const body = Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);

  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'TTL': '86400',
      'Urgency': 'normal',
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      'Authorization': `vapid t=${vapidJwt(new URL(sub.endpoint).origin)}, k=${process.env.VAPID_PUBLIC_KEY}`,
    },
    body,
  });
  return r.status;
}
