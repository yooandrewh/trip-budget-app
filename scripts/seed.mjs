// One-time: seed the real Google Sheet with the transactions logged so far.
// Requires the sheet to be shared with the service account as Editor.
// Run: SHEET_ID=<id> node scripts/seed.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const KEY_PATH = path.join(os.homedir(), 'Downloads', 'premium-griffin-500920-s0-9b62a092a732.json');
const SHEET_ID = process.env.SHEET_ID || '1FrX9t5-gqlBfmfhfZeoN37UuF2UPHNQJlYD0zY-fXpA';

process.env.GOOGLE_SA_JSON = fs.readFileSync(KEY_PATH).toString('base64');
process.env.SHEET_ID = SHEET_ID;

const { ensureSetup, getRows, appendRow } = await import('../api/_sheets.js');

const ROWS = [
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 2000, Currency: 'USD', Type: 'Exchange', Received: 60000, Notes: 'USD → TWD (EDIT: actual NT$ received)' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 3000, Currency: 'NT', Type: 'Transfer', To: 'Keren', Notes: '' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Credit', Amount: 1040, Currency: 'NT', Type: 'Food', Tag: 'Breakfast', Notes: 'Eggs for Thursday breakfast (Amex)' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 720, Currency: 'NT', Type: 'Food', Tag: 'Lunch', Notes: 'Baike two pek fried chicken filet' },
  { Date: '2026-07-02', Owner: 'Keren', Payment: 'Cash', Amount: 600, Currency: 'NT', Type: 'Food', Tag: 'Lunch', Notes: 'Bao' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 160, Currency: 'NT', Type: 'Food', Tag: 'Snack', Notes: 'Mandoo' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 640, Currency: 'NT', Type: 'Food', Tag: 'Drinks', Notes: 'Drinks' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 200, Currency: 'NT', Type: 'Food', Tag: 'Snack', Notes: 'Fried sweet potato ball' },
];

await ensureSetup();
const existing = await getRows('Transactions');
if (existing.rows.length) {
  console.log(`Transactions tab already has ${existing.rows.length} rows — not seeding again.`);
  process.exit(0);
}
for (const row of ROWS) {
  await appendRow('Transactions', { ...row, 'Logged At': new Date().toISOString() });
  console.log('added:', row.Type, row.Amount, row.Currency, row.Notes || row.To || '');
}
console.log('Done — seeded ' + ROWS.length + ' rows.');
