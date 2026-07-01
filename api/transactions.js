// POST /api/transactions -> append one transaction row to the sheet.
// Body: { date, owner, payment, amount, currency, type, notes }
import { ensureSetup, appendRow } from './_sheets.js';

const OWNERS = ['Andrew', 'Keren'];
const PAYMENTS = ['Cash', 'Credit', 'Transfer'];
const CURRENCIES = ['NT', 'USD'];

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = req.body || {};
    const amount = Number(b.amount);
    if (!isFinite(amount) || amount === 0) return res.status(400).json({ error: 'Bad amount' });
    if (!OWNERS.includes(b.owner)) return res.status(400).json({ error: 'Bad owner' });
    if (!PAYMENTS.includes(b.payment)) return res.status(400).json({ error: 'Bad payment' });
    if (!CURRENCIES.includes(b.currency)) return res.status(400).json({ error: 'Bad currency' });
    if (!b.type) return res.status(400).json({ error: 'Missing type' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) return res.status(400).json({ error: 'Bad date' });

    await ensureSetup();
    await appendRow('Transactions', {
      'Date': b.date,
      'Owner': b.owner,
      'Payment': b.payment,
      'Amount': amount,
      'Currency': b.currency,
      'Type': String(b.type).slice(0, 40),
      'Notes': String(b.notes || '').slice(0, 500),
      'Logged At': new Date().toISOString(),
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
