# Go-live runbook

This runbook is for taking Car Market Watch from the current static Vite prototype to a production Vercel deployment. Do not run crawlers automatically on every deploy; keep live source checks manual or scheduled with conservative limits.

## 1. Pre-flight checklist

- `main` branch is green in GitHub Actions CI.
- `pnpm build` succeeds locally.
- Required environment variables are present in `.env.example` and configured in Vercel as needed.
- The deployment target is private/protected if the dashboard contains non-public search strategy, scraped data, or seller data.
- Source-specific robots.txt, Terms of Service, and API availability have been reviewed before enabling any crawler beyond smoke checks.
- Manual ingestion preview has been run with `pnpm exec tsx scripts/run-ingestion.ts`; use `--write` only when a local fixture snapshot artifact is needed. Review the emitted `run` metadata before consuming any generated snapshot.
- Non-NL purchase candidates with `needsManualBpm` have a reviewed `bpmOverrideEur` or are blocked from purchase.

## 2. Vercel project import settings

Import the GitHub repository into Vercel with these settings:

| Setting | Value |
| --- | --- |
| Framework Preset | Vite |
| Root Directory | Repository root |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `dist` |
| Node.js Version | 20.x |
| Package Manager | pnpm 9 |

The repository includes `vercel.json`, so Vercel should pick up the build/output settings automatically. Keep the UI settings aligned with `vercel.json` to avoid surprises. The Vercel build must not run `scripts/run-ingestion.ts`, smoke scraping, or future live crawlers; it should consume existing committed/static JSON only.

## 3. Environment variables

Current static UI builds without secrets. Configure these only when enabling the related production capabilities:

| Variable | Required now? | Where | Notes |
| --- | --- | --- | --- |
| `ACCESS_PASSWORD` | Yes for private launch | Vercel Project Settings -> Environment Variables | Server-side middleware password for the whole dashboard. Current launch value should be set in Vercel only, not committed. |
| `DATABASE_URL` | No | Vercel Project Settings -> Environment Variables | Future Postgres/Neon connection for persisted listings. Never expose this to client code. |
| `SCRAPER_USER_AGENT` | Recommended for manual smoke | GitHub Actions repository variable and future worker runtime | Use an honest UA with contact info, e.g. `CarMarketWatch/0.1 contact@example.com`. |
| `VITE_PUBLIC_APP_ENV` | Optional | Vercel | Safe client-side label such as `production` or `preview`; only `VITE_` variables are exposed to the Vite client bundle. |
| `VITE_PUBLIC_SITE_URL` | Optional | Vercel | Canonical deployed app URL for links/metadata if the app starts using it. |

For Vercel, add production values first, then preview values if they differ. Do not put crawler credentials, database secrets, BPM provider keys, or worker tokens in `VITE_` variables.

## 3.1 Private production architecture checklist

Before enabling persisted data or a write-capable dashboard:

- Keep the browser app behind the included `ACCESS_PASSWORD` Vercel middleware gate, Vercel Deployment Protection, or an identity-aware proxy; default to private until data sensitivity is reviewed.
- Put all `/api/*` routes behind auth middleware that resolves server-side user/session context. The client must not provide `owner_user_id` directly.
- Implement the dependency-free contracts in `src/server/contracts.ts` before adding framework-specific handlers, and keep response shapes covered by tests.
- Apply `db/schema.sql` to a private Neon/Postgres database only from a migration step or admin workstation, not from Vercel client code.
- Store `DATABASE_URL`, auth provider secrets, crawler/API credentials, and worker tokens as server/worker secrets only; no secret may use the `VITE_` prefix.
- Restrict source config and saved-search mutation to an owner/admin role; viewers should be read-only.
- Use separate runtimes for frontend/API and crawlers. Crawlers write normalized data; the API reads sanitized data.
- Add database backups, migration rollback notes, request logs without seller/contact PII, and alerting for failed ingestion runs before relying on automated buys/alerts.

## 4. First deploy

1. Import the repository into Vercel using the settings above.
2. Confirm Vercel detects `pnpm-lock.yaml` and uses pnpm.
3. Trigger the first preview deployment from a pull request, or deploy `main` if this is an initial private launch.
4. Inspect the build log for TypeScript or Vite warnings.
5. Open the Vercel preview URL and verify the dashboard renders with sample data.
6. Promote to production only after the post-deploy smoke checks pass.

