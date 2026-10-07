# FinFlow

A mobile-first personal finance tracker — client-side only, installable as a home-screen app (PWA). No backend, no account, no server: everything lives on your device.

**Live demo:** https://prapachaiuea.github.io/My-finance-app/

![FinFlow screenshot](screenshot.jpg)

## Features

- **Dashboard** — total balance across accounts, monthly income/expense, budget bar, backup reminder
- **Slip scanning (on-device)** — pick one or many bank-transfer slips; amount, date, time, payee, note and transaction number are read in your browser. Every field stays editable and anything the reader is unsure about is highlighted. See [How slip scanning works](#how-slip-scanning-works)
- **Learns from you** — payees, descriptions and categories you correct are remembered, so the same slip is hands-free next time; duplicate slips are detected; transfers between your own accounts are recognised
- **Transactions** — income, expense and **transfer** (between accounts); search across all months, day / amount / type filters, swipe-to-delete with **undo**
- **Accounts / wallets** — cash, bank, cards with opening balances (single account works exactly like before)
- **Budgets** — monthly limit plus per-category limits, alerts at 80 % / 100 %
- **Analytics & report** — category donut, 6-month trends, balance trend, heat-map, monthly / yearly summary you can print or save as PDF
- **Recurring transactions** — back-fills missed months, never adds the same month twice (even if you delete one), day 29–31 handled
- **Savings goals** — add, withdraw, edit
- **Safety** — hashed PIN with lock-out and auto-lock, backup / restore (JSON, v1 files still load), CSV export, automatic snapshot so "clear all" and "restore" can be undone, storage-persistence request
- **Thai / English**, light / dark, works offline after the first visit

## How slip scanning works

1. The image is normalised and turned into clean black-on-white text with an adaptive threshold (bank slips have gradient backgrounds and light-grey text that defeat a plain OCR run).
2. Text rows are found geometrically and classified by position (sender, receiver, amount, fee, references, note box) — not by fixed percentages — so 2-line merchant names and different slip heights work.
3. Each field is read several independent ways ([Tesseract.js](https://github.com/naptha/tesseract.js), Thai + English + a digits-only engine) and the reads are cross-checked.
4. The slip's **verification QR** is decoded; it contains the exact transaction reference, which also encodes the date, so a misread day is corrected and duplicate slips are caught.
5. Anything the reads disagree on is flagged instead of silently saved.

Measured on 20 real KBank Make slips (desktop Chrome):

| Field | Correct |
|---|---|
| Amount | 20 / 20 |
| Date (verified with the QR reference) | 20 / 20 |
| Time | 20 / 20 |
| Slip type (transfer / payment / top-up) | 20 / 20 |
| Receiving-account digits | 20 / 20 |
| Notes typed in the slip | 18 / 20 — the other 2 are flagged for review |
| Payee name, first time seen | 11 / 20 exact, 20 / 20 within a character or two — flagged "new payee, please check"; exact from the second time on |

Free-text names and notes cannot be guaranteed 100 % by any OCR; that is why they are editable, highlighted when uncertain and learned after you confirm them. Other banks use the generic row reader and are flagged "unfamiliar layout" — send sample slips to improve them.

Everything runs locally. The first scan downloads the OCR engine and Thai language data (≈ 8 MB) and caches it; images are never uploaded.

## Install on your phone

Open the live demo and use *Add to Home Screen* (iOS: Share → Add to Home Screen; Android: menu → Install app). Installed apps keep their data safer and work offline. Use **Settings → Backup** regularly.

## Project layout

```
index.html            app shell (markup only)
css/                  app.css (design) · extra.css (v4 additions)
js/util.js            dates (local, never UTC), money, escaping
js/store.js           storage, migration, backup/restore, snapshots, slip images (IndexedDB)
js/calc.js            balances, budgets, recurring, duplicates (pure, unit-tested)
js/imgproc.js         adaptive threshold, row segmentation, note-box finder (pure)
js/slip.js            interpretation of OCR reads: date/amount/QR/names/notes (pure, unit-tested)
js/ocr.js             Tesseract + QR pipeline
js/learn.js           payee / category learning
js/ui.js, pages-*.js  UI
sw.js, manifest.webmanifest   offline + install
tests/run.js          unit tests
```

## Development

No build step. Serve the folder with any static server and open it:

```bash
python -m http.server 8000      # or: npm start
node tests/run.js               # unit tests (no dependencies)
```

## Deployment

Static hosting via GitHub Pages, served directly from `main`.
