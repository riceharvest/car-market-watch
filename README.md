# Car Market Watch

Private dashboard for tracking second-hand car listings in the Netherlands and surrounding countries, then scoring valuation signals like market median, price drops, days-on-market, and undervalued comparable listings.

## Current state

- Vite + React + TypeScript static dashboard scaffold.
- Typed listing model and sample listings.
- Valuation helpers for comparable-set median, price delta, days watched, and deal score.
- Rental revenue estimates are planned as an upside/risk signal: estimate achievable daily rental rates and utilization from compliant marketplace/provider inputs, then show gross/net monthly scenarios alongside resale valuation.
- Source strategy docs for Gaspedaal, AutoScout24, Marktplaats, 2dehands, Kleinanzeigen, mobile.de, RDW enrichment, and rental-rate benchmarks.
- Manual smoke script for checking whether target source pages are reachable and still expose price/spec hints.
- Vercel deployment config and GitHub Actions CI.

## Architecture

```text
Vercel static app
  └─ Vite/React dashboard built to dist/

Manual/worker-side operations
  ├─ scrape smoke checks: pnpm scrape:smoke (manual only)
  ├─ live allowlisted ingestion: pnpm ingest:live
  ├─ manual fixture ingestion: pnpm exec tsx scripts/run-ingestion.ts [--write]
  └─ future scheduled ingestion worker -> database/API -> dashboard
```

The current app is a static frontend. It should be deployed on Vercel as a Vite app. Live crawling and scheduled ingestion should run outside the Vercel static build path so deploys do not hammer third-party marketplaces. `pnpm build` uses `artifacts/ingestion/latest-live-ingestion.json` when present; otherwise it falls back to local sample fixtures.

## Run locally

```bash
pnpm install
pnpm dev
```

The local dev server binds to `0.0.0.0` and is usually available at `http://localhost:5173`.

## Verify locally

```bash
pnpm typecheck
pnpm build
```

Run source reachability checks manually only when needed:

```bash
pnpm scrape:smoke
```

Preview the manual-only ingestion skeleton against local sample data:

```bash
pnpm exec tsx scripts/run-ingestion.ts
pnpm exec tsx scripts/run-ingestion.ts --search=search-vw-golf-15-tsi-benelux --write
```

`--write` creates `artifacts/ingestion/manual-fixture-snapshot.json` for local review. The runner has an explicit allowlist and performs no live external requests.

Capture the current allowlisted live marketplace data manually:

```bash
pnpm ingest:live
pnpm build
```

The live runner currently uses public search-page payloads from AutoScout24, Marktplaats, and 2dehands. Gaspedaal is reachable but not normalized yet, Kleinanzeigen returned 403 from this environment, and mobile.de stays official-API-only.

## Deploy on Vercel

This repo includes `vercel.json` for a static Vite deployment:

- Framework preset: `Vite`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Output directory: `dist`
- Node.js: `20.x`

See the full operational checklist in [`docs/go-live-runbook.md`](docs/go-live-runbook.md). Storage and snapshot evolution is documented in [`docs/storage-strategy.md`](docs/storage-strategy.md).

## BPM manual override workflow

For non-NL import candidates, treat BPM as a purchase blocker until a manual or vetted calculator result is recorded. Add `bpmOverrideEur` to the listing data (or future admin form), keep the calculator/date/assumptions in notes, rebuild the snapshot, and verify the purchase decision no longer reports `needsManualBpm`. See [`docs/bpm-calculator-integration.md`](docs/bpm-calculator-integration.md) and [`docs/purchase-readiness-checklist.md`](docs/purchase-readiness-checklist.md).

## CI

GitHub Actions runs on pushes to `main` and pull requests:

1. Install dependencies with pnpm.
2. Run `typecheck` if present.
3. Run `test` if present.
4. Build the Vite app.

Live source smoke checks are separated into the manual **Scrape smoke** workflow. This keeps normal CI from repeatedly touching marketplace pages.

## Environment variables

Copy `.env.example` when local or deployed configuration is needed. The static app currently has no required production secrets.

Important conventions:

- `DATABASE_URL` is reserved for a future server/worker database connection and must not be exposed to browser code.
- `SCRAPER_USER_AGENT` should identify the crawler honestly and include contact information.
- Only `VITE_*` variables are exposed to the client bundle.

## Product direction

The end state is an auth-protected website where watched searches and listings are ingested daily, normalized, deduplicated, enriched, and shown with:

- price history
- comparable median and delta
- deal score
- days-on-market
- seller/dealer split
- country/source filters
- alerts for price drops and undervalued cars
- rental revenue estimates with source confidence, utilization assumptions, and gross/net caveats

Rental pricing caveats: rental estimates are directional only. P2P marketplace prices, fleet car-sharing rates, and commercial rental rates are not interchangeable; each source has different insurance, availability, mileage, location, fee, tax, and utilization assumptions. Do not present estimates as guaranteed owner income.

## Crawler/legal note

Before enabling scheduled ingestion, review each target site's robots.txt and Terms of Service, prefer official APIs where available, use conservative rate limits, and do not bypass bot protections, authentication, paywalls, or private endpoints. See [`docs/go-live-runbook.md`](docs/go-live-runbook.md#8-crawler-legality-robots-and-safety-notes).
