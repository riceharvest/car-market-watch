import { describe, expect, it } from 'vitest';
import type { Listing, RentalComparable } from '../src/types';
import { buildMarketSnapshot } from '../src/domain/snapshot';
import { comparableRentalComps, estimateRentalRevenue, inferVehicleClass } from '../src/domain/rentalRevenue';
import { comparableListings, daysBetween, median, valueListing } from '../src/domain/valuation';

const baseListing: Listing = {
  id: 'target',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/target',
  title: 'Volkswagen Golf target',
  make: 'Volkswagen',
  model: 'Golf',
  priceEur: 18000,
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

function rentalComp(overrides: Partial<RentalComparable>): RentalComparable {
  return {
    id: 'rent-comp',
    source: 'snappcar',
    sourceType: 'peer-to-peer',
    country: 'NL',
    city: 'Utrecht',
    dailyRateEur: 50,
    vehicleClass: 'compact',
    anchors: {
      make: 'Volkswagen',
      model: 'Golf',
      fuel: 'petrol',
      transmission: 'automatic',
      year: 2020,
      mileageBandKm: { min: 70000, max: 110000 },
    },
    confidence: 'medium',
    availabilityNote: 'Test availability note',
    feesNote: 'Test fees note',
    observedAt: '2026-05-20',
    ...overrides,
  };
}

describe('valuation math', () => {
  it('calculates medians for odd, even, and empty inputs', () => {
    expect(median([300, 100, 200])).toBe(200);
    expect(median([100, 200, 500, 900])).toBe(350);
    expect(median([])).toBe(0);
  });

  it('selects comparables by same make/model, close year, close mileage, and compatible fuel', () => {
    const close = listing({ id: 'close', priceEur: 18100, year: 2019, mileageKm: 100000 });
    const wrongModel = listing({ id: 'wrong-model', model: 'Polo' });
    const tooOld = listing({ id: 'too-old', year: 2016 });
    const tooManyKm = listing({ id: 'too-many-km', mileageKm: 150001 });
    const diesel = listing({ id: 'diesel', fuel: 'diesel' });

    expect(comparableListings(baseListing, [close, wrongModel, tooOld, tooManyKm, diesel]).map((item) => item.id)).toEqual(['close']);
  });

  it('counts days on market inclusively by date difference floor guard', () => {
    expect(daysBetween('2026-05-01', '2026-05-20')).toBe(19);
    expect(daysBetween('2026-05-20', '2026-05-01')).toBe(0);
  });

  it('produces undervalued, fair, expensive, and watch verdicts', () => {
    const comps = [
      listing({ id: 'c1', priceEur: 10000 }),
      listing({ id: 'c2', priceEur: 12000 }),
      listing({ id: 'c3', priceEur: 14000 }),
    ];

    expect(valueListing(listing({ id: 'cheap', priceEur: 8000 }), comps, '2026-05-20').verdict).toBe('undervalued');
    expect(valueListing(listing({ id: 'fair', priceEur: 12100 }), comps, '2026-05-20').verdict).toBe('fair');
    expect(valueListing(listing({ id: 'expensive', priceEur: 15000 }), comps, '2026-05-20').verdict).toBe('expensive');
    expect(valueListing(listing({ id: 'stale', priceEur: 12100, firstSeen: '2026-03-01' }), comps, '2026-05-20').verdict).toBe('watch');
  });
});

describe('rental revenue model', () => {
  it('infers compact rental class and selects close rental comps', () => {
    const close = rentalComp({ id: 'close', dailyRateEur: 50 });
    const benchmark = rentalComp({ id: 'benchmark', source: 'greenwheels', sourceType: 'car-sharing', dailyRateEur: 47, anchors: { fuel: 'unknown', transmission: 'unknown', year: 2020, mileageBandKm: { min: 0, max: 120000 } } });
    const wrongCountry = rentalComp({ id: 'fr-paris', country: 'FR', city: 'Paris', dailyRateEur: 90 });

    expect(inferVehicleClass(baseListing)).toBe('compact');
    expect(comparableRentalComps(baseListing, [wrongCountry, benchmark, close]).map((comp) => comp.id)).toEqual(['close', 'benchmark']);
  });

  it('estimates gross rental revenue and yield from adjusted comparable daily rates', () => {
    const comps = [
      rentalComp({ id: 'c1', dailyRateEur: 48, confidence: 'high' }),
      rentalComp({ id: 'c2', dailyRateEur: 52, city: 'Amsterdam' }),
      rentalComp({ id: 'c3', dailyRateEur: 50, anchors: { make: 'Volkswagen', model: 'Golf', fuel: 'petrol', transmission: 'manual', year: 2020, mileageBandKm: { min: 70000, max: 110000 } } }),
    ];

    const estimate = estimateRentalRevenue(baseListing, comps, {
      weeklyBookedDays: 3,
      monthlyBookedDays: 12,
      annualBookedDays: 120,
    });

    expect(estimate.listingId).toBe('target');
    expect(estimate.compCount).toBe(3);
    expect(estimate.estimatedDailyRentEur).toBeGreaterThanOrEqual(48);
    expect(estimate.weeklyGrossEur).toBe(estimate.estimatedDailyRentEur * 3);
    expect(estimate.monthlyGrossEur).toBe(estimate.estimatedDailyRentEur * 12);
    expect(estimate.annualGrossEur).toBe(estimate.estimatedDailyRentEur * 120);
    expect(estimate.annualYieldPct).toBeCloseTo((estimate.annualGrossEur / baseListing.priceEur) * 100, 1);
    expect(estimate.confidence).toBe('high');
    expect(estimate.basisNotes.join(' ')).toContain('platform commission');
  });

  it('returns a low-confidence zero estimate when no rental comps match', () => {
    const estimate = estimateRentalRevenue(baseListing, [rentalComp({ id: 'suv', vehicleClass: 'suv', anchors: { fuel: 'diesel', transmission: 'manual', year: 2012, mileageBandKm: { min: 200000, max: 260000 } } })]);

    expect(estimate.estimatedDailyRentEur).toBe(0);
    expect(estimate.compCount).toBe(0);
    expect(estimate.confidence).toBe('low');
  });
});

describe('market snapshot generation', () => {
  it('emits live-ready static snapshot shape with normalized valuations', () => {
    const snapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T12:00:00.000Z', listings: [baseListing] });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.generatedAt).toBe('2026-05-20T12:00:00.000Z');
    expect(snapshot.summary.listingCount).toBe(1);
    expect(snapshot.summary.sourceCount).toBeGreaterThanOrEqual(5);
    expect(snapshot.summary.rentalCompCount).toBeGreaterThan(0);
    expect(snapshot.summary.rentalEstimateCount).toBe(1);
    expect(snapshot.summary.bestRentalYieldListingId).toBe('target');
    expect(snapshot.sources[0]).toEqual(expect.objectContaining({ id: expect.any(String), robotsNote: expect.any(String) }));
    expect(snapshot.rentalSources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'snappcar', scrapePriority: 'primary', feasibilityNote: expect.stringContaining('No open public API') }),
        expect.objectContaining({ id: 'getaround', scrapePriority: 'skip', access: 'paid-data-provider' }),
        expect.objectContaining({ id: 'turo', scrapePriority: 'skip', access: 'skip-scraping' }),
      ]),
    );
    expect(snapshot.rentalComps[0]).toEqual(
      expect.objectContaining({
        dailyRateEur: expect.any(Number),
        anchors: expect.objectContaining({ mileageBandKm: expect.objectContaining({ min: expect.any(Number), max: expect.any(Number) }) }),
      }),
    );
    expect(snapshot.savedSearches.length).toBeGreaterThan(0);
    expect(snapshot.alertRules.length).toBeGreaterThan(0);
    expect(snapshot.watchlist.length).toBeGreaterThan(0);
    expect(snapshot.valuations).toHaveLength(1);
    expect(snapshot.rentalEstimates).toHaveLength(1);
    expect(snapshot.rentalEstimates[0]).toEqual(
      expect.objectContaining({
        listingId: 'target',
        estimatedDailyRentEur: expect.any(Number),
        annualYieldPct: expect.any(Number),
        compCount: expect.any(Number),
        basisNotes: expect.arrayContaining([expect.stringContaining('Matched')]),
      }),
    );
    expect(snapshot.valuations[0]).toEqual(
      expect.objectContaining({
        listingId: 'target',
        source: 'autoscout24',
        valuation: expect.objectContaining({ comparableCount: 1, comparableIds: ['target'] }),
      }),
    );
  });
});
