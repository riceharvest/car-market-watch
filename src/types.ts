export type MarketSource =
  | 'autoscout24'
  | 'gaspedaal'
  | 'marktplaats'
  | '2dehands'
  | 'kleinanzeigen'
  | 'mobile-de-api';

export type Confidence = 'low' | 'medium' | 'high';

export type Listing = {
  id: string;
  source: MarketSource;
  country: 'NL' | 'BE' | 'DE' | 'FR';
  url: string;
  title: string;
  make: string;
  model: string;
  trim?: string;
  priceEur: number;
  mileageKm: number;
  year: number;
  fuel: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg' | 'unknown';
  transmission: 'manual' | 'automatic' | 'unknown';
  location: string;
  sellerType: 'dealer' | 'private' | 'unknown';
  firstSeen: string;
  lastSeen: string;
  previousPriceEur?: number;
  confidence: Confidence;
  notes?: string;
};

export type Valuation = {
  marketMedianEur: number;
  comparableCount: number;
  priceDeltaEur: number;
  priceDeltaPct: number;
  daysOnMarket: number;
  pricePer10kKm: number;
  dealScore: number;
  verdict: 'undervalued' | 'fair' | 'expensive' | 'watch';
};
