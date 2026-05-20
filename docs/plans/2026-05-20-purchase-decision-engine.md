# Purchase Decision Engine Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Turn Car Market Watch from a static valuation dashboard into a usable decision system that ranks which cars to buy, from which country/source, after Dutch import/on-road costs, rental revenue potential, resale value, and operational risk.

**Architecture:** Keep the current Vite static dashboard deployable on Vercel, but introduce a real data/decision layer behind the generated `public/data/market-snapshot.json`. Build pure TypeScript domain modules first, tested with Vitest, then wire them into ingestion scripts and UI. Import-cost logic must be source-backed and confidence-tagged because BPM depends on vehicle CO₂, first registration, depreciation method, and current Dutch rules.

**Tech Stack:** Vite + React + TypeScript, Vitest, static JSON snapshot generation, future optional Neon/Postgres + Drizzle + Hono worker when static snapshots are no longer enough.

---

## Current Baseline

Already implemented:

- Purchase-market sources: AutoScout24, Gaspedaal, Marktplaats, 2dehands, Kleinanzeigen, mobile.de API metadata.
- Rental-source strategy: SnappCar primary; Getaround/Turo skipped without licensed/API data; MyWheels/Greenwheels/commercial rental sites benchmark only.
- Static snapshot: `pnpm data:build` generates `/data/market-snapshot.json`.
- Dashboard: listing valuation, rental/day, monthly gross, gross annual rental yield.
- Tests: valuation and rental-estimate behavior.

Missing for actual purchase decisions:

- Import/on-road cost model to the Netherlands.
- Real acquisition total: listing price + travel/transport + RDW + BPM + VAT/customs if applicable + inspection/plates/admin buffer.
- Country/source-specific sourcing risk.
- Net rental economics, not just gross rental revenue.
- Purchase score that combines discount, rental yield, resale downside, import complexity, confidence, and liquidity.
- Data quality gates that stop weak scraped fields from producing fake precision.

---

## Source-backed Import Rules to Encode

Use these official sources as implementation references:

- RDW import from EU/EFTA: `https://www.rdw.nl/en/import-export-transit/importing-a-vehicle-from-a-eu-or-efta-country`
  - Imported EU/EFTA vehicle needs RDW inspection/registration process.
  - Bring original foreign registration certificate; CoC is useful because CO₂ value determines BPM.
  - RDW transfers data to Dutch registration register; BPM declaration with Tax and Customs Administration is part of process.
- Belastingdienst BPM calculation: `https://www.belastingdienst.nl/wps/wcm/connect/en/bpm/content/how-calculate-bpm`
  - BPM depends on vehicle type and tariff.
  - Used vehicles get depreciation discount on gross BPM.
  - You may choose the depreciation method that gives the lowest BPM.
  - BPM payable = gross BPM minus depreciation discount.
- Business.gov BPM overview: `https://business.gov.nl/regulations/bpm/`
  - Passenger-car/delivery-van BPM depends on CO₂ emissions.
  - Zero-emission cars are handled separately under BPM rules.
- Dutch Customs cars/motorcycles: `https://www.douane.nl/en/themes/travel-and-holiday/restricted-prohibited-to-import-or-export/cars-and-motorcycles/`
  - EU purchase imported to NL: no customs duties, but BPM return is needed.
  - Outside EU: customs declaration is required, and BPM return is also needed.

Important: do **not** hardcode BPM as a single percentage. Build a model that stores source fields, assumptions, and confidence. Exact BPM can later be delegated to an official/third-party calculator or manually entered when required.

---

## Decision Formula v1

For each listing:

```ts
landedCostEur = listing.priceEur
  + importCost.transportEur
  + importCost.rdwInspectionEur
  + importCost.platesAndRegistrationEur
  + importCost.bpmEstimateEur
  + importCost.vatEstimateEur
  + importCost.customsDutyEstimateEur
  + importCost.adminBufferEur;

netAnnualRentalEur = rental.annualGrossEur
  - rental.platformFeesEur
  - rental.insuranceEur
  - rental.cleaningEur
  - rental.maintenanceReserveEur
  - rental.taxReserveEur
  - rental.downtimeReserveEur;

netRentalYieldPct = netAnnualRentalEur / landedCostEur * 100;

purchaseScore = weighted score from:
  - discount vs comparable Dutch market after landed cost
  - net rental yield
  - payback months
  - source/listing confidence
  - import complexity penalty
  - mileage/year/liquidity
  - duplicate/repost/dealer risk
  - missing-field penalty
```

