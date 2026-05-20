# Purchase readiness checklist

Use this checklist before contacting a seller, bidding, importing, or buying a vehicle flagged by the dashboard.

## 1. Listing data quality

- Make/model/trim, year, mileage, fuel, transmission, country, seller type, and URL are complete.
- Price history and days-on-market look plausible.
- Duplicate listings are checked across sources.
- Dashboard confidence is medium/high, or missing fields are manually verified.
- Seller identity and vehicle availability are confirmed outside the dashboard.

## 2. Valuation and market comparison

- Dutch comparable median is based on enough relevant comps.
- Mileage/year/spec differences are understood.
- Price-drop signal is real, not a stale listing or typo.
- Maximum bid is set before negotiation.
- Watchlist notes include why the vehicle is attractive and what would invalidate the deal.

## 3. Import and BPM readiness

- Origin country and import region are correct.
- Transport, RDW inspection, plates/registration, VAT/duty assumptions are reviewed.
- BPM is manually calculated or overridden for non-NL candidates.
- `needsManualBpm` is false before any serious bid.
- Landed cost still beats the NL comparable market after BPM and buffers.

## 4. Rental economics sanity check

- Rental estimate uses comparable vehicle class and city/region.
- Utilization assumption is realistic for the intended location.
- Platform fees, insurance, cleaning, maintenance, taxes, and downtime reserves are included.
- Commercial fleet benchmarks are not treated as guaranteed P2P owner income.
- Net annual yield and payback months remain acceptable under a downside scenario.

## 5. Vehicle and seller diligence

- VIN/chassis number, service history, damage history, and ownership documents are reviewed.
- Independent inspection or mechanic review is arranged for serious candidates.
- Recall, MOT/APK/TÜV/technical inspection status is checked.
- Financing, insurance, parking, and registration constraints are known.
- Seller payment and handover process is safe and documented.

## 6. Decision gate

Proceed only if:

- Purchase verdict is `buy-now` or a documented `negotiate` case.
- No critical data blockers remain.
- Landed cost, risk buffer, and expected rental return still meet the target.
- Manual reviewer signs off on BPM, import assumptions, and vehicle diligence.