## 5. Domain setup

1. Add the desired domain in Vercel Project Settings -> Domains.
2. Configure DNS as instructed by Vercel:
   - Apex domain: A record to Vercel's recommended IP, or use Vercel nameservers.
   - Subdomain: CNAME to `cname.vercel-dns.com`.
3. Wait for Vercel to issue TLS certificates.
4. Set `VITE_PUBLIC_SITE_URL` to the final `https://...` URL if the app uses canonical URLs.
5. Re-deploy production after changing environment variables.

## 6. Post-deploy smoke checks

Run these checks after first production deploy and after major UI changes:

```bash
curl -I https://YOUR_DOMAIN/
curl -I https://YOUR_DOMAIN/assets/
```

Manual UI checklist:

- Home/dashboard route loads without a blank screen.
- Browser console has no fatal errors.
- Listing cards/tables render sample data.
- Charts render and resize correctly.
- Refreshing a nested route returns the app shell, not a 404. The `vercel.json` SPA rewrite handles this.

Optional source smoke check:

- In GitHub Actions, run **Scrape smoke** manually with a reason.
- Review output for reachability and parser hints.
- Do not schedule this workflow at high frequency; it touches third-party marketplaces.

Manual fixture ingestion check:

```bash
pnpm exec tsx scripts/run-ingestion.ts
pnpm exec tsx scripts/run-ingestion.ts --search=search-vw-golf-15-tsi-benelux --write
```

The default runner is manual-fixture only and makes no external requests. The `--write` mode stores `artifacts/ingestion/manual-fixture-snapshot.json` for local review. Every snapshot includes `run.startedAt`, `run.finishedAt`, `run.durationMs`, page/delay configuration, source and search count breakdowns, errors, notes, per-source statuses, and a status summary.

## 7. Scheduled data update and static snapshot strategy

Do not use Vercel static deployments as the crawler runtime. Recommended production shape:

1. Keep the Vercel app as the frontend/static dashboard.
2. Run resale and rental ingestion in a separate scheduled worker environment such as GitHub Actions scheduled workflow, Fly.io Machines, Railway, Render Cron Jobs, or a small VPS.
3. Persist normalized listings, rental observations, and run metadata in Postgres/Neon/Supabase.
4. Expose data to the frontend through a narrow API layer or generated static JSON snapshots.
5. For the current static MVP, prefer generated JSON snapshots committed or uploaded by the worker to object storage/CDN, then consumed by the Vercel app at build/runtime.
6. Keep crawler output snapshots immutable per run (`source/date/run-id`) and publish only sanitized derived JSON to the dashboard.
7. Never make the Vercel build command fetch live marketplace/rental pages. Vercel preview and production builds should consume existing snapshots only.
8. Use small allowlisted searches, incremental fetches, backoff, and source-specific rate limits.
9. Store raw HTML snapshots outside git with short retention for debugging parser changes.
10. Emit run metadata: source, search ID, started/finished time, fetched pages, parsed listings, failures, HTTP status mix, and robots/ToS review version.

Suggested conservative cadence for MVP:

- Daily run for each watched resale search.
- Rental-rate refresh weekly or slower unless using an official/partner API that permits more frequent updates.
- One source at a time with jitter between requests.
- Disable a source automatically after repeated 403/429/CAPTCHA or parser failures.
- Keep manual smoke separate from scheduled ingestion.

See [`storage-strategy.md`](storage-strategy.md) for the JSON artifact to future Neon/Postgres path.

### Current GitHub Actions live-ingestion scaffold

The repository includes `.github/workflows/live-ingestion.yml` as the daily worker/publisher that runs outside Vercel:

1. It is triggered manually with `workflow_dispatch` or by a daily 04:17 UTC schedule.
2. It checks out the repository with `contents: write`, installs dependencies with pnpm, and runs `scripts/run-ingestion.ts --live --write`.
3. If a `DATABASE_URL` repository secret is configured, it sets `INGESTION_DB_MODE=db` so the same run persists listings and price-history rows to Postgres/Neon.
4. It rebuilds the chunked static snapshot with `pnpm run data:build`, runs focused snapshot contract tests, then uploads `artifacts/ingestion-upload/latest-live-ingestion.sanitized.json` as a 14-day GitHub Actions artifact.
5. When the manual `publish` input is `true` (default, including scheduled runs), it commits only `public/data/market-snapshot-manifest.json` and `public/data/chunks/` back to `main`. Raw marketplace observations stay out of git and out of the uploaded artifact.