Output verdicts:

- `buy-now`: strong discount after landed cost + acceptable net yield + high confidence.
- `negotiate`: decent candidate but needs lower price or missing docs.
- `watch`: not bad, but not enough edge.
- `avoid`: landed cost/risk kills the deal.
- `needs-data`: cannot rank because BPM/CO₂/year/rental comps are missing.

---

## Phase 1 — Import Cost Foundation

### Task 1: Add import-cost types

**Objective:** Define explicit data structures for country-of-origin import costs, assumptions, and confidence.

**Files:**

- Modify: `src/types.ts`
- Test: `tests/importCost.test.ts`

**Step 1: Write failing test**

Create `tests/importCost.test.ts` with a compile/runtime shape test that imports planned types and a placeholder helper from `src/domain/importCost.ts`.

Expected test cases:

- EU listing has `customsDutyEstimateEur === 0`.
- Missing CO₂/BPM inputs yields `confidence: 'low'` and a `needsManualBpm` flag.
- Non-EU listing can include VAT/customs placeholders.

**Step 2: Run test to verify failure**

Run:

```bash
pnpm test tests/importCost.test.ts
```

Expected: FAIL because `src/domain/importCost.ts` does not exist.

**Step 3: Add types**

Add to `src/types.ts`:

```ts
export type ImportRegion = 'domestic-nl' | 'eu-efta' | 'non-eu';

export type ImportCostEstimate = {
  listingId: string;
  originCountry: CountryCode;
  targetCountry: 'NL';
  region: ImportRegion;
  transportEur: number;
  rdwInspectionEur: number;
  platesAndRegistrationEur: number;
  bpmEstimateEur: number;
  vatEstimateEur: number;
  customsDutyEstimateEur: number;
  adminBufferEur: number;
  totalImportCostEur: number;
  landedCostEur: number;
  needsManualBpm: boolean;
  confidence: Confidence;
  assumptions: string[];
  sourceUrls: string[];
};
```

Extend `MarketSnapshot` with:

```ts
importCostEstimates: ImportCostEstimate[];
```

**Step 4: Add minimal helper**

Create `src/domain/importCost.ts` with `estimateImportCost(listing, options)` returning a conservative estimate.

**Step 5: Run test to verify pass**

```bash
pnpm test tests/importCost.test.ts
pnpm test
```

**Commit:** `feat: add import cost estimate model`

---

### Task 2: Add country cost profiles

**Objective:** Encode country-specific transport/admin defaults for NL, BE, DE, FR, and future non-EU sources.

**Files:**

- Create: `src/data/importProfiles.ts`
- Modify: `src/data/index.ts`
- Test: `tests/importCost.test.ts`

**Profiles v1:**

- NL: domestic, no import cost, but include plates/registration as zero.
- BE: EU/EFTA, low transport estimate.
- DE: EU/EFTA, medium transport estimate.
- FR: EU/EFTA, higher transport estimate.
- non-EU placeholder: VAT/customs required, disabled by default.

**Important:** Values are configurable estimates, not official fees. Include `sourceUrls` and `assumptions`.

**Verification:** tests assert each listing country maps to the correct region and transport tier.

**Commit:** `feat: add import country profiles`

---

### Task 3: Add BPM input model and manual override path

**Objective:** Stop fake BPM precision by requiring CO₂ and first-registration inputs or manual BPM override.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/domain/importCost.ts`
- Modify: `src/data/sampleListings.ts`
- Test: `tests/importCost.test.ts`

**Add optional listing fields:**

```ts
co2GPerKm?: number;
firstRegistrationDate?: string;
bpmOverrideEur?: number;
```

**Behavior:**

- If `bpmOverrideEur` exists, use it and mark assumption.
- If NL listing, BPM import estimate is zero.
- If imported EU/EFTA and missing CO₂/first registration, set `needsManualBpm: true`, low confidence, and use configurable placeholder/risk buffer.
- If imported EU/EFTA with CO₂/year but no official calculator integration yet, compute placeholder band and still label as estimate.

**Verification:** tests cover override, missing fields, domestic NL.

**Commit:** `feat: support BPM overrides and missing-data flags`

---

## Phase 2 — Net Rental Economics

### Task 4: Add rental cost assumptions

**Objective:** Convert gross rental revenue into net rental income scenarios.

**Files:**

- Modify: `src/types.ts`
- Modify: `src/domain/rentalRevenue.ts`
- Test: `tests/rentalRevenue.test.ts`

**Add:**

```ts
export type RentalCostAssumptions = {
  platformFeePct: number;
  insuranceMonthlyEur: number;
  cleaningPerBookingEur: number;
  maintenanceReservePct: number;
  taxReservePct: number;
  downtimeReservePct: number;
  averageBookingsPerMonth: number;
};

