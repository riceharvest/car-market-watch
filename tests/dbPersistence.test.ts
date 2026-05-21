import { describe, expect, it } from 'vitest';
import { buildListingsWhereClause, createListingRepository } from '../src/server/db/listingRepository';
import { writeIngestionSnapshotToDb } from '../src/server/db/ingestionWriter';
import type { QueryExecutor, SQLStatement } from '../src/server/db/sql';
import type { IngestionSnapshot } from '../src/ingest/types';
import type { Listing } from '../src/types';

class FakeDb implements QueryExecutor {
  public readonly statements: SQLStatement[] = [];
  private responses: unknown[][];

  constructor(responses: unknown[][] = []) {
    this.responses = [...responses];
  }

  async execute<T = unknown>(statement: SQLStatement): Promise<T[]> {
    this.statements.push(statement);
    return (this.responses.shift() ?? []) as T[];
  }
}

const listing: Listing = {
  id: 'autoscout24:listing-123',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/listing-123',
  title: 'Toyota Yaris 1.5 Hybrid',
  make: 'Toyota',
  model: 'Yaris',
  priceEur: 12_500,
  mileageKm: 88_000,
  year: 2019,
  fuel: 'hybrid',
  transmission: 'automatic',
  location: 'Amsterdam',
  sellerType: 'dealer',
  firstSeen: '2026-01-01T00:00:00.000Z',
  lastSeen: '2026-01-02T00:00:00.000Z',
  confidence: 'high',
  notes: 'clean normalized note',
};

describe('listing SQL mapping', () => {
  it('parameterizes filter values instead of interpolating them into SQL text', () => {
    const hostileMake = "Toyota' OR 1=1 --";
    const clause = buildListingsWhereClause({
      source: 'autoscout24',
      make: hostileMake,
      minPriceEur: 10_000,
      query: "Yaris%') OR true --",
      verdict: 'undervalued',
    });

    expect(clause.text).not.toContain(hostileMake);
    expect(clause.text).not.toContain("Yaris%') OR true --");
    expect(clause.text).toContain('$1');
    expect(clause.values).toContain(hostileMake);
    expect(clause.values).toContain("%Yaris%') OR true --%");
    expect(clause.text).toContain('latest_valuation.verdict =');
  });

  it('lists rows with pagination metadata and camelCase listing fields', async () => {
    const db = new FakeDb([
      [{ total: 1 }],
      [
        {
          id: 'db-id-1',
          source: 'autoscout24',
          source_listing_id: 'listing-123',
          country: 'NL',
          canonical_url: 'https://example.test/listing-123',
          title: 'Toyota Yaris 1.5 Hybrid',
          make: 'Toyota',
          model: 'Yaris',
          trim: null,
          price_eur: 12500,
          mileage_km: 88000,
          registration_year: 2019,
          fuel: 'hybrid',
          transmission: 'automatic',
          location: 'Amsterdam',
          seller_type: 'dealer',
          first_seen_at: '2026-01-01T00:00:00.000Z',
          last_seen_at: '2026-01-02T00:00:00.000Z',
          previous_price_eur: 13000,
          co2_g_per_km: 92,
          first_registration_date: '2019-03-01',
          confidence: 'high',
          notes: null,
          market_median_eur: 14000,
          comparable_count: 5,
          comparable_listing_ids: ['other-id'],
          price_delta_eur: -1500,
          price_delta_pct: -10.71,
          days_on_market: 12,
          price_per_10k_km: 1420.45,
          deal_score: 82,
          verdict: 'undervalued',
        },
      ],
    ]);

    const response = await createListingRepository(db).listListings(
      {
        page: 2,
        pageSize: 10,
        filters: { make: 'Toyota' },
        sort: { field: 'priceEur', direction: 'asc' },
      },
      { userId: 'owner-1', role: 'owner' },
    );

    expect(response).toMatchObject({ page: 2, pageSize: 10, total: 1, totalPages: 1, filters: { make: 'Toyota' } });
    expect(response.data[0]).toMatchObject({
      id: 'autoscout24:listing-123',
      priceEur: 12500,
      mileageKm: 88000,
      year: 2019,
      sellerType: 'dealer',
      previousPriceEur: 13000,
      valuation: { dealScore: 82, verdict: 'undervalued' },
    });
    expect(db.statements[1].values).toContain(10);
  });
});

describe('ingestion DB writer scaffold', () => {
  it('creates an ingestion run, upserts sanitized listings, and writes price history only on first seen or price change', async () => {
    const changedListing = { ...listing, id: 'autoscout24:changed-1', priceEur: 11_900 };
    const unchangedListing = { ...listing, id: 'marktplaats:unchanged-1', source: 'marktplaats' as const, priceEur: 12_500 };
    const snapshot: IngestionSnapshot = {
      schemaVersion: 1,
      generatedAt: '2026-01-03T00:00:00.000Z',
      adapter: 'autoscout24',
      mode: 'live-marketplaces',
      searchIds: ['search-1'],
      rawObservations: [
        { source: 'autoscout24', sourceListingId: 'changed-1', observedAt: '2026-01-03T00:00:00.000Z', url: 'https://raw.example', payload: { secretRawHtml: '<html>' } },
      ],
      listings: [changedListing, unchangedListing],
      notes: ['ok'],
      run: {
        startedAt: '2026-01-03T00:00:00.000Z',
        finishedAt: '2026-01-03T00:01:00.000Z',
        durationMs: 60000,
        pageCountConfig: { requested: 1, effective: 1, max: 1 },
        requestDelayConfig: { requestedMs: 1000, effectiveMs: 1000 },
        totalRawObservationCount: 1,
        totalListingCount: 2,
        sourceBreakdown: {},
        searchBreakdown: {},
        errors: [],
        notes: ['ok'],
        sourceStatuses: [],
        sourceStatusSummary: { enabled: 1, disabled: 0, blocked: 0, error: 0, skipped: 0, 'not-configured': 0 },
      },
    };

    const db = new FakeDb([
      [],
      [],
      [{ id: 'run-1' }],
      [],
      [{ id: 'listing-db-1' }],
      [{ id: 'history-1' }],
      [{ id: 'listing-db-2', price_eur: 12500 }],
      [{ id: 'listing-db-2' }],
      [{ id: 'run-1' }],
    ]);

    const result = await writeIngestionSnapshotToDb(db, snapshot);

    expect(result).toMatchObject({ runId: 'run-1', listingsSeen: 2, listingsCreated: 1, listingsUpdated: 1, priceHistoryInserted: 1 });
    expect(db.statements.filter((statement) => statement.text.includes('insert into listing_price_history'))).toHaveLength(1);
    expect(db.statements.filter((statement) => statement.text.includes('insert into source_configs'))).toHaveLength(2);

    const listingUpsert = db.statements.find((statement) => statement.text.includes('insert into listings'));
    expect(listingUpsert?.values.some((value) => JSON.stringify(value).includes('secretRawHtml'))).toBe(false);
    expect(JSON.stringify(listingUpsert?.values)).toContain('priceEur');
  });
});
