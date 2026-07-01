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
  tripStart: '2026-06-28',
  tripEnd: '2026-07-12',
  ntPerUsd: 30,
  categories: { Food: 800, Transport: 400, Lodging: 1500, Shopping: 500, Activities: 400, Gifts: 200, Other: 200 },
};
const transactions = [
  { Date: '2026-06-28', Owner: 'Andrew', Payment: 'Credit', Amount: 5200, Currency: 'NT', Type: 'Lodging', Notes: 'Taipei hotel night 1', 'Logged At': '2026-06-28T10:00:00Z' },
  { Date: '2026-06-29', Owner: 'Keren', Payment: 'Cash', Amount: 350, Currency: 'NT', Type: 'Food', Notes: 'Din Tai Fung', 'Logged At': '2026-06-29T03:10:00Z' },
  { Date: '2026-06-29', Owner: 'Andrew', Payment: 'Cash', Amount: 120, Currency: 'NT', Type: 'Transport', Notes: 'MRT cards', 'Logged At': '2026-06-29T05:00:00Z' },
  { Date: '2026-07-01', Owner: 'Keren', Payment: 'Credit', Amount: 64, Currency: 'USD', Type: 'Shopping', Notes: '', 'Logged At': '2026-07-01T12:00:00Z' },
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