export type NetRentalEstimate = RentalEstimate & {
  platformFeesEur: number;
  insuranceEur: number;
  cleaningEur: number;
  maintenanceReserveEur: number;
  taxReserveEur: number;
  downtimeReserveEur: number;
  netAnnualRentalEur: number;
  netMonthlyRentalEur: number;
};
```

**Default assumptions:** start conservative; make these visible in UI.

**Verification:** tests prove net < gross and assumptions change output.

**Commit:** `feat: add net rental economics`

---

### Task 5: Add landed-cost rental yield

**Objective:** Compute rental yield against landed cost instead of listing price.

**Files:**

- Modify: `src/domain/rentalRevenue.ts`
- Modify: `src/domain/snapshot.ts`
- Test: `tests/rentalRevenue.test.ts`

**Behavior:**

- Use `landedCostEur` when import estimate exists.
- Fallback to listing price only for domestic/no-import listings.
- Output `netRentalYieldOnLandedCostPct`.

**Verification:** German listing yield changes after import cost is included.

**Commit:** `feat: calculate rental yield on landed cost`

---

## Phase 3 — Purchase Decision Scoring

### Task 6: Add purchase decision types

**Objective:** Define the final ranked output users will actually act on.

**Files:**

- Modify: `src/types.ts`
- Create: `src/domain/purchaseDecision.ts`
- Test: `tests/purchaseDecision.test.ts`

**Types:**

```ts
export type PurchaseVerdict = 'buy-now' | 'negotiate' | 'watch' | 'avoid' | 'needs-data';

export type PurchaseDecision = {
  listingId: string;
  landedCostEur: number;
  dutchMarketMedianEur: number;
  landedCostDeltaToDutchMarketEur: number;
  landedCostDeltaToDutchMarketPct: number;
  netAnnualRentalEur: number;
  netRentalYieldPct: number;
  paybackMonths: number | null;
  importComplexityScore: number;
  dataConfidenceScore: number;
  purchaseScore: number;
  verdict: PurchaseVerdict;
  reasons: string[];
  blockers: string[];
};
```

**Verification:** tests cover one strong domestic candidate, one imported candidate killed by BPM, one missing-data candidate.

**Commit:** `feat: add purchase decision output model`

---

### Task 7: Implement purchase scoring v1

**Objective:** Build deterministic, explainable ranking.

**Files:**

- Modify: `src/domain/purchaseDecision.ts`
- Test: `tests/purchaseDecision.test.ts`

**Scoring weights v1:**

- 30% landed discount vs Dutch market.
- 25% net rental yield.
- 15% data confidence.
- 10% liquidity: common model, age, mileage.
- 10% source confidence.
- 10% import complexity penalty.

**Hard blockers:**

- `needsManualBpm === true` and no override => `needs-data` unless discount is massive.
- `landedCostEur > dutchMarketMedianEur * 1.05` => usually `avoid`.
- rental comp count zero => cap score.
- low listing confidence => cap score.

**Verification:** tests assert reasons/blockers, not just score values.

**Commit:** `feat: implement purchase scoring`

---

### Task 8: Add snapshot integration

**Objective:** Include import costs and purchase decisions in generated static snapshot.

**Files:**

- Modify: `src/domain/snapshot.ts`
- Modify: `scripts/build-market-snapshot.ts`
- Test: `tests/snapshot.test.ts`

**Add to `MarketSnapshot`:**

```ts
importCostEstimates: ImportCostEstimate[];
purchaseDecisions: PurchaseDecision[];
summary: {
  bestPurchaseListingId: string | null;
  buyNowCount: number;
  needsDataCount: number;
}
```

**Verification:** generated snapshot has same count for listings/import estimates/purchase decisions.

**Commit:** `feat: include purchase decisions in snapshot`

---

## Phase 4 — Data Ingestion Quality Gates

### Task 9: Add source field completeness scoring

**Objective:** Prevent weak scrape results from ranking as strong buy candidates.

**Files:**

- Create: `src/domain/dataQuality.ts`
- Modify: `src/types.ts`
- Test: `tests/dataQuality.test.ts`

**Fields required for high confidence:**

- price
- country/source URL
- year or first registration
- mileage
- fuel
- transmission
- location
- CO₂ or BPM override for imports
- rental comparable count

**Output:**

```ts
export type DataQualityReport = {
  listingId: string;
  completenessPct: number;
  missingCriticalFields: string[];
  warnings: string[];
  confidence: Confidence;
};
```

**Commit:** `feat: add listing data quality reports`

---

### Task 10: Add duplicate/repost detection hooks

**Objective:** Stop duplicate marketplace listings from inflating comparable counts.

**Files:**

- Create: `src/domain/deduplication.ts`
- Test: `tests/deduplication.test.ts`

**Matching signals:**

- normalized title
- make/model/year/mileage proximity
- city/dealer
- photo URL hash if available later
- plate if available later

**Output:** duplicate cluster ID + confidence.

**Commit:** `feat: add duplicate listing detection hooks`

---

## Phase 5 — UI: Actual Purchase Decision Dashboard

### Task 11: Add purchase ranking table

**Objective:** Make the homepage answer “which car should I buy?” directly.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**UI columns:**

- rank
- car/source/country
- asking price
- landed cost
- Dutch market delta
- net rental yield
- payback months
- purchase score
- verdict
- top 2 reasons/blockers

**Verification:** browser snapshot shows ranked buy/avoid/needs-data rows.

**Commit:** `feat: add purchase decision ranking UI`

---

### Task 12: Add country/import comparison view

**Objective:** Show whether NL, BE, DE, or FR is the best sourcing country after fees.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Cards:**

- average listed price by country
- average landed cost to NL
- average net rental yield
- import complexity warning
- best source per country

**Verification:** filtered dashboard still works and country cards update.

**Commit:** `feat: add import country comparison UI`

---

### Task 13: Add candidate detail drawer/page

**Objective:** Let the user inspect why a candidate is ranked as buy/avoid.

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/styles.css`

