import type { Listing, PurchaseDecision, Valuation } from '../../types';
import type { ApiAuthBoundary, ListingFilters, ListingsQuery, ListingWithEconomics, PaginatedListingsResponse } from '../contracts';
import { statement, type QueryExecutor, type SQLStatement, type SQLValue } from './sql';

const FILTER_COLUMN_BY_KEY: Partial<Record<keyof ListingFilters, string>> = {
  source: 'l.source',
  country: 'l.country',
  make: 'l.make',
  model: 'l.model',
  fuel: 'l.fuel',
  transmission: 'l.transmission',
  sellerType: 'l.seller_type',
  confidence: 'l.confidence',
  verdict: 'latest_valuation.verdict',
};

const SORT_COLUMN_BY_FIELD: Record<ListingsQuery['sort']['field'], string> = {
  lastSeen: 'l.last_seen_at',
  firstSeen: 'l.first_seen_at',
  priceEur: 'l.price_eur',
  mileageKm: 'l.mileage_km',
  year: 'l.registration_year',
  dealScore: 'latest_valuation.deal_score',
};

export function buildListingsWhereClause(filters: ListingFilters): SQLStatement {
  const clauses: string[] = [];
  const values: SQLValue[] = [];

  function addParamClause(sqlTemplate: (placeholder: string) => string, value: SQLValue): void {
    values.push(value);
    clauses.push(sqlTemplate(`$${values.length}`));
  }

  for (const key of ['source', 'country', 'make', 'model', 'fuel', 'transmission', 'sellerType', 'confidence', 'verdict'] as const) {
    const value = filters[key];
    const column = FILTER_COLUMN_BY_KEY[key];
    if (value !== undefined && column !== undefined) {
      addParamClause((placeholder) => `${column} = ${placeholder}`, value);
    }
  }

  if (filters.minYear !== undefined) addParamClause((placeholder) => `l.registration_year >= ${placeholder}`, filters.minYear);
  if (filters.maxYear !== undefined) addParamClause((placeholder) => `l.registration_year <= ${placeholder}`, filters.maxYear);
  if (filters.minPriceEur !== undefined) addParamClause((placeholder) => `l.price_eur >= ${placeholder}`, filters.minPriceEur);
  if (filters.maxPriceEur !== undefined) addParamClause((placeholder) => `l.price_eur <= ${placeholder}`, filters.maxPriceEur);
  if (filters.minMileageKm !== undefined) addParamClause((placeholder) => `l.mileage_km >= ${placeholder}`, filters.minMileageKm);
  if (filters.maxMileageKm !== undefined) addParamClause((placeholder) => `l.mileage_km <= ${placeholder}`, filters.maxMileageKm);
  if (filters.query !== undefined) {
    addParamClause(
      (placeholder) => `(l.title ilike ${placeholder} or l.make ilike ${placeholder} or l.model ilike ${placeholder} or l.location ilike ${placeholder})`,
      `%${filters.query}%`,
    );
  }

  return statement(clauses.length > 0 ? ` where ${clauses.join(' and ')}` : '', values);
}

export function createListingRepository(db: QueryExecutor) {
  return {
    async listListings(query: ListingsQuery, _auth: ApiAuthBoundary): Promise<PaginatedListingsResponse> {
      const where = buildListingsWhereClause(query.filters);
      const countRows = await db.execute<{ total: number | string }>(statement(`select count(*)::int as total from listings l ${valuationJoin()}${where.text}`, where.values));
      const total = Number(countRows[0]?.total ?? 0);
      const offset = (query.page - 1) * query.pageSize;
      const orderColumn = SORT_COLUMN_BY_FIELD[query.sort.field];
      const direction = query.sort.direction === 'asc' ? 'asc' : 'desc';
      const limitPlaceholder = `$${where.values.length + 1}`;
      const offsetPlaceholder = `$${where.values.length + 2}`;
      const rows = await db.execute<ListingRow>(
        statement(
          `select l.*, latest_price.previous_price_eur, latest_valuation.market_median_eur, latest_valuation.comparable_count, latest_valuation.comparable_listing_ids, latest_valuation.price_delta_eur, latest_valuation.price_delta_pct, latest_valuation.days_on_market, latest_valuation.price_per_10k_km, latest_valuation.deal_score, latest_valuation.verdict
           from listings l
           ${valuationJoin()}
           left join lateral (
             select previous_price_eur from listing_price_history ph where ph.listing_id = l.id order by ph.observed_at desc limit 1
           ) latest_price on true
           ${where.text}
           order by ${orderColumn} ${direction} nulls last, l.id asc
           limit ${limitPlaceholder} offset ${offsetPlaceholder}`,
          [...where.values, query.pageSize, offset],
        ),
      );

      return {
        data: rows.map(mapListingRow),
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
        generatedAt: new Date().toISOString(),
        filters: query.filters,
        sort: query.sort,
      };
    },
  };
}

