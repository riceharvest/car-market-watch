import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/types';
import { clusterDuplicateListings } from '../src/domain/deduplication';

const baseListing: Listing = {
  id: 'golf-a',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/golf-a',
  title: 'Volkswagen Golf 1.5 TSI Life 2020',
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

describe('duplicate listing clustering', () => {
  it('clusters near duplicates with same model, year, mileage band, and city', () => {
    const nearDuplicate = listing({
      id: 'golf-b',
      url: 'https://example.test/golf-b',
      title: 'VW Golf 1.5 TSI Life 90.800 km',
      mileageKm: 90800,
    });
    const unrelated = listing({
      id: 'polo',
      title: 'Volkswagen Polo 1.0 TSI',
      model: 'Polo',
      mileageKm: 65000,
      year: 2021,
    });

    const clusters = clusterDuplicateListings([baseListing, unrelated, nearDuplicate]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0]).toEqual(
      expect.objectContaining({
        listingIds: ['golf-a', 'golf-b'],
        confidence: 'high',
      }),
    );
    expect(clusters[0].clusterId).toBe('dup-volkswagen-golf-2020-utrecht');
    expect(clusters[0].reasons).toEqual(expect.arrayContaining(['same model', 'same city']));
  });

  it('does not cluster listings with different mileage and year', () => {
    const tooDifferent = listing({
      id: 'older-high-km-golf',
      title: 'Volkswagen Golf 1.5 TSI Life',
      mileageKm: 145000,
      year: 2017,
      url: 'https://example.test/older-high-km-golf',
    });

    expect(clusterDuplicateListings([baseListing, tooDifferent])).toEqual([]);
  });
});