**Content:**

- purchase decision reasons
- landed cost breakdown
- BPM assumptions/missing fields
- rental estimate assumptions
- comparable market listings
- rental comps
- data quality warnings

**Commit:** `feat: add candidate decision details`

---

## Phase 6 — Real Data Pipeline MVP

### Task 14: Add adapter interface for market scrapers

**Objective:** Standardize ingestion before adding real scrapers.

**Files:**

- Create: `src/ingest/types.ts`
- Create: `src/ingest/adapters/manualFixture.ts`
- Test: `tests/ingest.test.ts`

**Interface:**

```ts
export type ListingAdapter = {
  source: MarketSource;
  fetchSearch(search: SavedSearch): Promise<RawListingObservation[]>;
  normalize(raw: RawListingObservation): Listing;
};
```

**Commit:** `feat: add ingestion adapter interface`

---

### Task 15: Add polite scraper scheduler script

**Objective:** Prepare for daily ingestion without running scrapes during Vercel builds.

**Files:**

- Create: `scripts/run-ingestion.ts`
- Modify: `README.md`
- Modify: `docs/go-live-runbook.md`

**Rules:**

- Allowlist searches only.
- Respect robots notes stored in metadata.
- Cache raw HTML outside git.
- Per-source rate limit.
- Manual-only by default.

**Commit:** `feat: add manual ingestion runner skeleton`

---

### Task 16: Add storage strategy

**Objective:** Move beyond static sample data while keeping Vercel frontend simple.

**Files:**

- Create: `docs/storage-strategy.md`
- Optional future code: `src/storage/*`

**Preferred path:**

1. Short term: JSON snapshots committed or uploaded as Vercel static artifact.
2. Medium term: GitHub Action scheduled job writes snapshot artifact.
3. Production: Neon Postgres tables for listings, observations, rental comps, import estimates, decisions; Vercel frontend reads API/static snapshot.

**Commit:** `docs: add storage strategy`

---

## Phase 7 — Import/BPM Accuracy Upgrade

### Task 17: Add manual BPM workflow

**Objective:** Support practical import decisions before automating BPM.

**Files:**

- Modify: `src/data/sampleListings.ts`
- Modify: `README.md`
- Modify: `src/App.tsx`

**Workflow:**

