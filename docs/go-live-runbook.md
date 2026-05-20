# Go-live runbook

This runbook is for taking Car Market Watch from the current static Vite prototype to a production Vercel deployment. Do not run crawlers automatically on every deploy; keep live source checks manual or scheduled with conservative limits.

## 1. Pre-flight checklist

- `main` branch is green in GitHub Actions CI.
- `pnpm build` succeeds locally.
- Required environment variables are present in `.env.example` and configured in Vercel as needed.
- The deployment target is private/protected if the dashboard contains non-public search strategy, scraped data, or seller data.
- Source-specific robots.txt, Terms of Service, and API availability have been reviewed before enabling any crawler beyond smoke checks.

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

The repository includes `vercel.json`, so Vercel should pick up the build/output settings automatically. Keep the UI settings aligned with `vercel.json` to avoid surprises.

## 3. Environment variables

Current static UI builds without secrets. Configure these only when enabling the related production capabilities:

| Variable | Required now? | Where | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | No | Vercel Project Settings -> Environment Variables | Future Postgres/Neon connection for persisted listings. Never expose this to client code. |
| `SCRAPER_USER_AGENT` | Recommended for manual smoke | GitHub Actions repository variable and future worker runtime | Use an honest UA with contact info, e.g. `CarMarketWatch/0.1 contact@example.com`. |
| `VITE_PUBLIC_APP_ENV` | Optional | Vercel | Safe client-side label such as `production` or `preview`; only `VITE_` variables are exposed to the Vite client bundle. |
| `VITE_PUBLIC_SITE_URL` | Optional | Vercel | Canonical deployed app URL for links/metadata if the app starts using it. |

For Vercel, add production values first, then preview values if they differ. Do not put crawler credentials or database secrets in `VITE_` variables.

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

## 7. Scheduled data update strategy

Do not use Vercel static deployments as the crawler runtime. Recommended production shape:

1. Keep the Vercel app as the frontend/static dashboard.
2. Run ingestion in a separate scheduled worker environment such as GitHub Actions scheduled workflow, Fly.io Machines, Railway, Render Cron Jobs, or a small VPS.
3. Persist normalized listings and observations in Postgres/Neon/Supabase.
4. Expose data to the frontend through a narrow API layer or generated static JSON snapshots.
5. Use small allowlisted searches, incremental fetches, backoff, and source-specific rate limits.
6. Store raw HTML snapshots outside git with short retention for debugging parser changes.
7. Emit run metadata: source, search ID, started/finished time, fetched pages, parsed listings, failures, HTTP status mix, and robots/ToS review version.

Suggested conservative cadence for MVP:

- Daily run for each watched search.
- One source at a time with jitter between requests.
- Disable a source automatically after repeated 403/429/CAPTCHA or parser failures.
- Keep manual smoke separate from scheduled ingestion.

## 8. Crawler legality, robots, and safety notes

- Review each target site's robots.txt and Terms of Service before crawling.
- Prefer official APIs where available, especially mobile.de and RDW open data.
- Do not bypass authentication, CAPTCHA, paywalls, bot protections, or private endpoints.
- Identify the crawler with a truthful user agent and contact email.
- Respect rate limits, cache pages, and avoid collecting unnecessary personal data.
- Treat seller/dealer contact details and plate-derived enrichment as personal or sensitive data; minimize retention and access.
- Maintain an allowlist of enabled sources and searches; default new sources to disabled until reviewed.
- If a site blocks the crawler or requests removal, disable that source and document the decision.

## 9. Rollback

- Vercel: use Project -> Deployments -> previous successful deployment -> Promote to Production.
- GitHub: revert the offending PR and let CI/build run again.
- Data ingestion: stop the worker or scheduled workflow before rolling back parser code if it is producing bad data.

## 10. Operational ownership

- CI status: GitHub Actions `CI` workflow.
- Manual source smoke: GitHub Actions `Scrape smoke` workflow.
- Frontend deployment: Vercel project deployments.
- Future data worker: separate scheduled runtime with explicit owner, logs, and alerting.
