import { describe, expect, it } from 'vitest';
import { buildDataQualityReport } from '../src/domain/dataQuality';
import { estimateImportCost } from '../src/domain/importCost';
import { decidePurchase } from '../src/domain/purchaseDecision';
import type { Listing, NetRentalEstimate, RentalEstimate } from '../src/types';

const baseListing: Listing = {
  id: 'target',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/target',
  title: 'Volkswagen Golf target',
  make: 'Volkswagen',
  model: 'Golf',
  priceEur: 15000,
  mileageKm: 90000,
  year: 2020,
  fuel: 'petrol',
  transmission: 'automatic',
  location: 'Utrecht',
  sellerType: 'dealer',
  firstSeen: '2026-05-01',
  lastSeen: '2026-05-20',
  confidence: 'high',
};

function listing(overrides: Partial<Listing>): Listing {
  return { ...baseListing, ...overrides };
}

function rentalEstimate(listingId: string, overrides: Partial<RentalEstimate> = {}): RentalEstimate {
  return {
    listingId,
    estimatedDailyRentEur: 60,
    weeklyGrossEur: 180,
    monthlyGrossEur: 720,
    annualGrossEur: 7200,
    annualYieldPct: 40,
    utilizationAssumptions: { weeklyBookedDays: 3, monthlyBookedDays: 12, annualBookedDays: 120 },
    confidence: 'high',
    compCount: 3,
    comparableIds: ['r1', 'r2', 'r3'],
    basisNotes: ['test rental basis'],
    ...overrides,
  };
}

function netRentalEstimate(listingId: string, landedCostEur: number, netAnnualRentalEur = 3000): NetRentalEstimate {
  return {
    listingId,
    annualGrossEur: 7200,
    monthlyGrossEur: 720,
    platformFeesEur: 1080,
    insuranceEur: 720,
    cleaningEur: 960,
    maintenanceReserveEur: 576,
    taxReserveEur: 864,
    downtimeReserveEur: 576,
    netAnnualRentalEur,
    netMonthlyRentalEur: Math.round(netAnnualRentalEur / 12),
    netRentalYieldOnLandedCostPct: Math.round((netAnnualRentalEur / landedCostEur) * 1000) / 10,
    landedCostEur,
    assumptions: {
      platformFeePct: 15,
      insuranceMonthlyEur: 60,
      cleaningPerBookingEur: 20,
      maintenanceReservePct: 8,
      taxReservePct: 12,
      downtimeReservePct: 8,
      averageBookingsPerMonth: 4,
    },
  };
}

function decideFor(target: Listing, allListings: Listing[], rentalOverrides: Partial<RentalEstimate> = {}) {
  const importEstimate = estimateImportCost(target);
  const gross = rentalEstimate(target.id, rentalOverrides);
  const net = netRentalEstimate(target.id, importEstimate.landedCostEur);
  const quality = buildDataQualityReport(target, { importEstimate, rentalEstimate: gross });
  return decidePurchase({
    listing: target,
    listings: allListings,
    importEstimate,
    rentalEstimate: gross,
    netRentalEstimate: net,
    dataQualityReport: quality,
  });
}

describe('purchase decision engine', () => {
  it('marks a strong domestic candidate as buy-now/negotiate with explainable reasons', () => {
    const target = listing({ id: 'cheap-nl-golf', priceEur: 15000 });
    const comps = [
      target,
      listing({ id: 'nl-comp-1', priceEur: 20000, mileageKm: 91000 }),
      listing({ id: 'nl-comp-2', priceEur: 21000, mileageKm: 88000 }),
      listing({ id: 'nl-comp-3', priceEur: 20500, mileageKm: 93000 }),
    ];

    const decision = decideFor(target, comps);

    expect(['buy-now', 'negotiate']).toContain(decision.verdict);
    expect(decision.purchaseScore).toBeGreaterThanOrEqual(62);
    expect(decision.reasons.join(' ')).toContain('below Dutch market median');
    expect(decision.reasons.join(' ')).toContain('Net rental yield');
    expect(decision.blockers).toEqual([]);
  });

  it('marks an imported candidate missing BPM input as needs-data with blocker', () => {
    const target = listing({ id: 'de-missing-bpm', country: 'DE', source: 'mobile-de-api', priceEur: 12000, location: 'Köln' });
    const comps = [
      target,
      listing({ id: 'nl-comp-1', priceEur: 20000, mileageKm: 91000 }),
      listing({ id: 'nl-comp-2', priceEur: 21000, mileageKm: 88000 }),
    ];

    const decision = decideFor(target, comps);

    expect(decision.verdict).toBe('needs-data');
    expect(decision.blockers.join(' ')).toContain('Manual BPM input required');
    expect(decision.blockers.join(' ')).toContain('CO2 or BPM override for import');
  });

  it('does not allow a massive discount to override missing manual BPM data', () => {
    const target = listing({ id: 'de-too-cheap-missing-bpm', country: 'DE', source: 'mobile-de-api', priceEur: 5000, location: 'Köln' });
    const comps = [
      target,
      listing({ id: 'nl-comp-1', priceEur: 22000, mileageKm: 91000 }),
      listing({ id: 'nl-comp-2', priceEur: 23000, mileageKm: 88000 }),
      listing({ id: 'nl-comp-3', priceEur: 22500, mileageKm: 93000 }),
    ];

    const decision = decideFor(target, comps);

    expect(decision.landedCostDeltaToDutchMarketPct).toBeLessThan(-25);
    expect(decision.verdict).toBe('needs-data');
    expect(decision.blockers.join(' ')).toContain('Manual BPM input required');
  });

  it('marks a high landed cost candidate as avoid', () => {
    const target = listing({ id: 'expensive-nl-golf', priceEur: 23000 });
    const comps = [
      target,
      listing({ id: 'nl-comp-1', priceEur: 20000, mileageKm: 91000 }),
      listing({ id: 'nl-comp-2', priceEur: 21000, mileageKm: 88000 }),
    ];

    const decision = decideFor(target, comps);

    expect(decision.verdict).toBe('avoid');
    expect(decision.blockers.join(' ')).toContain('more than 5% above Dutch market median');
  });
});
