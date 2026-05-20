# BPM calculator integration

BPM is a critical import-cost input for non-NL listings. Current implementation supports manual `bpmOverrideEur`; automated BPM should be added only after the source and legal basis are confirmed.

## MVP workflow

1. For NL listings, BPM is normally not needed for landed-cost comparison.
2. For BE/DE/EU listings, estimate import costs with `needsManualBpm: true` unless a trusted override exists.
3. Open the official Dutch tax/RDW-oriented BPM calculator or a vetted professional tool manually.
4. Enter first registration date, fuel, CO2 g/km, net catalogue/list price inputs if required, and relevant depreciation method.
5. Record the result as `bpmOverrideEur` on the listing or future admin form.
6. Rebuild/re-run snapshots and verify the purchase decision no longer reports BPM as a blocker.

## Data needed for a useful BPM integration

- First registration date.
- CO2 emissions in g/km and fuel type.
- Vehicle make/model/trim/body style.
- Original list price/catalogue value where required.
- Odometer, condition, and depreciation basis.
- Country of origin and target country (`NL`).
- Manual audit trail: calculator used, calculation date, assumptions, and reviewer.

## Integration options to research

- Official Belastingdienst/RDW flows or downloadable tables where allowed.
- Licensed automotive data providers with BPM endpoints.
- Internal calculator based on public tax tables, maintained with explicit table versioning.
- Manual-only admin field for the MVP.

## Guardrails

- Do not scrape interactive government tools unless the terms explicitly permit automation.
- Prefer official APIs, licensed datasets, or manual entry.
- Keep the calculator version/date with every result.
- Show `needsManualBpm` and confidence clearly; avoid presenting an estimate as tax advice.
- Recalculate before purchase because rates, interpretations, and vehicle-specific inputs can change.
