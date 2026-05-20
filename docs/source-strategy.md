# Source strategy

Initial target markets for a NL + surrounding-country used-car valuation product.

This document separates resale listing sources from rental-rate sources. Rental-rate data is used only to estimate optional revenue potential; it should not be mixed into comparable resale valuation.

## Tier 1: scrape-first

- AutoScout24 NL/BE/DE: live adapter enabled for public search-page `__NEXT_DATA__` payloads. The Golf search is expanded across NL/BE/DE via public country filters. Avoid private/disallowed GraphQL endpoints.
- Marktplaats.nl: live adapter enabled for public search-page `__NEXT_DATA__` payloads. Official API exists but requires registration/contact; do not use blocked internal APIs.
- 2dehands.be: live adapter enabled for public search-page `__NEXT_DATA__` payloads; useful Belgium coverage.
- Gaspedaal.nl: high NL coverage, aggregator, search pages are reachable, but current React Flight payload is not normalized safely enough yet. Keep as smoke/source-strategy until a robust parser is added.
- Kleinanzeigen.de: useful German private/dealer signal, but this environment currently receives 403. Do not bypass anti-abuse controls.

## Tier 2: API or skip

- mobile.de: good official APIs exist, but account activation is required. Scraping search pages is blocked/disallowed; use official credentials only.
- RDW Open Data: not a price source, but essential enrichment for Dutch plates when available.

## Tier 3: later / avoid early

- Leboncoin, LaCentrale, Gocar: anti-bot and robots constraints make them poor MVP targets.

## Rental-source strategy

Goal: add a directional rental revenue estimate for watched cars without creating compliance risk. Prefer official APIs, partner feeds, providers, or manually maintained benchmark snapshots. Scraping must be narrow, robots-aware, and disabled by default until reviewed.

### Priority and feasibility

| Priority | Source | Role | API/scrape feasibility | MVP decision |
| --- | --- | --- | --- | --- |
| 1 | SnappCar | Main NL peer-to-peer benchmark for owner-style rental pricing. | No free public API found. Robots research indicates major city pages such as `/auto-huren/amsterdam/*` are allowed, while accounts/users/services, query parameters, `searchId`, and category suffixes are blocked. Detail/city pages may be usable with very conservative crawling if current robots.txt and ToS still allow them. | Use as the first P2P benchmark candidate, but only from allowed city/detail pages, with low rate limits, cached snapshots, and no account/private endpoints. |
| 2 | MyWheels | NL car-sharing/fleet benchmark. | Public pages/rates are available; query URLs are blocked by robots. Pricing reflects fleet/car-sharing economics rather than owner P2P revenue. | Use for benchmark ranges only, not as owner income truth. Prefer public rate pages/static snapshots. |
| 3 | Greenwheels | NL car-sharing/fleet benchmark. | Public rates pages are available. | Use as benchmark-only context for upper/lower daily/hourly economics. |
| 4 | Commercial rental aggregators / partner APIs for Europcar, Hertz, Avis | Commercial class-rate benchmarks. | Travel/partner APIs and aggregator feeds exist. Rates are useful by vehicle class, location, dates, and lead time, but are not owner P2P revenue. | Use via provider/partner API if available; otherwise manually curated benchmark tables. |
| 5 | Sixt | Commercial class-rate benchmark. | Developer portal exists, but sixt.com robots disallows all crawling. | Official/partner API only; no site scraping. |
| 6 | Getaround | P2P/car-share supply signal outside core NL MVP. | No open public search API found. Robots blocks `/search?*`, address/date parameters, and `/docs/api`; paid Apify/Getaround scrapers exist. | Do not DIY scrape for MVP. Use partner/API/provider or paid data provider if this source becomes important. |
| 7 | Turo | International P2P reference, not NL-core. | Search/date/query paths are disallowed and anti-bot protections are significant. | Skip for MVP, or use a paid/provider dataset only. |

### Rental ingestion principles

- Keep rental ingestion separate from resale listing ingestion and label all outputs as estimates.
- Track source type: `p2p_marketplace`, `fleet_car_share`, `commercial_rental`, or `manual_benchmark`.
- Store observation context: source, location/city, vehicle class or make/model, rental duration, included km/mileage, fees/insurance notes, captured date, and confidence.
- Prefer static/public rate pages, partner APIs, and paid compliant providers over crawling interactive search URLs.
- Never crawl account pages, user profiles, search URLs with blocked query parameters, private APIs, authenticated endpoints, or paths disallowed by robots.txt.
- Disable a rental source after repeated 403/429/CAPTCHA responses or a robots/ToS change.
- Do not combine commercial/fleet benchmarks directly with owner P2P rates without displaying the source type and caveat.

## Normalized listing model

Core fields:

- source, country, source listing ID, canonical URL
- title, make, model, trim/body text
- price, previous observed price, currency
- mileage, year/first registration, fuel, transmission
- location, seller type, dealer name if present
- first seen, last seen, delisted status
- photos/thumbs, free-text notes, parse confidence

Valuation outputs:

- comparable median and delta
- days on market
- price-drop history
- price per 10k km
- dealer/private spread
- undervalued/fair/expensive/watch verdict
- alert threshold matches

Rental estimate outputs:

- observed daily/hourly rental benchmark by source type
- estimated gross monthly revenue at configurable utilization assumptions
- platform/provider fee and insurance adjustment assumptions
- estimated net monthly revenue range, explicitly marked as directional
- source confidence and freshness
- caveats for P2P vs fleet/commercial benchmark differences
