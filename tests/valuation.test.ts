import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/types';
import { buildMarketSnapshot } from '../src/domain/snapshot';
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

describe('market snapshot generation', () => {
  it('emits live-ready static snapshot shape with normalized valuations', () => {
    const snapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T12:00:00.000Z', listings: [baseListing] });

    expect(snapshot.schemaVersion).toBe(1);
    expect(snapshot.generatedAt).toBe('2026-05-20T12:00:00.000Z');
    expect(snapshot.summary.listingCount).toBe(1);
    expect(snapshot.summary.sourceCount).toBeGreaterThanOrEqual(5);
    expect(snapshot.sources[0]).toEqual(expect.objectContaining({ id: expect.any(String), robotsNote: expect.any(String) }));
    expect(snapshot.savedSearches.length).toBeGreaterThan(0);
    expect(snapshot.alertRules.length).toBeGreaterThan(0);
    expect(snapshot.watchlist.length).toBeGreaterThan(0);
    expect(snapshot.valuations).toHaveLength(1);
    expect(snapshot.valuations[0]).toEqual(
      expect.objectContaining({
        listingId: 'target',
        source: 'autoscout24',
        valuation: expect.objectContaining({ comparableCount: 1, comparableIds: ['target'] }),
      }),
    );
  });
});
