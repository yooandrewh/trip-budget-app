// POST /api/transactions -> append one transaction row to the sheet.
// Body: { date, owner, payment, amount, currency, type, tag, to, received, notes }
//   type "Exchange"  = currency swap (USD -> TWD): amount in `currency`,
//                      `received` = NT$ received. Not counted as spending.
//   type "Transfer"  = cash handed between Andrew and Keren: `to` = receiver.
//                      Not counted as spending.
//   anything else    = an expense category; `tag` is the optional meal tag
//                      (Breakfast/Lunch/Dinner/Snack/Drinks) for Food.
import { ensureSetup, appendRow, getRows } from './_sheets.js';
import { sendPush } from './_push.js';

const OWNERS = ['Andrew', 'Keren'];
const PAYMENTS = ['Cash', 'Credit', 'Transfer'];
const CURRENCIES = ['NT', 'USD'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = req.body || {};
    const amount = Number(b.amount);
    // Reconcile may legitimately set a balance to 0; everything else must be > 0.
    if (!isFinite(amount) || amount < 0 || (amount === 0 && b.type !== 'Reconcile')) {
      return res.status(400).json({ error: 'Bad amount' });
    }
    if (!OWNERS.includes(b.owner)) return res.status(400).json({ error: 'Bad owner' });
    if (!PAYMENTS.includes(b.payment)) return res.status(400).json({ error: 'Bad payment' });
    if (!CURRENCIES.includes(b.currency)) return res.status(400).json({ error: 'Bad currency' });
    if (!b.type) return res.status(400).json({ error: 'Missing type' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Bad date' });
    if (b.type === 'Transfer' && !OWNERS.includes(b.to)) return res.status(400).json({ error: 'Transfer needs a receiver' });
    // Refund: `to` is a free-text name (who the money came back from).
    const received = Number(b.received);
    if (b.type === 'Exchange' && !(isFinite(received) && received > 0)) {
      return res.status(400).json({ error: 'Exchange needs the NT$ received' });
    }

    await ensureSetup();
    await appendRow('Transactions', {
      'Date': b.date,
      'Owner': b.owner,
      'Payment': b.payment,
      'Amount': amount,
      'Currency': b.currency,
      'Type': String(b.type).slice(0, 40),
      'Tag': String(b.tag || '').slice(0, 40),
      'To': b.type === 'Transfer' ? b.to : (b.type === 'Refund' ? String(b.to || '').slice(0, 40) : ''),
      'Received': b.type === 'Exchange' ? received : '',
      'Notes': String(b.notes || '').slice(0, 500),
      'Logged At': new Date().toISOString(),
      'Time': /^\d{2}:\d{2}$/.test(b.time || '') ? b.time : '',
    });

    // Ping the other person's phone(s). Best-effort: a push failure must never
    // fail the save itself.
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      try {
        const cur = b.currency === 'NT' ? 'NT$' : 'US$';
        const n = (x) => Number(x).toLocaleString('en-US');
        let text;
        if (b.type === 'Exchange') text = `${b.owner} exchanged ${cur}${n(amount)} → NT$${n(received)}`;
        else if (b.type === 'Transfer') text = `${b.owner} gave ${b.to} ${cur}${n(amount)}`;
        else if (b.type === 'Reconcile') text = `${b.owner} counted ${cur}${n(amount)} cash on hand`;
        else if (b.type === 'Refund') text = `${b.owner} got ${cur}${n(amount)} back${b.to ? ' from ' + b.to : ''}`;
        else text = `${b.owner} spent ${cur}${n(amount)}${b.notes ? ' · ' + b.notes : ''}`;
        const subs = (await getRows('Subs')).rows.filter((s) => s.Endpoint && s.Owner !== b.owner);
        await Promise.allSettled(subs.map((s) =>
          sendPush({ endpoint: s.Endpoint, keys: { p256dh: s.P256dh, auth: s.Auth } },
                   { title: 'Trip Budget 🇹🇼', body: text })));
      } catch { /* never block the save */ }
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
