// GET /api/data -> { transactions: [...], budget: { tripStart, tripEnd, ntPerUsd, categories: {Food: 800, ...} } }
// Single round-trip for the app: powers both the Transactions and Analysis tabs.
import { ensureSetup, getRows } from './_sheets.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only' });
  try {
    await ensureSetup();
    const [tx, budget] = await Promise.all([getRows('Transactions'), getRows('Budget')]);

    const settings = {};
    for (const row of budget.rows) settings[row['Setting']] = row['Value'];

    const categories = {}, startUsd = {};
    for (const [k, v] of Object.entries(settings)) {
      if (k && k.startsWith('Budget: ')) categories[k.slice(8)] = Number(v) || 0;
      if (k && k.startsWith('Start USD: ')) startUsd[k.slice(11)] = Number(v) || 0;
    }

    res.status(200).json({
      transactions: tx.rows,
      budget: {
        tripStart: settings['Trip Start'] || '',
        tripEnd: settings['Trip End'] || '',
        ntPerUsd: Number(settings['NT per USD']) || 30,
        startUsd,
        categories,
      },
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
