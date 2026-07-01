# Taiwan Trip Budget

iPhone-optimized budget tracker for the Taiwan trip. Static `index.html` +
Vercel serverless functions in `api/`, backed by a Google Sheet (same
service-account pattern as the Kairos data-entry app).

## Tabs

- **Add** — log a transaction: owner (Andrew/Keren), payment (cash/credit/transfer),
  amount, currency (NT/USD), type, date, notes.
- **Transactions** — every transaction newest-first with per-currency and
  per-person totals.
- **Analysis** — spent vs. budget per category, plus trip pacing: the grey tick
  on each bar marks where spending "should" be today if spread evenly across
  the trip.

## Google Sheet

Spreadsheet: `Taiwan Trip Budget` (owned by aandrewyoo@gmail.com), shared with
the service account `kairos-sheets@premium-griffin-500920-s0.iam.gserviceaccount.com`
as **Editor**.

- `Transactions` tab — one row per transaction (append-only from the app).
- `Budget` tab — editable settings: `Trip Start`, `Trip End`, `NT per USD`,
  and one `Budget: <Category>` row per category (amounts in USD). Add a row to
  add a category; the app picks it up on next sync.

Both tabs are auto-created with defaults on the first API call (`ensureSetup`).

## Vercel env vars

- `SHEET_ID` — the spreadsheet id from its URL
- `GOOGLE_SA_JSON` — the service-account key JSON, base64-encoded

## Local dev

`vercel dev` (or `node scripts/dev-server.mjs` for a stubbed, offline version).
