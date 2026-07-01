// Shared Google Sheets client for the serverless functions.
// Zero-dependency: signs a service-account JWT with Node's built-in crypto and
// talks to the Sheets REST API directly (no googleapis package, no build step).
//
// Files starting with "_" are NOT exposed as Vercel routes, so this is import-only.
//
// Required env vars (set in Vercel project settings):
//   GOOGLE_SA_JSON  - the service-account key JSON, BASE64-encoded
//   SHEET_ID        - the spreadsheet id (from its URL: /d/<SHEET_ID>/edit)

import crypto from 'node:crypto';

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

function b64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

let _creds;
function credentials() {
  if (_creds) return _creds;
  const raw = process.env.GOOGLE_SA_JSON;
  if (!raw) throw new Error('Server is missing GOOGLE_SA_JSON');
  const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
  if (!json.client_email || !json.private_key) {
    throw new Error('GOOGLE_SA_JSON is missing client_email / private_key');
  }
  _creds = json;
  return json;
}

export function sheetId() {
  const id = process.env.SHEET_ID;
  if (!id) throw new Error('Server is missing SHEET_ID');
  return id;
}

let _token = null, _tokenExp = 0;
async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExp - 60) return _token;

  const { client_email, private_key } = credentials();
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: client_email,
    scope: SCOPE,
    aud: TOKEN_URI,
    iat: now,
    exp: now + 3600,
  }));
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claim}`);
  const sig = b64url(signer.sign(private_key));
  const assertion = `${header}.${claim}.${sig}`;

  const r = await fetch(TOKEN_URI, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error('Google token error: ' + JSON.stringify(data));
  _token = data.access_token;
  _tokenExp = now + (data.expires_in || 3600);
  return _token;
}

async function api(path, opts = {}) {
  const token = await getAccessToken();
  const r = await fetch(`${API}/${sheetId()}${path}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Sheets API error: ' + JSON.stringify(data));
  return data;
}

const RENDER = 'valueRenderOption=UNFORMATTED_VALUE';

// Read a whole tab. Returns { header: [...], rows: [{...cells, _row}] }.
export async function getRows(tab) {
  const data = await api(`/values/${encodeURIComponent(tab)}?${RENDER}`);
  const values = data.values || [];
  const header = values[0] || [];
  const rows = [];
  for (let i = 1; i < values.length; i++) {
    const arr = values[i];
    const obj = { _row: i + 1 };
    header.forEach((h, c) => { obj[h] = arr[c] !== undefined ? arr[c] : ''; });
    rows.push(obj);
  }
  return { header, rows };
}

async function getHeader(tab) {
  const data = await api(`/values/${encodeURIComponent(tab)}!1:1?${RENDER}`);
  return (data.values && data.values[0]) || [];
}

// Append one row built from an object, ordered to match the tab's header.
export async function appendRow(tab, obj) {
  const header = await getHeader(tab);
  const row = header.map((h) => (obj[h] !== undefined && obj[h] !== null ? obj[h] : ''));
  await api(
    `/values/${encodeURIComponent(tab)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: [row] }) },
  );
  return row;
}

// 1-based column index -> A1 letter(s).
export function colLetter(n) {
  let s = '';
  while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; }
  return s;
}

// Set a single cell by header name on a given sheet row number.
export async function updateCell(tab, header, rowNumber, colName, value) {
  const idx = header.indexOf(colName);
  if (idx < 0) throw new Error(`Column "${colName}" not found in ${tab}`);
  const a1 = `${colLetter(idx + 1)}${rowNumber}`;
  await api(
    `/values/${encodeURIComponent(tab)}!${a1}?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [[value]] }) },
  );
}

// ---- One-time sheet bootstrap -------------------------------------------
// The spreadsheet starts as a blank sheet owned by Andrew. On the first API
// call we create the Transactions + Budget tabs with headers and seed the
// Budget tab with editable defaults. Safe to call every time: it only adds
// what is missing.

export const TX_HEADER = ['Date', 'Owner', 'Payment', 'Amount', 'Currency', 'Type', 'Tag', 'To', 'Received', 'Notes', 'Logged At'];

export const BUDGET_DEFAULTS = [
  ['Setting', 'Value'],
  ['Trip Start', '2026-07-01'],
  ['Trip End', '2026-07-14'],
  ['NT per USD', 30],
  ['Start USD: Andrew', 6300],
  ['Start USD: Keren', 6300],
  ['Budget: Food', 800],
  ['Budget: Transport', 400],
  ['Budget: Lodging', 1500],
  ['Budget: Shopping', 500],
  ['Budget: Activities', 400],
  ['Budget: Gifts', 200],
  ['Budget: Other', 200],
];

let _bootstrapped = false;
export async function ensureSetup() {
  if (_bootstrapped) return;
  const meta = await api('?fields=sheets.properties(title,sheetId)');
  const titles = (meta.sheets || []).map((s) => s.properties.title);

  const requests = [];
  if (!titles.includes('Transactions')) {
    requests.push({ addSheet: { properties: { title: 'Transactions', gridProperties: { frozenRowCount: 1 } } } });
  }
  if (!titles.includes('Budget')) {
    requests.push({ addSheet: { properties: { title: 'Budget', gridProperties: { frozenRowCount: 1 } } } });
  }
  if (!titles.includes('Subs')) {
    requests.push({ addSheet: { properties: { title: 'Subs', gridProperties: { frozenRowCount: 1 }, hidden: true } } });
  }
  if (requests.length) {
    await api(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
  }

  // Write headers / defaults only if the tabs are empty.
  const txHeader = await getHeader('Transactions');
  if (!txHeader.length) {
    await api(`/values/Transactions!A1?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values: [TX_HEADER] }),
    });
  }
  const budgetHeader = await getHeader('Budget');
  if (!budgetHeader.length) {
    await api(`/values/Budget!A1?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values: BUDGET_DEFAULTS }),
    });
  }
  const subsHeader = await getHeader('Subs');
  if (!subsHeader.length) {
    await api(`/values/Subs!A1?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values: [['Endpoint', 'P256dh', 'Auth', 'Owner', 'Added At']] }),
    });
  }
  _bootstrapped = true;
}