function valuationJoin(): string {
  return `left join lateral (
    select market_median_eur, comparable_count, comparable_listing_ids, price_delta_eur, price_delta_pct, days_on_market, price_per_10k_km, deal_score, verdict
    from valuations v where v.listing_id = l.id order by v.generated_at desc limit 1
  ) latest_valuation on true`;
}

type ListingRow = {
  id: string;
  source: Listing['source'];
  source_listing_id: string;
  country: Listing['country'];
  canonical_url: string;
  title: string;
  make: string;
  model: string;
  trim?: string | null;
  price_eur: number;
  mileage_km: number;
  registration_year: number;
  fuel: Listing['fuel'];
  transmission: Listing['transmission'];
  location: string;
  seller_type: Listing['sellerType'];
  first_seen_at: string;
  last_seen_at: string;
  previous_price_eur?: number | null;
  co2_g_per_km?: number | null;
  first_registration_date?: string | null;
  confidence: Listing['confidence'];
  notes?: string | null;
  market_median_eur?: number | null;
  comparable_count?: number | null;
  comparable_listing_ids?: string[] | null;
  price_delta_eur?: number | null;
  price_delta_pct?: number | string | null;
  days_on_market?: number | null;
  price_per_10k_km?: number | string | null;
  deal_score?: number | null;
  verdict?: Valuation['verdict'] | null;
};

function mapListingRow(row: ListingRow): ListingWithEconomics {
  const listing: ListingWithEconomics = {
    id: `${row.source}:${row.source_listing_id}`,
    source: row.source,
    country: row.country,
    url: row.canonical_url,
    title: row.title,
    make: row.make,
    model: row.model,
    priceEur: Number(row.price_eur),
    mileageKm: Number(row.mileage_km),
    year: Number(row.registration_year),
    fuel: row.fuel,
    transmission: row.transmission,
    location: row.location,
    sellerType: row.seller_type,
    firstSeen: toIso(row.first_seen_at),
    lastSeen: toIso(row.last_seen_at),
    confidence: row.confidence,
  };
  if (row.trim) listing.trim = row.trim;
  if (row.previous_price_eur !== null && row.previous_price_eur !== undefined) listing.previousPriceEur = Number(row.previous_price_eur);
  if (row.co2_g_per_km !== null && row.co2_g_per_km !== undefined) listing.co2GPerKm = Number(row.co2_g_per_km);
  if (row.first_registration_date) listing.firstRegistrationDate = row.first_registration_date;
  if (row.notes) listing.notes = row.notes;
  if (row.market_median_eur !== null && row.market_median_eur !== undefined && row.verdict) {
    listing.valuation = {
      marketMedianEur: Number(row.market_median_eur),
      comparableCount: Number(row.comparable_count ?? 0),
      comparableIds: row.comparable_listing_ids ?? [],
      priceDeltaEur: Number(row.price_delta_eur ?? 0),
      priceDeltaPct: Number(row.price_delta_pct ?? 0),
      daysOnMarket: Number(row.days_on_market ?? 0),
      pricePer10kKm: Number(row.price_per_10k_km ?? 0),
      dealScore: Number(row.deal_score ?? 0),
      verdict: row.verdict,
    } satisfies Valuation;
  }
  return listing;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
