# Car Market Watch

Private dashboard for tracking second-hand car listings in the Netherlands and surrounding countries, then scoring valuation signals like market median, price drops, days-on-market, and undervalued comps.

## Current state

- Vite + React + TypeScript dashboard scaffold.
- Typed listing model and sample listings.
- Valuation helpers for comparable-set median, price delta, days watched, and deal score.
- Source strategy docs for Gaspedaal, AutoScout24, Marktplaats, 2dehands, Kleinanzeigen, mobile.de, and RDW enrichment.
- Smoke script for checking whether target source pages are reachable and still expose price/spec hints.

## Run locally

```bash
pnpm install
pnpm dev
```

## Verify

```bash
pnpm build
pnpm scrape:smoke
```

## Product direction

The end state is an auth-protected website where watched searches and listings are ingested daily, normalized, deduplicated, enriched, and shown with:

- price history
- comparable median and delta
- deal score
- days-on-market
- seller/dealer split
- country/source filters
- alerts for price drops and undervalued cars
