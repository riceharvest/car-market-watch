import { describe, expect, it } from 'vitest';
import { autoscout24LiveAdapter, marktplaatsLiveAdapter, tweedehandsLiveAdapter } from '../src/ingest/liveAdapters';
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
});
