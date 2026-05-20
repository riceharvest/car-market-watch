import { describe, expect, it } from 'vitest';
import { savedSearches } from '../src/data/searches';
import { autoscout24LiveAdapter, buildPaginatedSearchUrls, isSearchMatchForLiveListing, marktplaatsLiveAdapter, tweedehandsLiveAdapter } from '../src/ingest/liveAdapters';
import type { SavedSearch } from '../src/types';

const search: SavedSearch = {
  id: 'live-parser-test',
  label: 'Parser fixture',
  make: 'Volkswagen',
  model: 'Golf',
  countries: ['NL', 'BE'],
  minYear: 2018,
  maxPriceEur: 30000,
  maxMileageKm: 140000,
  queryUrlBySource: {},
};

describe('live marketplace parsers', () => {
  it('normalizes adapter observations into listing shape', () => {
    const observedAt = '2026-05-20T12:00:00.000Z';
    const raw = {
      source: 'autoscout24' as const,
      sourceListingId: 'abc',
      observedAt,
      searchId: search.id,
      url: 'https://www.autoscout24.nl/aanbod/abc',
      payload: {
        title: 'Volkswagen Golf 1.5 TSI',
        make: 'Volkswagen',
        model: 'Golf',
        priceEur: 19950,
        mileageKm: 82000,
        year: 2020,
        fuel: 'petrol' as const,
        transmission: 'automatic' as const,
        location: 'Amsterdam',
        country: 'NL' as const,
        sellerType: 'dealer' as const,
        firstRegistrationDate: '2020-01-01',
      },
    };

    expect(autoscout24LiveAdapter.normalize(raw)).toEqual(
      expect.objectContaining({
        id: 'autoscout24-abc',
        source: 'autoscout24',
        country: 'NL',
        priceEur: 19950,
        confidence: 'high',
      }),
    );
  });

  it('exposes allowlisted live adapters for currently reachable sources', () => {
    expect([autoscout24LiveAdapter.source, marktplaatsLiveAdapter.source, tweedehandsLiveAdapter.source]).toEqual([
      'autoscout24',
      'marktplaats',
      '2dehands',
    ]);
  });

  it('expands reachable marketplace searches across multiple result pages', () => {
    expect(buildPaginatedSearchUrls('autoscout24', 'https://www.autoscout24.nl/lst/volkswagen/golf?atype=C&cy=NL', 3)).toEqual([
      'https://www.autoscout24.nl/lst/volkswagen/golf?atype=C&cy=NL',
      'https://www.autoscout24.nl/lst/volkswagen/golf?atype=C&cy=NL&page=2',
      'https://www.autoscout24.nl/lst/volkswagen/golf?atype=C&cy=NL&page=3',
    ]);
    expect(buildPaginatedSearchUrls('marktplaats', 'https://www.marktplaats.nl/l/auto-s/volkswagen/q/golf/', 3)).toEqual([
      'https://www.marktplaats.nl/l/auto-s/volkswagen/q/golf/',
      'https://www.marktplaats.nl/l/auto-s/volkswagen/q/golf/p/2/',
      'https://www.marktplaats.nl/l/auto-s/volkswagen/q/golf/p/3/',
    ]);
    expect(buildPaginatedSearchUrls('2dehands', 'https://www.2dehands.be/l/auto-s/volkswagen/q/golf/', 2)).toEqual([
      'https://www.2dehands.be/l/auto-s/volkswagen/q/golf/',
      'https://www.2dehands.be/l/auto-s/volkswagen/q/golf/p/2/',
    ]);
  });

  it('rejects implausible placeholder prices from marketplace payloads', () => {
    expect(
      isSearchMatchForLiveListing(
        {
          title: 'Volkswagen Golf placeholder',
          make: 'Volkswagen',
          model: 'Golf',
          priceEur: 1,
          mileageKm: 90000,
          year: 2019,
          fuel: 'petrol',
          transmission: 'manual',
          location: 'Amsterdam',
          country: 'NL',
          sellerType: 'dealer',
        },
        search,
      ),
    ).toBe(false);
  });

  it('tracks a broad enough live search set to produce useful market coverage', () => {
    expect(savedSearches.length).toBeGreaterThanOrEqual(8);
    expect(new Set(savedSearches.map((item) => item.model)).size).toBeGreaterThanOrEqual(6);
  });
});
