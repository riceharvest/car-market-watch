import type { AlertRule, CountryCode, FuelType, SavedSearch, Transmission, WatchlistItem } from '../types';

type SearchSpec = {
  id?: string;
  label?: string;
  make: string;
  model: string;
  makeSlug: string;
  autoScoutModelSlug: string;
  marketplaceBrandSlug: string;
  marketplaceQuery: string;
  category?: 'city-car' | 'economy' | 'compact' | 'estate' | 'crossover' | 'ev' | 'premium';
  minYear?: number;
  maxYear?: number;
  maxMileageKm?: number;
  maxPriceEur?: number;
  fuels?: FuelType[];
  transmissions?: Transmission[];
  kleinanzeigenQuery?: string;
};

const countries: CountryCode[] = ['NL', 'BE', 'DE'];

const maxPriceByCategory: Record<NonNullable<SearchSpec['category']>, number> = {
  'city-car': 22000,
  economy: 28000,
  compact: 35000,
  estate: 42000,
  crossover: 42000,
  ev: 50000,
  premium: 60000,
};

function makeSearch(spec: SearchSpec): SavedSearch {
  const category = spec.category ?? 'compact';
  const minYear = spec.minYear ?? 2015;
  const bMin = `bmin=${minYear}`;
  const label = spec.label ?? `${spec.make} ${spec.model} Benelux/DE ${category} watch`;
  const idBase = `${spec.makeSlug}-${spec.autoScoutModelSlug}`.replace(/[^a-z0-9-]+/g, '-');

  return {
    id: spec.id ?? `search-${idBase}-benelux`,
    label,
    make: spec.make,
    model: spec.model,
    countries,
    minYear,
    maxYear: spec.maxYear,
    maxMileageKm: spec.maxMileageKm ?? (category === 'city-car' ? 180000 : category === 'ev' ? 250000 : 230000),
    maxPriceEur: spec.maxPriceEur ?? maxPriceByCategory[category],
    fuels: spec.fuels,
    transmissions: spec.transmissions,
    queryUrlBySource: {
      autoscout24: `https://www.autoscout24.nl/lst/${spec.makeSlug}/${spec.autoScoutModelSlug}?atype=C&cy=NL&fregfrom=${minYear}`,
      gaspedaal: `https://www.gaspedaal.nl/zoeken?merk=${spec.makeSlug}&model=${spec.autoScoutModelSlug}&${bMin}`,
      marktplaats: `https://www.marktplaats.nl/l/auto-s/${spec.marketplaceBrandSlug}/q/${spec.marketplaceQuery}/`,
      '2dehands': `https://www.2dehands.be/l/auto-s/${spec.marketplaceBrandSlug}/q/${spec.marketplaceQuery}/`,
      ...(spec.kleinanzeigenQuery ? { kleinanzeigen: `https://www.kleinanzeigen.de/s-autos/${spec.kleinanzeigenQuery}/k0c216` } : {}),
    },
  };
}

