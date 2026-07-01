// POST /api/subscribe -> store a Web Push subscription in the hidden Subs tab.
// Body: { subscription: { endpoint, keys: { p256dh, auth } }, owner: 'Andrew'|'Keren' }
// Upserts by endpoint so re-enabling on the same phone doesn't duplicate.
import { ensureSetup, getRows, appendRow, updateCell } from './_sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { subscription: s, owner } = req.body || {};
    if (!s?.endpoint || !s?.keys?.p256dh || !s?.keys?.auth) {
      return res.status(400).json({ error: 'Bad subscription' });
    }
    await ensureSetup();
    const { header, rows } = await getRows('Subs');
    const existing = rows.find((r) => r.Endpoint === s.endpoint);
    if (existing) {
      await updateCell('Subs', header, existing._row, 'P256dh', s.keys.p256dh);
      await updateCell('Subs', header, existing._row, 'Auth', s.keys.auth);
      if (owner) await updateCell('Subs', header, existing._row, 'Owner', owner);
    } else {
      await appendRow('Subs', {
        'Endpoint': s.endpoint, 'P256dh': s.keys.p256dh, 'Auth': s.keys.auth,
        'Owner': owner || '', 'Added At': new Date().toISOString(),
      });
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
