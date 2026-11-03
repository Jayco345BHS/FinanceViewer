# FinanceViewer

A privacy-first personal finance dashboard for Scotiabank accounts. Upload credit card
statement PDFs (and CSV account exports) to track spending, spot trends, and cut down
on expenses — all without your data ever leaving your machine.

![Stack](https://img.shields.io/badge/React_19-Vite_7-blue) ![Tests](https://img.shields.io/badge/tests-vitest-green) ![License](https://img.shields.io/badge/license-MIT-yellow)

## Features

- **📥 Statement import** — drag & drop Scotiabank credit card eStatement PDFs.
  Transactions, statement summary (balances, credit limit, due date, minimum payment)
  and foreign-currency amounts are parsed locally in the browser. Import past months
  to build history; duplicates are detected and skipped automatically.
- **🏦 CSV import** — for chequing/debit account activity exports, with column-mapping
  auto-detection (date / description / amount or debit+credit columns).
- **📊 Dashboard** — monthly spend chart, category breakdown donut, spending-by-category
  over time, card balance trend, top merchants, and KPI cards (month spend,
  month-over-month change, average, largest purchase).
- **🧾 Transactions browser** — search, filter by category/account/month, and fix
  categories inline.
- **🏷️ Auto-categorization** — keyword rules (OC Transpo, Sobeys, Tim Hortons, …)
  with a built-in editor; re-apply rules anytime without losing manual edits.
- **💾 Local-first storage** — everything lives in your browser's IndexedDB.
  One-click JSON backup/restore.

## Quickstart

```bash
npm install
npm run dev
```

Open http://localhost:5173 and drop a statement PDF on the **Import** page.

### Production build

```bash
npm run build      # outputs static files to dist/
npm run preview    # serve the production build locally
```

The build is fully static (HashRouter, no server APIs), so `dist/` can be hosted
anywhere — GitHub Pages, a home server, or opened behind any static file server.

## Where to get your data

- **Credit card statements (PDF):** Scotiabank online banking → your card →
  Statements → download the PDF eStatement. Import as many past months as you like.
- **Debit/chequing activity (CSV):** Scotiabank online banking → your account →
  download transactions as CSV, then map the columns in the import wizard.

## Privacy

- Parsing (pdf.js) and storage (IndexedDB) happen **entirely in your browser**.
- No server, no analytics, no telemetry, no network calls.
- Keep real statements and backup files out of git — the `.gitignore` already
  excludes `data/`, `statements/`, and `*.backup.json`.

## Development

```bash
npm test           # vitest unit tests (parser, CSV, categorization, analytics)
npm run build      # typecheck (tsc) + production build
```

Validate the statement parser against a real PDF without uploading anything:

```bash
npx tsx scripts/parse-pdf.ts path/to/statement.pdf
```

The parser cross-checks its results against the statement's own subtotals and
reports warnings on mismatch.

### Project structure

```
src/
├── lib/
│   ├── pdf/
│   │   ├── extract.ts        # pdf.js text extraction → positioned lines
│   │   ├── scotiaCredit.ts   # Scotiabank credit card statement parser
│   │   └── workerSetup.ts    # browser-only pdf.js worker wiring
│   ├── csv.ts                # CSV import with column mapping
│   ├── categorize.ts         # keyword → category rules
│   ├── analytics.ts          # aggregations for charts/KPIs
│   ├── store.tsx             # IndexedDB persistence + React context
│   └── format.ts             # currency/date helpers
├── pages/                    # Dashboard, Import, Transactions, Settings
├── components/
└── test/                     # vitest suites (synthetic fixtures only)
```

### Conventions

- **Amounts:** positive = money spent (charge/debit), negative = money in
  (payment/credit/refund/deposit).
- **Categories `transfers` / `income`** are excluded from spending analytics.
- **Dedupe:** transactions are keyed by a stable hash of
  account + ref + dates + description + amount; identical re-imports are skipped.
  Statements are keyed by account + statement date.

## License

MIT
