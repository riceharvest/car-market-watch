export type MarketSource =
  | 'autoscout24'
  | 'gaspedaal'
  | 'marktplaats'
  | '2dehands'
  | 'kleinanzeigen'
  | 'mobile-de-api';

export type RentalSource =
  | 'snappcar'
  | 'getaround'
  | 'turo'
  | 'mywheels'
  | 'greenwheels'
  | 'sixt'
  | 'europcar'
  | 'hertz'
  | 'avis';

export type Confidence = 'low' | 'medium' | 'high';

export type CountryCode = 'NL' | 'BE' | 'DE' | 'FR';

export type FuelType = 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'unknown';

export type Transmission = 'manual' | 'automatic' | 'unknown';

export type SellerType = 'dealer' | 'private' | 'unknown';

export type DealVerdict = 'undervalued' | 'fair' | 'expensive' | 'watch';

export type VehicleClass = 'mini' | 'compact' | 'midsize' | 'estate' | 'suv' | 'van' | 'premium';

export type SourceMetadata = {
  id: MarketSource;
  label: string;
  baseUrl: string;
  countries: CountryCode[];
  access: 'html-smoke' | 'aggregator' | 'api' | 'manual';
  cadenceHours: number;
  robotsNote: string;
  fields: Array<keyof Listing>;
  reliability: Confidence;
};

export type RentalSourceMetadata = {
  id: RentalSource;
  label: string;
  baseUrl: string;
  countries: CountryCode[];
  sourceType: 'peer-to-peer' | 'car-sharing' | 'commercial-fleet';
  access: 'city-page-html' | 'api-partner' | 'paid-data-provider' | 'manual' | 'skip-scraping';
  scrapePriority: 'primary' | 'benchmark' | 'skip';
  cadenceHours?: number;
  robotsNote: string;
  feasibilityNote: string;
  reliability: Confidence;
};

export type Listing = {
  id: string;
  source: MarketSource;
  country: CountryCode;
  url: string;
  title: string;
  make: string;
  model: string;
  trim?: string;
  priceEur: number;
  mileageKm: number;
  year: number;
  fuel: FuelType;
  transmission: Transmission;
  location: string;
  sellerType: SellerType;
  firstSeen: string;
  lastSeen: string;
  previousPriceEur?: number;
  confidence: Confidence;
  notes?: string;
};

export type Valuation = {
  marketMedianEur: number;
  comparableCount: number;
  comparableIds: string[];
  priceDeltaEur: number;
  priceDeltaPct: number;
  daysOnMarket: number;
  pricePer10kKm: number;
  dealScore: number;
  verdict: DealVerdict;
};

export type RentalComparable = {
  id: string;
  source: RentalSource;
  sourceType: RentalSourceMetadata['sourceType'];
  country: CountryCode;
  city: string;
  dailyRateEur: number;
  vehicleClass: VehicleClass;
  anchors: {
    make?: string;
    model?: string;
    fuel: FuelType;
    transmission: Transmission;
    year: number;
    mileageBandKm: {
      min: number;
      max: number;
    };
  };
  confidence: Confidence;
  availabilityNote: string;
  feesNote: string;
  observedAt: string;
};

export type RentalEstimate = {
  listingId: string;
  estimatedDailyRentEur: number;
  weeklyGrossEur: number;
  monthlyGrossEur: number;
  annualGrossEur: number;
  annualYieldPct: number;
  utilizationAssumptions: {
    weeklyBookedDays: number;
    monthlyBookedDays: number;
    annualBookedDays: number;
  };
  confidence: Confidence;
  compCount: number;
  comparableIds: string[];
  basisNotes: string[];
};

export type NormalizedValuationExport = {
  listingId: string;
  source: MarketSource;
  make: string;
  model: string;
  year: number;
  priceEur: number;
  mileageKm: number;
  valuation: Valuation;
};

export type SavedSearch = {
  id: string;
  label: string;
  make: string;
  model: string;
  countries: CountryCode[];
  minYear?: number;
  maxYear?: number;
  maxMileageKm?: number;
  minPriceEur?: number;
  maxPriceEur?: number;
  fuels?: FuelType[];
  transmissions?: Transmission[];
  sellerTypes?: SellerType[];
  queryUrlBySource: Partial<Record<MarketSource, string>>;
};

export type AlertRule = {
  id: string;
  searchId: string;
  enabled: boolean;
  label: string;
  conditions: {
    verdicts?: DealVerdict[];
    maxPriceDeltaPct?: number;
    minDealScore?: number;
    minPriceDropEur?: number;
    maxDaysOnMarket?: number;
  };
  channels: Array<'dashboard' | 'email' | 'webhook'>;
};

export type WatchlistItem = {
  id: string;
  listingId: string;
  savedSearchId: string;
  priority: 'low' | 'medium' | 'high';
  addedAt: string;
  maxBidEur?: number;
  notes?: string;
};

export type MarketSnapshot = {
  schemaVersion: 1;
  generatedAt: string;
  sources: SourceMetadata[];
  rentalSources: RentalSourceMetadata[];
  rentalComps: RentalComparable[];
  savedSearches: SavedSearch[];
  alertRules: AlertRule[];
  watchlist: WatchlistItem[];
  listings: Listing[];
  valuations: NormalizedValuationExport[];
  rentalEstimates: RentalEstimate[];
  summary: {
    listingCount: number;
    sourceCount: number;
    searchCount: number;
    watchlistCount: number;
    bestDealListingId: string | null;
    bestRentalYieldListingId: string | null;
    medianPriceEur: number;
    rentalCompCount: number;
    rentalEstimateCount: number;
  };
};
