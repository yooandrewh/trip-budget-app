// POST /api/update -> edit one transaction row in place.
// Body: { loggedAt, fields: { Date?, Time?, Owner?, Payment?, Amount?, Currency?, Type?, Tag?, To?, Received?, Notes? } }
// The row is located by its "Logged At" timestamp (unique per entry).
import { ensureSetup, getRows, updateCell } from './_sheets.js';

const OWNERS = ['Andrew', 'Keren'];
const PAYMENTS = ['Cash', 'Credit', 'Transfer'];
const CURRENCIES = ['NT', 'USD'];
const ALLOWED = ['Date', 'Time', 'Owner', 'Payment', 'Amount', 'Currency', 'Type', 'Tag', 'To', 'Received', 'Notes'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { loggedAt, fields } = req.body || {};
    if (!loggedAt || !fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'Missing loggedAt / fields' });
    }
    // Field-level validation mirrors /api/transactions.
    if ('Owner' in fields && !OWNERS.includes(fields.Owner)) return res.status(400).json({ error: 'Bad owner' });
    if ('Payment' in fields && !PAYMENTS.includes(fields.Payment)) return res.status(400).json({ error: 'Bad payment' });
    if ('Currency' in fields && !CURRENCIES.includes(fields.Currency)) return res.status(400).json({ error: 'Bad currency' });
    if ('Amount' in fields && !(isFinite(Number(fields.Amount)) && Number(fields.Amount) >= 0)) return res.status(400).json({ error: 'Bad amount' });
    if ('Date' in fields && !/^\d{4}-\d{2}-\d{2}$/.test(fields.Date)) return res.status(400).json({ error: 'Bad date' });
    if ('Time' in fields && fields.Time !== '' && !/^\d{2}:\d{2}$/.test(fields.Time)) return res.status(400).json({ error: 'Bad time' });

    await ensureSetup();
    const { header, rows } = await getRows('Transactions');
    const matches = rows.filter((r) => r['Logged At'] === loggedAt);
    if (matches.length !== 1) {
      return res.status(matches.length ? 409 : 404).json({ error: matches.length ? 'Ambiguous match' : 'Not found — refresh and retry' });
    }
    for (const [k, v] of Object.entries(fields)) {
      if (!ALLOWED.includes(k)) continue;
      await updateCell('Transactions', header, matches[0]._row, k, k === 'Amount' || k === 'Received' ? (v === '' ? '' : Number(v)) : String(v).slice(0, 500));
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
