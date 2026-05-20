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

export type IngestionSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  adapter: AdapterSource | 'live-marketplaces';
  mode: 'manual-fixture' | 'live-marketplaces';
  searchIds: string[];
  rawObservations: RawListingObservation[];
  listings: Listing[];
  notes: string[];
};
