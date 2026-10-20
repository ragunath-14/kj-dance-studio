# Testing

Three layers. None of them touch your real data: every test creates a **brand-new throwaway database on your own
computer** and deletes it afterwards, WhatsApp is switched off, and the tests refuse to run against anything that is
not a local MongoDB.

| Command (from the project root) | What it runs | Needs |
|---|---|---|
| `npm run test:unit` | Fee, offer, referral-reward, search and WhatsApp-message logic (fixed dates, no database) | Node 22 |
| `npm run test:api`  | The real server + database: payments, paid/unpaid, Clear All, students & filters, registration, offers, referrals, the daily reminder job | local MongoDB |
| `npm run test:e2e`  | Playwright drives the real website and admin panel in Chrome (desktop + phone) | local MongoDB, Google Chrome |
| `npm test`          | unit + api | local MongoDB |
| `npm run test:all`  | everything | local MongoDB, Chrome |

## First-time setup

```
npm run install:all
```

MongoDB must be running locally (default `mongodb://127.0.0.1:27017`). To use another local address set
`TEST_MONGO_URL=mongodb://localhost:27018`.

## How the end-to-end tests run

`npm run test:e2e` starts its **own** backend (port 5101) and its **own** copy of the site (port 5174), so it can run
while your normal dev servers (5001 / 5173) are up. A report is written to `e2e/playwright-report` — open it with
`npm --prefix e2e run report`. If Chrome is not installed run `E2E_BROWSER=chromium npx playwright install chromium`
once and then use `E2E_BROWSER=chromium npm run test:e2e`.

Useful extras (from the `e2e` folder): `npx playwright test admin-payments.spec.js` (one file),
`npm run test:headed` (watch the browser), `npm run test:ui` (Playwright's interactive runner).

## Where things are

- `backend/__tests__/unit/`  — pure logic tests (`node --test`)
- `backend/__tests__/api/`   — tests against the real server and a temporary database
- `backend/__tests__/helpers/` — server launcher + API client + data builders
- `e2e/tests/`               — Playwright specs; `e2e/support/` — launcher, seed helpers
