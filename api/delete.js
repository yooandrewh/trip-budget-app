// POST /api/delete -> remove one transaction row.
// Body: { loggedAt } — the row is located by its "Logged At" timestamp (unique
// per entry, and immune to row numbers shifting under concurrent edits).
import { ensureSetup, getRows, deleteRow } from './_sheets.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const { loggedAt } = req.body || {};
    if (!loggedAt) return res.status(400).json({ error: 'Missing loggedAt' });
    await ensureSetup();
    const { rows } = await getRows('Transactions');
    const matches = rows.filter((r) => r['Logged At'] === loggedAt);
    if (matches.length !== 1) {
      return res.status(matches.length ? 409 : 404).json({ error: matches.length ? 'Ambiguous match' : 'Not found — refresh and retry' });
    }
    await deleteRow('Transactions', matches[0]._row);
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
