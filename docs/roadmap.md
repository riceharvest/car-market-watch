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

## Phase 2: product dashboard

- Search/watch configs by make, model, year range, km range, fuel, transmission, radius/country.
- Listing detail pages with price history chart and comparable set.
- Alert rules: below target price, price drop, new undervalued comp.
- Source confidence and parser error reporting.

## Phase 3: enrichment

- RDW enrichment for Dutch plates when visible.
- Dealer reputation/repost detection.
- Duplicate matching across marketplaces.
- Optional mobile.de API integration if credentials are acquired.

## Phase 4: deployment

- React Router/Hono/Drizzle/Neon app if the static Vite prototype graduates into the default production stack.
- Auth-protected private dashboard.
- Background worker and crawler observability.
