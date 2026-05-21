# Production readiness

This repo is moving from a static snapshot dashboard toward a DB-backed, authenticated app.

## Runtime pieces now scaffolded

- **Hono API boundary**: `src/server/api/app.ts` exposes `/api/listings` behind a trusted auth dependency and delegates reads to a repository.
- **Better Auth boundary**: `src/server/auth.ts` wraps the installed `better-auth` package and deliberately ignores browser-controlled identity like `?userId=`.
- **Postgres/Neon config**: `src/server/db/config.ts` fails fast when production or DB-backed workers lack `DATABASE_URL`, disables SSL for localhost, and requires SSL for remote Neon-style hosts by default.
- **DB persistence scaffold**: `src/server/db/listingRepository.ts` and `src/server/db/ingestionWriter.ts` map normalized listings into parameterized SQL operations without storing raw marketplace observations.

## Local Postgres

```bash
pnpm db:setup
pnpm db:psql
pnpm db:down
```

The local URL matches `.env.example`:

```text
postgres://car_market_watch:car_market_watch@localhost:5433/car_market_watch
```

## Environment

Required when running production/API/DB-backed worker mode:

- `DATABASE_URL` — Postgres/Neon connection string, server-only.
- `DATABASE_SSL` — optional override; localhost defaults to `false`, remote hosts default to `true`.
- `BETTER_AUTH_SECRET` — server-only Better Auth secret.
- `BETTER_AUTH_URL` — canonical auth URL.
- `INGESTION_DB_MODE=db` — future switch for worker writes to DB instead of JSON artifacts.

## Still needed before real production

1. Wire a real Better Auth DB adapter/session resolver into the Hono deployment entrypoint.
2. Add a Vercel/serverless entrypoint for the Hono app.
3. Run `pnpm exec tsx scripts/run-ingestion.ts --db` or `INGESTION_DB_MODE=db pnpm ingest:live` against a migrated Neon branch and verify listing/price-history counts.
4. Run schema migrations against an actual Neon branch and smoke-test `/api/listings` with real data.
5. Add protected saved-search CRUD and admin/source-config routes.
