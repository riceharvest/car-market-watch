import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  API_ROUTES,
  DEFAULT_LISTINGS_PAGE_SIZE,
  MAX_LISTINGS_PAGE_SIZE,
  normalizeListingQuery,
  type PaginatedListingsResponse,
} from '../src/server/contracts';
import type { Listing } from '../src/types';

const schemaPath = resolve(dirname(fileURLToPath(import.meta.url)), '../db/schema.sql');

describe('production persistence schema scaffold', () => {
  const schema = readFileSync(schemaPath, 'utf8').toLowerCase();

  it('declares core production tables for ingestion, listings, economics, and saved searches', () => {
    for (const table of [
      'source_configs',
      'saved_searches',
      'ingestion_runs',
      'listings',
      'listing_price_history',
      'valuations',
      'purchase_decisions',
    ]) {
      expect(schema).toContain(`create table if not exists ${table}`);
    }
  });

  it('keeps listing identity, source uniqueness, and price history integrity explicit', () => {
    expect(schema).toContain('unique (source, source_listing_id)');
    expect(schema).toContain('references ingestion_runs(id)');
    expect(schema).toContain('references listings(id)');
    expect(schema).toContain('observed_at timestamptz not null');
  });
});

describe('paginated listings API contract scaffold', () => {
  it('exports stable private dashboard route names', () => {
    expect(API_ROUTES.listings).toBe('/api/listings');
    expect(API_ROUTES.savedSearches).toBe('/api/saved-searches');
  });

  it('normalizes pagination and caps page size for the future endpoint', () => {
    expect(normalizeListingQuery({ page: '0', pageSize: '999' })).toMatchObject({
      page: 1,
      pageSize: MAX_LISTINGS_PAGE_SIZE,
    });
    expect(normalizeListingQuery({})).toMatchObject({
      page: 1,
      pageSize: DEFAULT_LISTINGS_PAGE_SIZE,
    });
  });

  it('preserves typed listing filters without server dependencies', () => {
    expect(
      normalizeListingQuery({
        source: 'autoscout24',
        country: 'NL',
        make: 'Toyota',
        model: 'Yaris',
        minYear: '2018',
        maxPriceEur: '15000',
        verdict: 'undervalued',
        sort: 'priceEur',
        direction: 'asc',
      }),
    ).toMatchObject({
      filters: {
        source: 'autoscout24',
        country: 'NL',
        make: 'Toyota',
        model: 'Yaris',
        minYear: 2018,
        maxPriceEur: 15000,
        verdict: 'undervalued',
      },
      sort: { field: 'priceEur', direction: 'asc' },
    });
  });

  it('documents the response shape expected by clients', () => {
    const listing = {
      id: 'autoscout24:123',
      source: 'autoscout24',
      country: 'NL',
      url: 'https://example.com/listing/123',
      title: 'Toyota Yaris 1.5 Hybrid',
      make: 'Toyota',
      model: 'Yaris',
      priceEur: 12000,
      mileageKm: 90000,
      year: 2019,
      fuel: 'hybrid',
      transmission: 'automatic',
      location: 'Amsterdam',
      sellerType: 'dealer',
      firstSeen: '2026-05-20T00:00:00.000Z',
      lastSeen: '2026-05-21T00:00:00.000Z',
      confidence: 'high',
    } satisfies Listing;

    const response: PaginatedListingsResponse = {
      data: [listing],
      page: 1,
      pageSize: 25,
      total: 1,
      totalPages: 1,
      generatedAt: '2026-05-21T00:00:00.000Z',
      filters: {},
      sort: { field: 'lastSeen', direction: 'desc' },
    };

    expect(response.data[0].id).toBe(listing.id);
    expect(response).toHaveProperty('totalPages', 1);
    expect(response.sort.field).toBe('lastSeen');
  });
});
