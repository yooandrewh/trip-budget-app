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

    const items = [], startUsd = {};
    for (const row of budget.rows) {
      const k = row['Setting'];
      if (k && String(k).startsWith('Budget: ')) items.push({ name: String(k).slice(8), usd: Number(row['Value']) || 0 });
      if (k && String(k).startsWith('Start USD: ')) startUsd[String(k).slice(11)] = Number(row['Value']) || 0;
    }

    res.status(200).json({
      transactions: tx.rows,
      budget: {
        tripStart: settings['Trip Start'] || '',
        tripEnd: settings['Trip End'] || '',
        ntPerUsd: Number(settings['NT per USD']) || 30,
        foodNtPerDay: Number(settings['Food NT per person per day']) || 200,
        tmfStart: settings['TMF Start'] || '',
        tmfEnd: settings['TMF End'] || '',
        vbsStart: settings['VBS Start'] || '',
        vbsEnd: settings['VBS End'] || '',
        startUsd,
        items,
      },
      vapidPublicKey: process.env.VAPID_PUBLIC_KEY || '',
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
}
