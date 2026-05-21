import type { Listing, MarketSource, SavedSearch } from '../types';

export type AdapterSource = MarketSource | 'manual-fixture';

export type RawListingObservation = {
  source: MarketSource;
  sourceListingId: string;
  observedAt: string;
  searchId?: string;
  url: string;
  payload: Record<string, unknown>;
};

export type ListingAdapter<TRaw extends RawListingObservation = RawListingObservation> = {
  source: AdapterSource;
  fetchSearch(search: SavedSearch): Promise<TRaw[]>;
  normalize(raw: TRaw): Listing;
};

export type IngestionSourceStatus = {
  source: AdapterSource;
  status: 'enabled' | 'disabled' | 'blocked' | 'error' | 'skipped' | 'not-configured';
  reason?: string;
};

export type IngestionCountBreakdown = {
  rawObservationCount: number;
  listingCount: number;
  errorCount: number;
};

export type IngestionRunMetadata = {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  pageCountConfig: {
    requested: number | null;
    effective: number;
    max: number;
  };
  requestDelayConfig: {
    requestedMs: number | null;
    effectiveMs: number;
  };
  totalRawObservationCount: number;
  totalListingCount: number;
  sourceBreakdown: Record<string, IngestionCountBreakdown & { status: IngestionSourceStatus['status'] }>;
  searchBreakdown: Record<string, IngestionCountBreakdown>;
  errors: string[];
  notes: string[];
  sourceStatuses: IngestionSourceStatus[];
  sourceStatusSummary: Record<IngestionSourceStatus['status'], number>;
};

export type IngestionSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  adapter: AdapterSource | 'live-marketplaces';
  mode: 'manual-fixture' | 'live-marketplaces';
  searchIds: string[];
  rawObservations: RawListingObservation[];
  listings: Listing[];
  notes: string[];
  run: IngestionRunMetadata;
};
