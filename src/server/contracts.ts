import type {
  Confidence,
  CountryCode,
  DealVerdict,
  FuelType,
  Listing,
  MarketSource,
  PurchaseDecision,
  SellerType,
  Transmission,
  Valuation,
} from '../types';

export const API_ROUTES = {
  listings: '/api/listings',
  savedSearches: '/api/saved-searches',
  sourceConfigs: '/api/source-configs',
} as const;

export const DEFAULT_LISTINGS_PAGE_SIZE = 25;
export const MAX_LISTINGS_PAGE_SIZE = 100;

export type ApiAuthBoundary = {
  /** Stable user identifier from the future auth provider; never supplied by the browser as a query param. */
  userId: string;
  role: 'owner' | 'viewer';
};

export type ListingSortField = 'lastSeen' | 'firstSeen' | 'priceEur' | 'mileageKm' | 'year' | 'dealScore';
export type SortDirection = 'asc' | 'desc';

export type ListingFilters = {
  source?: MarketSource;
  country?: CountryCode;
  make?: string;
  model?: string;
  fuel?: FuelType;
  transmission?: Transmission;
  sellerType?: SellerType;
  confidence?: Confidence;
  verdict?: DealVerdict;
  minYear?: number;
  maxYear?: number;
  minPriceEur?: number;
  maxPriceEur?: number;
  minMileageKm?: number;
  maxMileageKm?: number;
  query?: string;
  savedSearchId?: string;
};

export type ListingsQuery = {
  page: number;
  pageSize: number;
  filters: ListingFilters;
  sort: {
    field: ListingSortField;
    direction: SortDirection;
  };
};

export type ListingWithEconomics = Listing & {
  valuation?: Valuation;
  purchaseDecision?: PurchaseDecision;
};

export type PaginatedListingsResponse = {
  data: ListingWithEconomics[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  generatedAt: string;
  filters: ListingFilters;
  sort: ListingsQuery['sort'];
};

export type SavedSearchContract = {
  id: string;
  name: string;
  filters: ListingFilters;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SourceConfigContract = {
  id: MarketSource;
  enabled: boolean;
  cadenceHours: number;
  robotsReviewVersion: string;
  savedSearchIds: string[];
};

type RawQuery = Record<string, string | number | boolean | null | undefined>;

const MARKET_SOURCES = ['autoscout24', 'gaspedaal', 'marktplaats', '2dehands', 'kleinanzeigen', 'mobile-de-api'] as const;
const COUNTRY_CODES = ['NL', 'BE', 'DE', 'FR'] as const;
const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'unknown'] as const;
const TRANSMISSIONS = ['manual', 'automatic', 'unknown'] as const;
const SELLER_TYPES = ['dealer', 'private', 'unknown'] as const;
const CONFIDENCE_LEVELS = ['low', 'medium', 'high'] as const;
const DEAL_VERDICTS = ['undervalued', 'fair', 'expensive', 'watch'] as const;
const SORT_FIELDS = ['lastSeen', 'firstSeen', 'priceEur', 'mileageKm', 'year', 'dealScore'] as const;
const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export function normalizeListingQuery(raw: RawQuery): ListingsQuery {
  const page = clampPositiveInt(raw.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = clampPositiveInt(raw.pageSize, DEFAULT_LISTINGS_PAGE_SIZE, MAX_LISTINGS_PAGE_SIZE);

  return {
    page,
    pageSize,
    filters: normalizeListingFilters(raw),
    sort: {
      field: pickEnum(raw.sort, SORT_FIELDS, 'lastSeen'),
      direction: pickEnum(raw.direction, SORT_DIRECTIONS, 'desc'),
    },
  };
}

function normalizeListingFilters(raw: RawQuery): ListingFilters {
  const filters: ListingFilters = {};

  assignString(filters, 'make', raw.make);
  assignString(filters, 'model', raw.model);
  assignString(filters, 'query', raw.query);
  assignString(filters, 'savedSearchId', raw.savedSearchId);

  assignNumber(filters, 'minYear', raw.minYear);
  assignNumber(filters, 'maxYear', raw.maxYear);
  assignNumber(filters, 'minPriceEur', raw.minPriceEur);
  assignNumber(filters, 'maxPriceEur', raw.maxPriceEur);
  assignNumber(filters, 'minMileageKm', raw.minMileageKm);
  assignNumber(filters, 'maxMileageKm', raw.maxMileageKm);

  filters.source = pickEnumOrUndefined(raw.source, MARKET_SOURCES);
  filters.country = pickEnumOrUndefined(raw.country, COUNTRY_CODES);
  filters.fuel = pickEnumOrUndefined(raw.fuel, FUEL_TYPES);
  filters.transmission = pickEnumOrUndefined(raw.transmission, TRANSMISSIONS);
  filters.sellerType = pickEnumOrUndefined(raw.sellerType, SELLER_TYPES);
  filters.confidence = pickEnumOrUndefined(raw.confidence, CONFIDENCE_LEVELS);
  filters.verdict = pickEnumOrUndefined(raw.verdict, DEAL_VERDICTS);

  return filters;
}

function clampPositiveInt(value: RawQuery[string], fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.min(Math.floor(parsed), max);
}

function pickEnum<const T extends readonly string[]>(value: RawQuery[string], allowed: T, fallback: T[number]): T[number] {
  return pickEnumOrUndefined(value, allowed) ?? fallback;
}

function pickEnumOrUndefined<const T extends readonly string[]>(value: RawQuery[string], allowed: T): T[number] | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  return allowed.includes(value) ? value : undefined;
}

function assignString<K extends keyof ListingFilters>(target: ListingFilters, key: K, value: RawQuery[string]): void {
  if (typeof value === 'string' && value.trim().length > 0) {
    target[key] = value.trim() as ListingFilters[K];
  }
}

function assignNumber<K extends keyof ListingFilters>(target: ListingFilters, key: K, value: RawQuery[string]): void {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    target[key] = parsed as ListingFilters[K];
  }
}
