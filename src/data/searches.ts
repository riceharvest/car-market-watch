import type { AlertRule, SavedSearch, WatchlistItem } from '../types';

export const savedSearches: SavedSearch[] = [
  {
    id: 'search-vw-golf-15-tsi-benelux',
    label: 'VW Golf 1.5 TSI Benelux value watch',
    make: 'Volkswagen',
    model: 'Golf',
    countries: ['NL', 'BE', 'DE'],
    minYear: 2018,
    maxYear: 2022,
    maxMileageKm: 130000,
    maxPriceEur: 23000,
    fuels: ['petrol', 'hybrid'],
    transmissions: ['manual', 'automatic'],
    queryUrlBySource: {
      autoscout24: 'https://www.autoscout24.nl/lst/volkswagen/golf?atype=C&cy=NL&fregfrom=2018',
      gaspedaal: 'https://www.gaspedaal.nl/zoeken?merk=volkswagen&model=golf&bmin=2018',
      marktplaats: 'https://www.marktplaats.nl/l/auto-s/volkswagen/q/golf+1.5+tsi/',
      kleinanzeigen: 'https://www.kleinanzeigen.de/s-autos/volkswagen-golf/k0c216',
    },
  },
  {
    id: 'search-toyota-corolla-hybrid-nl',
    label: 'Toyota Corolla Hybrid NL commuter',
    make: 'Toyota',
    model: 'Corolla',
    countries: ['NL'],
    minYear: 2019,
    maxMileageKm: 120000,
    maxPriceEur: 24500,
    fuels: ['hybrid'],
    transmissions: ['automatic'],
    sellerTypes: ['dealer'],
    queryUrlBySource: {
      autoscout24: 'https://www.autoscout24.nl/lst/toyota/corolla?fuel=H&fregfrom=2019',
      gaspedaal: 'https://www.gaspedaal.nl/zoeken?merk=toyota&model=corolla&brandstof=hybride',
    },
  },
];

export const alertRules: AlertRule[] = [
  {
    id: 'alert-undervalued-golf',
    searchId: 'search-vw-golf-15-tsi-benelux',
    enabled: true,
    label: 'Golf priced at least 10% under comps',
    conditions: { verdicts: ['undervalued'], maxPriceDeltaPct: -10, minDealScore: 70 },
    channels: ['dashboard'],
  },
  {
    id: 'alert-fresh-corolla',
    searchId: 'search-toyota-corolla-hybrid-nl',
    enabled: true,
    label: 'Fresh Corolla hybrid dealer listing',
    conditions: { minDealScore: 62, maxDaysOnMarket: 14 },
    channels: ['dashboard', 'email'],
  },
  {
    id: 'alert-price-drop-any-watchlist',
    searchId: 'search-vw-golf-15-tsi-benelux',
    enabled: true,
    label: 'Material price drop on watched cars',
    conditions: { minPriceDropEur: 750 },
    channels: ['dashboard', 'webhook'],
  },
];

export const watchlist: WatchlistItem[] = [
  {
    id: 'watch-as24-nl-golf-2019-001',
    listingId: 'as24-nl-golf-2019-001',
    savedSearchId: 'search-vw-golf-15-tsi-benelux',
    priority: 'high',
    addedAt: '2026-05-18T08:30:00Z',
    maxBidEur: 17250,
    notes: 'Good spec and recent price drop; verify service history.',
  },
  {
    id: 'watch-as24-nl-corolla-2020-009',
    listingId: 'as24-nl-corolla-2020-009',
    savedSearchId: 'search-toyota-corolla-hybrid-nl',
    priority: 'medium',
    addedAt: '2026-05-19T17:15:00Z',
    maxBidEur: 20500,
  },
];
