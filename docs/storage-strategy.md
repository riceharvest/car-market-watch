# Storage strategy

Car Market Watch should stay static and low-risk until ingestion is proven. Storage moves through three stages.

## Stage 1: local/manual JSON snapshot

- Source of truth remains typed fixture data and generated JSON under `public/data/market-snapshot.json`.
- Use `pnpm exec tsx scripts/run-ingestion.ts` for a preview-only manual ingestion check.
- Use `pnpm exec tsx scripts/run-ingestion.ts --write` to write `artifacts/ingestion/manual-fixture-snapshot.json` locally.
- Do not commit raw marketplace HTML or seller/contact data.
- Keep snapshots small and dashboard-oriented: normalized listings, run metadata, confidence notes, and derived scores.

## Stage 2: scheduled GitHub Action artifact

When the manual runner is stable, add a scheduled workflow that:

1. Checks out the repository and installs dependencies.
2. Runs an allowlisted ingestion command outside Vercel.
3. Uploads the sanitized JSON snapshot as a GitHub Actions artifact.
4. Optionally publishes the latest sanitized snapshot to object storage or commits only reviewed fixture/snapshot updates.

Operational rules:

- Live crawlers are disabled by default and source allowlisted.
- Run metadata must include source, saved search ID, start/end time, listing counts, status mix, parser errors, and robots/ToS review version.
- Raw debug captures, if any, are short-retention artifacts only and must not include unnecessary personal data.
- Vercel builds consume existing JSON only; they never fetch live marketplace pages.

## Stage 3: Neon/Postgres

Move to Neon/Postgres once there is enough listing volume or history to justify persistence.

Suggested tables:

- `ingestion_runs`: source, adapter version, search ID, started/finished timestamps, status, counts, review version.
- `raw_observations`: run ID, source listing ID, URL hash/canonical URL, observed timestamp, raw payload reference, retention expiry.
- `listings`: normalized current listing fields keyed by source + source listing ID.
- `listing_price_history`: listing ID, observed timestamp, price, mileage, availability status.
- `valuations`: listing ID, generated timestamp, comparable IDs, score, verdict.
- `purchase_decisions`: listing ID, landed cost, rental yield, blockers, decision verdict.

Keep browser-facing data behind a narrow API or generated static snapshot. Never expose `DATABASE_URL` or worker credentials to `VITE_*` client variables.