The sanitized artifact intentionally drops `rawObservations` payloads and keeps normalized public listing fields plus the full `run` metadata for audit/review. Scheduled publication is deliberately limited to dashboard-ready static chunks; raw ingestion artifacts remain ephemeral Actions artifacts unless a DB secret is configured.

Live-mode compliance guardrails:

- Only the adapters in `reachableLiveSources` run (`autoscout24`, `marktplaats`, `2dehands`).
- `blockedOrGatedLiveSources` are reported in notes/statuses and must not be bypassed (`gaspedaal`, `kleinanzeigen`, `mobile-de-api` until their documented reasons change).
- Keep crawler credentials out of this workflow; only `DATABASE_URL` is read, and only server-side in the GitHub Actions runner.
- If source statuses show `error` for repeated 403/429/CAPTCHA/parser failures, disable or narrow the source before the next scheduled run.
- Keep Vercel builds consuming existing snapshots only; never move live crawling into `pnpm build`.

## 8. BPM manual override workflow

BPM is a purchase blocker for non-NL imports until reviewed:

1. Open the candidate listing and verify first registration date, fuel, CO2, mileage, and trim.
2. Calculate BPM manually using an official or vetted calculator.
3. Record `bpmOverrideEur`, calculator/date, and assumptions in listing notes or the future admin form.
4. Rebuild snapshots and confirm `needsManualBpm` clears.
5. Recheck BPM before final purchase; dashboard estimates are not tax advice.

See [`bpm-calculator-integration.md`](bpm-calculator-integration.md) for integration research and guardrails.

## 9. Crawler legality, robots, and safety notes

- Review each target site's robots.txt and Terms of Service before crawling.
- Prefer official APIs where available, especially mobile.de, RDW open data, commercial rental partner APIs, and any approved rental data providers.
- Do not bypass authentication, CAPTCHA, paywalls, bot protections, or private endpoints.
- Identify the crawler with a truthful user agent and contact email.
- Respect rate limits, cache pages, and avoid collecting unnecessary personal data.
- Treat seller/dealer contact details and plate-derived enrichment as personal or sensitive data; minimize retention and access.
- Maintain an allowlist of enabled sources and searches; default new sources to disabled until reviewed.
- If a site blocks the crawler or requests removal, disable that source and document the decision.

Rental-source-specific notes:

- SnappCar is the main NL P2P rental marketplace candidate. Current research found no free public API. Only consider allowed public city/detail pages, such as allowed `/auto-huren/<city>/*` paths, after rechecking robots.txt. Do not crawl blocked account/user/service/search/query/category/searchId URLs.
- Getaround has no open public search API identified; robots blocks search and address/date query paths plus `/docs/api`. Use partner/API/provider or paid data provider only for MVP, not DIY scraping.
- Turo search/date/query paths are disallowed, anti-bot controls are material, and it is not NL-core. Skip for MVP unless using a paid/provider dataset.
- MyWheels and Greenwheels public rates pages can be useful benchmark inputs, but they represent fleet/car-sharing economics, not owner P2P revenue.
- Sixt must be official/partner API only because sixt.com robots disallows all crawling.
- Europcar, Hertz, and Avis class rates can be useful through travel/partner APIs or aggregators, but treat them as commercial benchmarks rather than owner income.
- For every rental source, record the robots/ToS review date, allowed URL patterns, disallowed URL patterns, rate limit, data retention, and source type before enabling a worker.

## 10. Rollback

- Vercel: use Project -> Deployments -> previous successful deployment -> Promote to Production.
- GitHub: revert the offending PR and let CI/build run again.
- Data ingestion: stop the worker or scheduled workflow before rolling back parser code if it is producing bad data.

## 11. Operational ownership

- CI status: GitHub Actions `CI` workflow.
- Manual source smoke: GitHub Actions `Scrape smoke` workflow.
- Manual fixture ingestion: `pnpm exec tsx scripts/run-ingestion.ts`.
- Frontend deployment: Vercel project deployments.
- Future data worker: separate scheduled runtime with explicit owner, logs, and alerting.
