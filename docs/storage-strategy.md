# Storage strategy

Car Market Watch should stay static and low-risk until ingestion is proven. Storage moves through three stages.

## Stage 1: local/manual JSON snapshot

- Source of truth remains typed fixture data and generated chunked JSON under `public/data/market-snapshot-manifest.json` plus `public/data/chunks/`.
- Use `pnpm exec tsx scripts/run-ingestion.ts` for a preview-only manual ingestion check.
- Use `pnpm exec tsx scripts/run-ingestion.ts --write` to write `artifacts/ingestion/manual-fixture-snapshot.json` locally.
- Do not commit raw marketplace HTML or seller/contact data.
- Keep snapshots small and dashboard-oriented: normalized listings, run metadata, confidence notes, and derived scores.

## Stage 2: scheduled GitHub Action artifact

When the manual runner is stable, use `.github/workflows/live-ingestion.yml` as the scheduled/manual scaffold:

1. Checks out the repository and installs dependencies.
2. Runs `scripts/run-ingestion.ts --live --write` outside Vercel with allowlisted live adapters only.
3. Defaults scheduled runs to one page per source/search and a 1500 ms request delay; manual runs can override those inputs and optionally pass one saved search ID.
4. Uploads `artifacts/ingestion-upload/latest-live-ingestion.sanitized.json` as a 14-day GitHub Actions artifact.
5. Does not commit generated data, push branches, deploy Vercel, or require secrets by default.
6. Optionally publishes the latest sanitized snapshot to object storage or commits only reviewed fixture/snapshot updates in a separate, explicit process.

Operational rules:

- Live crawlers are disabled by default and source allowlisted.
- Run metadata must include `startedAt`, `finishedAt`, `durationMs`, page count config, request delay config, source/search count breakdowns, errors, notes, per-source statuses, and a source status summary.
- Raw debug captures, if any, are short-retention artifacts only and must not include unnecessary personal data.
- Vercel builds consume existing JSON only; they never fetch live marketplace pages.

## Stage 3: Neon/Postgres

Move to Neon/Postgres once there is enough listing volume or history to justify persistence.

Concrete schema contract: [`../db/schema.sql`](../db/schema.sql). It is dependency-free Postgres SQL so the app can keep running as a static Vite prototype until a backend is selected.

Core tables:

- `source_configs`: source enablement, cadence, adapter version, and robots/ToS review metadata.
- `saved_searches`: auth-scoped search configs owned by a future private dashboard user.
- `ingestion_runs`: source, adapter version, search ID, started/finished timestamps, status, counts, review version.
- `listings`: normalized current listing fields keyed by source + source listing ID.
- `listing_price_history`: listing ID, observed timestamp, price, mileage, availability status.
- `valuations`: listing ID, generated timestamp, comparable IDs, score, verdict.
- `purchase_decisions`: listing ID, landed cost, rental yield, blockers, decision verdict.

Raw marketplace captures should remain outside this app schema in short-retention object storage/artifacts and be referenced only from worker logs if needed.

## Stage 4: narrow API and private dashboard

When persistence is enabled, add a server/API layer that follows the typed contracts in [`../src/server/contracts.ts`](../src/server/contracts.ts):

1. Auth middleware resolves the current user/session before any `/api/*` handler reads saved searches or listings.
2. `/api/listings` accepts normalized pagination, sort, and filter params and returns `PaginatedListingsResponse`.
3. `/api/saved-searches` and source config mutation endpoints require owner-only access.
4. The API reads from Postgres/Neon and returns sanitized listing/economics data only; crawler credentials and raw captures never cross the browser boundary.
5. The static JSON snapshot can remain as a fallback/export path for public demos.

Never expose `DATABASE_URL`, auth secrets, crawler credentials, BPM provider keys, or worker tokens to `VITE_*` client variables.
