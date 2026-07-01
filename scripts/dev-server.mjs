// Offline dev server: serves index.html and stubs the two API routes with
// in-memory data, so the UI can be exercised without Google credentials.
// Run: node scripts/dev-server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = Number(process.argv[2]) || 3210;

const budget = {
  tripStart: '2026-07-01',
  tripEnd: '2026-07-14',
  ntPerUsd: 30,
  startUsd: { Andrew: 6300, Keren: 6300 },
  categories: { Food: 800, Transport: 400, Lodging: 1500, Shopping: 500, Activities: 400, Gifts: 200, Other: 200 },
};
// Real transactions so far (also seeded into the sheet by scripts/seed.mjs).
const transactions = [
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 2000, Currency: 'USD', Type: 'Exchange', Tag: '', To: '', Received: 60000, Notes: 'USD → TWD (EDIT: actual NT$ received)', 'Logged At': '2026-07-02T00:01:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 3000, Currency: 'NT', Type: 'Transfer', Tag: '', To: 'Keren', Received: '', Notes: '', 'Logged At': '2026-07-02T00:02:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Credit', Amount: 1040, Currency: 'NT', Type: 'Food', Tag: 'Breakfast', To: '', Received: '', Notes: 'Eggs for Thursday breakfast (Amex)', 'Logged At': '2026-07-02T00:03:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 720, Currency: 'NT', Type: 'Food', Tag: 'Lunch', To: '', Received: '', Notes: 'Baike two pek fried chicken filet', 'Logged At': '2026-07-02T00:04:00Z' },
  { Date: '2026-07-02', Owner: 'Keren', Payment: 'Cash', Amount: 600, Currency: 'NT', Type: 'Food', Tag: 'Lunch', To: '', Received: '', Notes: 'Bao', 'Logged At': '2026-07-02T00:05:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 160, Currency: 'NT', Type: 'Food', Tag: 'Snack', To: '', Received: '', Notes: 'Mandoo', 'Logged At': '2026-07-02T00:06:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 640, Currency: 'NT', Type: 'Food', Tag: 'Drinks', To: '', Received: '', Notes: 'Drinks', 'Logged At': '2026-07-02T00:07:00Z' },
  { Date: '2026-07-02', Owner: 'Andrew', Payment: 'Cash', Amount: 200, Currency: 'NT', Type: 'Food', Tag: 'Snack', To: '', Received: '', Notes: 'Fried sweet potato ball', 'Logged At': '2026-07-02T00:08:00Z' },
];

http.createServer((req, res) => {
  if (req.url.startsWith('/api/data')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ transactions, budget }));
  }
  if (req.url.startsWith('/api/transactions') && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => body += c);
    req.on('end', () => {
      const b = JSON.parse(body || '{}');
      transactions.push({ Date: b.date, Owner: b.owner, Payment: b.payment, Amount: b.amount, Currency: b.currency, Type: b.type, Notes: b.notes || '', 'Logged At': new Date().toISOString() });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.setHeader('Content-Type', 'text/html');
  res.end(fs.readFileSync(path.join(root, 'index.html')));
}).listen(port, () => console.log('dev server on http://localhost:' + port));