const searchSpecs: SearchSpec[] = [
  {
    id: 'search-vw-golf-15-tsi-benelux',
    label: 'VW Golf Benelux/DE broad market watch',
    make: 'Volkswagen',
    model: 'Golf',
    makeSlug: 'volkswagen',
    autoScoutModelSlug: 'golf',
    marketplaceBrandSlug: 'volkswagen',
    marketplaceQuery: 'golf',
    category: 'compact',
    maxYear: 2024,
    fuels: ['petrol', 'hybrid', 'diesel', 'electric', 'lpg', 'unknown'],
    transmissions: ['manual', 'automatic', 'unknown'],
    kleinanzeigenQuery: 'volkswagen-golf',
  },
  {
    id: 'search-toyota-corolla-hybrid-nl',
    label: 'Toyota Corolla Hybrid NL/BE/DE commuter watch',
    make: 'Toyota',
    model: 'Corolla',
    makeSlug: 'toyota',
    autoScoutModelSlug: 'corolla',
    marketplaceBrandSlug: 'toyota',
    marketplaceQuery: 'corolla',
    category: 'compact',
    minYear: 2016,
    fuels: ['hybrid', 'petrol', 'unknown'],
    transmissions: ['automatic', 'manual', 'unknown'],
  },
  { make: 'Volkswagen', model: 'Polo', makeSlug: 'volkswagen', autoScoutModelSlug: 'polo', marketplaceBrandSlug: 'volkswagen', marketplaceQuery: 'polo', category: 'economy', kleinanzeigenQuery: 'volkswagen-polo' },
  { make: 'Volkswagen', model: 'Tiguan', makeSlug: 'volkswagen', autoScoutModelSlug: 'tiguan', marketplaceBrandSlug: 'volkswagen', marketplaceQuery: 'tiguan', category: 'crossover', kleinanzeigenQuery: 'volkswagen-tiguan' },
  { make: 'Volkswagen', model: 'Up', makeSlug: 'volkswagen', autoScoutModelSlug: 'up', marketplaceBrandSlug: 'volkswagen', marketplaceQuery: 'up', category: 'city-car', kleinanzeigenQuery: 'volkswagen-up' },
  { make: 'Toyota', model: 'Yaris', makeSlug: 'toyota', autoScoutModelSlug: 'yaris', marketplaceBrandSlug: 'toyota', marketplaceQuery: 'yaris', category: 'economy' },
  { make: 'Toyota', model: 'Aygo', makeSlug: 'toyota', autoScoutModelSlug: 'aygo', marketplaceBrandSlug: 'toyota', marketplaceQuery: 'aygo', category: 'city-car' },
  { make: 'Toyota', model: 'C-HR', makeSlug: 'toyota', autoScoutModelSlug: 'c-hr', marketplaceBrandSlug: 'toyota', marketplaceQuery: 'c-hr', category: 'crossover' },
  { make: 'Toyota', model: 'RAV4', makeSlug: 'toyota', autoScoutModelSlug: 'rav-4', marketplaceBrandSlug: 'toyota', marketplaceQuery: 'rav4', category: 'crossover', maxPriceEur: 55000 },
  { make: 'Ford', model: 'Fiesta', makeSlug: 'ford', autoScoutModelSlug: 'fiesta', marketplaceBrandSlug: 'ford', marketplaceQuery: 'fiesta', category: 'economy', kleinanzeigenQuery: 'ford-fiesta' },
  { make: 'Ford', model: 'Focus', makeSlug: 'ford', autoScoutModelSlug: 'focus', marketplaceBrandSlug: 'ford', marketplaceQuery: 'focus', category: 'compact', kleinanzeigenQuery: 'ford-focus' },
  { make: 'Ford', model: 'Kuga', makeSlug: 'ford', autoScoutModelSlug: 'kuga', marketplaceBrandSlug: 'ford', marketplaceQuery: 'kuga', category: 'crossover' },
  { make: 'Renault', model: 'Clio', makeSlug: 'renault', autoScoutModelSlug: 'clio', marketplaceBrandSlug: 'renault', marketplaceQuery: 'clio', category: 'economy' },
  { make: 'Renault', model: 'Captur', makeSlug: 'renault', autoScoutModelSlug: 'captur', marketplaceBrandSlug: 'renault', marketplaceQuery: 'captur', category: 'crossover' },
  { make: 'Renault', model: 'Megane', makeSlug: 'renault', autoScoutModelSlug: 'megane', marketplaceBrandSlug: 'renault', marketplaceQuery: 'megane', category: 'compact' },
  { make: 'Peugeot', model: '208', makeSlug: 'peugeot', autoScoutModelSlug: '208', marketplaceBrandSlug: 'peugeot', marketplaceQuery: '208', category: 'economy' },
  { make: 'Peugeot', model: '2008', makeSlug: 'peugeot', autoScoutModelSlug: '2008', marketplaceBrandSlug: 'peugeot', marketplaceQuery: '2008', category: 'crossover' },
  { make: 'Peugeot', model: '308', makeSlug: 'peugeot', autoScoutModelSlug: '308', marketplaceBrandSlug: 'peugeot', marketplaceQuery: '308', category: 'compact' },
  { make: 'Opel', model: 'Corsa', makeSlug: 'opel', autoScoutModelSlug: 'corsa', marketplaceBrandSlug: 'opel', marketplaceQuery: 'corsa', category: 'economy', kleinanzeigenQuery: 'opel-corsa' },
  { make: 'Opel', model: 'Astra', makeSlug: 'opel', autoScoutModelSlug: 'astra', marketplaceBrandSlug: 'opel', marketplaceQuery: 'astra', category: 'compact', kleinanzeigenQuery: 'opel-astra' },
  { make: 'Opel', model: 'Mokka', makeSlug: 'opel', autoScoutModelSlug: 'mokka', marketplaceBrandSlug: 'opel', marketplaceQuery: 'mokka', category: 'crossover' },
  { make: 'Hyundai', model: 'i10', makeSlug: 'hyundai', autoScoutModelSlug: 'i10', marketplaceBrandSlug: 'hyundai', marketplaceQuery: 'i10', category: 'city-car' },
  { make: 'Hyundai', model: 'i20', makeSlug: 'hyundai', autoScoutModelSlug: 'i20', marketplaceBrandSlug: 'hyundai', marketplaceQuery: 'i20', category: 'economy' },
  { make: 'Hyundai', model: 'i30', makeSlug: 'hyundai', autoScoutModelSlug: 'i30', marketplaceBrandSlug: 'hyundai', marketplaceQuery: 'i30', category: 'compact' },
  { make: 'Kia', model: 'Picanto', makeSlug: 'kia', autoScoutModelSlug: 'picanto', marketplaceBrandSlug: 'kia', marketplaceQuery: 'picanto', category: 'city-car' },
  { make: 'Kia', model: 'Niro', makeSlug: 'kia', autoScoutModelSlug: 'niro', marketplaceBrandSlug: 'kia', marketplaceQuery: 'niro', category: 'crossover', fuels: ['hybrid', 'electric', 'unknown'] },
  { make: 'Kia', model: 'Ceed', makeSlug: 'kia', autoScoutModelSlug: 'ceed', marketplaceBrandSlug: 'kia', marketplaceQuery: 'ceed', category: 'compact' },
  { make: 'Nissan', model: 'Qashqai', makeSlug: 'nissan', autoScoutModelSlug: 'qashqai', marketplaceBrandSlug: 'nissan', marketplaceQuery: 'qashqai', category: 'crossover' },
  { make: 'Nissan', model: 'Micra', makeSlug: 'nissan', autoScoutModelSlug: 'micra', marketplaceBrandSlug: 'nissan', marketplaceQuery: 'micra', category: 'city-car' },
  { make: 'Nissan', model: 'Leaf', makeSlug: 'nissan', autoScoutModelSlug: 'leaf', marketplaceBrandSlug: 'nissan', marketplaceQuery: 'leaf', category: 'ev', fuels: ['electric', 'unknown'], transmissions: ['automatic', 'unknown'] },
  { make: 'Tesla', model: 'Model 3', makeSlug: 'tesla', autoScoutModelSlug: 'model-3', marketplaceBrandSlug: 'tesla', marketplaceQuery: 'model+3', category: 'ev', minYear: 2019, fuels: ['electric', 'unknown'], transmissions: ['automatic', 'unknown'] },
  { make: 'Skoda', model: 'Fabia', makeSlug: 'skoda', autoScoutModelSlug: 'fabia', marketplaceBrandSlug: 'skoda', marketplaceQuery: 'fabia', category: 'economy' },
  { make: 'Skoda', model: 'Octavia', makeSlug: 'skoda', autoScoutModelSlug: 'octavia', marketplaceBrandSlug: 'skoda', marketplaceQuery: 'octavia', category: 'estate' },
  { make: 'Seat', model: 'Ibiza', makeSlug: 'seat', autoScoutModelSlug: 'ibiza', marketplaceBrandSlug: 'seat', marketplaceQuery: 'ibiza', category: 'economy' },
  { make: 'Seat', model: 'Leon', makeSlug: 'seat', autoScoutModelSlug: 'leon', marketplaceBrandSlug: 'seat', marketplaceQuery: 'leon', category: 'compact' },
  { make: 'Mazda', model: '2', makeSlug: 'mazda', autoScoutModelSlug: '2', marketplaceBrandSlug: 'mazda', marketplaceQuery: '2', category: 'economy' },
  { make: 'Mazda', model: '3', makeSlug: 'mazda', autoScoutModelSlug: '3', marketplaceBrandSlug: 'mazda', marketplaceQuery: '3', category: 'compact' },
  { make: 'Mazda', model: 'CX-5', makeSlug: 'mazda', autoScoutModelSlug: 'cx-5', marketplaceBrandSlug: 'mazda', marketplaceQuery: 'cx-5', category: 'crossover' },
  { make: 'Citroen', model: 'C3', makeSlug: 'citroen', autoScoutModelSlug: 'c3', marketplaceBrandSlug: 'citroen', marketplaceQuery: 'c3', category: 'economy' },
  { make: 'BMW', model: '1 Serie', makeSlug: 'bmw', autoScoutModelSlug: '1-serie', marketplaceBrandSlug: 'bmw', marketplaceQuery: '1+serie', category: 'premium', maxPriceEur: 50000 },
  { make: 'BMW', model: '3 Serie', makeSlug: 'bmw', autoScoutModelSlug: '3-serie', marketplaceBrandSlug: 'bmw', marketplaceQuery: '3+serie', category: 'premium', maxPriceEur: 60000 },
  { make: 'Mercedes-Benz', model: 'A-Klasse', makeSlug: 'mercedes-benz', autoScoutModelSlug: 'a-klasse', marketplaceBrandSlug: 'mercedes-benz', marketplaceQuery: 'a-klasse', category: 'premium', maxPriceEur: 55000 },
  { make: 'Audi', model: 'A3', makeSlug: 'audi', autoScoutModelSlug: 'a3', marketplaceBrandSlug: 'audi', marketplaceQuery: 'a3', category: 'premium', maxPriceEur: 55000 },
  { make: 'Audi', model: 'A4', makeSlug: 'audi', autoScoutModelSlug: 'a4', marketplaceBrandSlug: 'audi', marketplaceQuery: 'a4', category: 'premium', maxPriceEur: 60000, fuels: ['petrol', 'diesel', 'hybrid', 'unknown'], transmissions: ['manual', 'automatic', 'unknown'], kleinanzeigenQuery: 'audi-a4' },
  { make: 'Volvo', model: 'V40', makeSlug: 'volvo', autoScoutModelSlug: 'v40', marketplaceBrandSlug: 'volvo', marketplaceQuery: 'v40', category: 'premium', maxPriceEur: 42000 },
];

export const savedSearches: SavedSearch[] = searchSpecs.map(makeSearch);

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
    label: 'Fresh Corolla hybrid listing',
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
