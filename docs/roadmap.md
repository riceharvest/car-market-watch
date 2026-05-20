# Roadmap

## Phase 0: repo scaffold

- Static dashboard with typed sample data.
- Valuation helpers for comparable median, market delta, days-on-market, deal score.
- Smoke script to verify source pages remain reachable.

## Phase 1: ingestion MVP

- Add scraper adapters for AutoScout24, Gaspedaal, Marktplaats, 2dehands, Kleinanzeigen.
- Persist raw HTML snapshots outside git.
- Normalize listing data into a database table.
- Run daily scheduled crawls for a small allowlist of searches.

## Phase 1.5: rental-rate ingestion and estimation

- Add a rental source registry with source type, allowed paths, robots/ToS review date, ingestion method, and enabled/disabled state.
- Start with compliant benchmark snapshots: SnappCar allowed city/detail pages if still allowed, MyWheels/Greenwheels public rate pages, and commercial/partner API rates where available.
- Skip DIY crawling for Getaround and Turo in the MVP; use partner/API/provider data only if needed.
- Normalize rental observations by source, vehicle class/make/model, city, duration, included km, fees/insurance assumptions, observed price, freshness, and confidence.
- Build an estimator that converts observed daily/hourly benchmarks into configurable gross/net monthly scenarios using utilization, platform fee, insurance, tax, and maintenance assumptions.
- Keep rental-rate updates in a separate worker/snapshot job from resale crawlers so Vercel builds never trigger third-party rental crawling.

## Phase 2: product dashboard

- Search/watch configs by make, model, year range, km range, fuel, transmission, radius/country.
- Listing detail pages with price history chart, comparable set, and rental estimate panel.
- Alert rules: below target price, price drop, new undervalued comp, and rental-yield threshold.
- Source confidence and parser error reporting.
- Rental estimate caveats explaining P2P vs fleet/commercial benchmarks and utilization assumptions.

## Phase 3: enrichment

- RDW enrichment for Dutch plates when visible.
- Dealer reputation/repost detection.
- Duplicate matching across marketplaces.
- Optional mobile.de API integration if credentials are acquired.

## Phase 4: deployment

- React Router/Hono/Drizzle/Neon app if the static Vite prototype graduates into the default production stack.
- Auth-protected private dashboard.
- Background worker and crawler observability.
