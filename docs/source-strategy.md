# Source strategy

Initial target markets for a NL + surrounding-country used-car valuation product.

## Tier 1: scrape-first

- Gaspedaal.nl: high NL coverage, aggregator, search pages appear accessible.
- AutoScout24 NL/BE/DE: rich listing pages and EU coverage; avoid private/disallowed GraphQL endpoints.
- Marktplaats.nl: official API exists but requires registration/contact; search/detail HTML is usable with care.
- 2dehands.be: same family as Marktplaats; useful Belgium coverage.
- Kleinanzeigen.de: useful German private/dealer signal; HTML is scrapeable enough for first experiments.

## Tier 2: API or skip

- mobile.de: good official APIs exist, but account activation is required. Scraping search pages is blocked/disallowed.
- RDW Open Data: not a price source, but essential enrichment for Dutch plates when available.

## Tier 3: later / avoid early

- Leboncoin, LaCentrale, Gocar: anti-bot and robots constraints make them poor MVP targets.

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
