import { describe, expect, it } from 'vitest';
import { manualFixtureAdapter } from '../src/ingest/adapters/manualFixture';
import type { SavedSearch } from '../src/types';

const golfSearch: SavedSearch = {
  id: 'test-golf-nl-de',
  label: 'Test Golf NL/DE',
  make: 'Volkswagen',
  model: 'Golf',
  countries: ['NL', 'DE'],
  minYear: 2018,
  maxMileageKm: 120000,
  maxPriceEur: 20000,
  queryUrlBySource: {},
};

describe('manualFixtureAdapter', () => {
  it('fetches raw observations from local sample listings for a saved search', async () => {
    const observations = await manualFixtureAdapter.fetchSearch(golfSearch);

    expect(manualFixtureAdapter.source).toBe('manual-fixture');
    expect(observations.length).toBeGreaterThan(0);
    expect(observations.every((observation) => observation.searchId === golfSearch.id)).toBe(true);
    expect(observations.every((observation) => observation.payload.make === 'Volkswagen')).toBe(true);
    expect(observations.every((observation) => observation.payload.model === 'Golf')).toBe(true);
    expect(observations.every((observation) => golfSearch.countries.includes(observation.payload.country))).toBe(true);
  });

  it('normalizes a raw manual observation back to the Listing shape', async () => {
    const [observation] = await manualFixtureAdapter.fetchSearch(golfSearch);

    expect(observation).toBeDefined();
    const normalized = manualFixtureAdapter.normalize(observation!);

    expect(normalized.id).toBe(observation!.sourceListingId);
    expect(normalized.source).toBe(observation!.source);
    expect(normalized.url).toBe(observation!.url);
    expect(normalized.priceEur).toBeGreaterThan(0);
    expect(normalized.mileageKm).toBeGreaterThan(0);
    expect(normalized.confidence).toMatch(/^(low|medium|high)$/);
  });
});