- Dashboard marks import candidates missing BPM as `needs-data`.
- User can enter `bpmOverrideEur` in data file or future admin form.
- Purchase decision recalculates immediately.

**Commit:** `feat: support manual BPM input workflow`

---

### Task 18: Add BPM calculator integration research spike

**Objective:** Determine whether official/third-party BPM can be automated legally/reliably.

**Files:**

- Create: `docs/bpm-calculator-integration.md`

**Questions:**

- Is there an official Belastingdienst machine-readable endpoint? likely no.
- Can we use a paid BPM API/provider?
- What fields are required: CO₂, first registration, fuel, vehicle type, catalogue price, depreciation method.
- What should stay manual?

**Commit:** `docs: research BPM calculator integration`

---

## Phase 8 — Purchase Readiness Gates

### Task 19: Add acceptance smoke for decision quality

**Objective:** Prevent future changes from showing fake buy recommendations.

**Files:**

- Create: `tests/purchaseReadiness.test.ts`

**Assertions:**

- Every `buy-now` listing has no critical missing fields.
- Every imported `buy-now` listing has BPM override or high-confidence BPM estimate.
- Every `buy-now` listing has net rental estimate, not just gross.
- Every `buy-now` listing has landed cost below comparable Dutch market by threshold.

**Commit:** `test: add purchase readiness gates`

---

### Task 20: Add production checklist

**Objective:** Define what “fully usable” means before trusting real purchase decisions.

**Files:**

- Create: `docs/purchase-readiness-checklist.md`

**Checklist:**

- At least 3 purchase sources active for target models.
- At least 1 primary rental source or validated benchmark per target city/model.
- Import cost estimates present for every non-NL listing.
- BPM manual override completed for every serious import candidate.
- Duplicate detection enabled.
- Data quality score visible.
- Net rental assumptions visible and editable.
- Decision explanations visible.
- All `buy-now` candidates manually reviewed before purchase.

**Commit:** `docs: add purchase readiness checklist`

---

## Suggested Implementation Waves

Use `subagent-driven-development` with these parallel waves:

### Wave 1 — Core domain foundations

- Import-cost model and country profiles: Tasks 1–3.
- Net rental economics: Tasks 4–5.
- Data quality + dedupe: Tasks 9–10.

### Wave 2 — Purchase decision engine

- Purchase decision types/scoring: Tasks 6–8.
- Purchase readiness tests: Task 19.

### Wave 3 — Dashboard/UI

- Ranking table: Task 11.
- Country comparison: Task 12.
- Candidate detail view: Task 13.

### Wave 4 — Real ingestion and operationalization

- Adapter interface: Task 14.
- Manual ingestion runner: Task 15.
- Storage strategy: Task 16.
- Manual BPM workflow + BPM integration spike: Tasks 17–18.
- Production checklist: Task 20.

---

## Final Verification Commands

Run from `/home/dario/Documents/dev workspace/car-market-watch`:

```bash
pnpm test
pnpm build
pnpm preview --host 127.0.0.1 --port 4173
curl -s -I http://127.0.0.1:4173/
curl -s http://127.0.0.1:4173/data/market-snapshot.json > /tmp/cmw_snapshot.json
python3 - <<'PY'
import json
with open('/tmp/cmw_snapshot.json') as f:
    d = json.load(f)
for key in ['listings', 'valuations', 'rentalEstimates', 'importCostEstimates', 'purchaseDecisions']:
    assert key in d, key
print('snapshot ok', d['summary'])
PY
```

Browser smoke:

- `/` loads without console errors.
- Search/filter still works.
- Purchase ranking shows `buy-now`, `negotiate`, `watch`, `avoid`, or `needs-data`.
- Import candidates show landed cost breakdown.
- Missing BPM/CO₂ candidates do not appear as high-confidence buys.
- Rental estimates show net yield, not only gross yield.

---

## Definition of Done

The project is fully usable for purchase decisions when:

1. Every listing has a landed-cost estimate or an explicit `needs-data` blocker.
2. Every import candidate includes BPM assumptions, manual BPM override, or a visible low-confidence warning.
3. Purchase ranking is based on landed cost to NL, not raw asking price.
4. Rental yield is net and based on visible assumptions.
5. Dashboard explains why a car is recommended or rejected.
6. Source/data confidence is visible and affects score caps.
7. Real crawlers run outside Vercel builds with source-specific rate limits and compliance notes.
8. Tests prevent weak/missing data from becoming `buy-now` recommendations.
