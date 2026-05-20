import type { CountryCode, FuelType, Listing, MarketSource, SavedSearch, SellerType, Transmission } from '../types';
import type { ListingAdapter, RawListingObservation } from './types';

const USER_AGENT = process.env.SCRAPER_USER_AGENT ?? 'CarMarketWatchBot/0.1 (+private research; low-rate cached market snapshot)';
const REQUEST_TIMEOUT_MS = 25_000;

export type LiveAdapterResult = {
  adapter: ListingAdapter;
  enabled: boolean;
  reason?: string;
};

type LiveObservationPayload = {
  title: string;
  make: string;
  model: string;
  priceEur: number;
  mileageKm: number;
  year: number;
  fuel: FuelType;
  transmission: Transmission;
  location: string;
  country: CountryCode;
  sellerType: SellerType;
  firstRegistrationDate?: string;
  notes?: string;
};

export type LiveListingObservation = RawListingObservation & {
  payload: LiveObservationPayload;
};

export const reachableLiveSources: MarketSource[] = ['autoscout24', 'marktplaats', '2dehands'];
export const blockedOrGatedLiveSources: Partial<Record<MarketSource, string>> = {
  gaspedaal: 'Reachable, but current React Flight payload is not normalized safely enough yet; keep as smoke/source-strategy only until parser is hardened.',
  kleinanzeigen: 'Returned 403 during live checks from this environment; do not bypass anti-abuse controls.',
  'mobile-de-api': 'Official/gated API only; no API credentials configured.',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'nl-NL,nl;q=0.9,en;q=0.7',
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ');
}

function extractNextData(html: string): unknown {
  const match = html.match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('Missing __NEXT_DATA__ script');
  return JSON.parse(decodeHtmlEntities(match[1]));
}

function getPath(value: unknown, path: Array<string | number>): unknown {
  let cursor = value as Record<string, unknown> | unknown[] | undefined;
  for (const key of path) {
    if (cursor === null || cursor === undefined) return undefined;
    cursor = (cursor as Record<string, unknown>)[key as string] as Record<string, unknown> | unknown[] | undefined;
  }
  return cursor;
}

function parseEuro(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  const text = String(value ?? '');
  const match = text.match(/([0-9][0-9.\s]*)/);
  if (!match) return 0;
  return Number.parseInt(match[1].replace(/[^0-9]/g, ''), 10) || 0;
}

function parseMileage(value: unknown): number {
  if (typeof value === 'number') return Math.round(value);
  const text = String(value ?? '');
  const match = text.match(/([0-9][0-9.\s]*)/);
  if (!match) return 0;
  return Number.parseInt(match[1].replace(/[^0-9]/g, ''), 10) || 0;
}

function parseYear(value: unknown, fallbackTitle = ''): number {
  const text = `${String(value ?? '')} ${fallbackTitle}`;
  const match = text.match(/(20[0-2][0-9]|19[8-9][0-9])/);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function parseFirstRegistration(value: unknown): string | undefined {
  const text = String(value ?? '');
  const match = text.match(/(?:(\d{1,2})[-/])?(20[0-2][0-9]|19[8-9][0-9])/);
  if (!match) return undefined;
  const month = match[1] ? Number.parseInt(match[1], 10) : 1;
  const year = Number.parseInt(match[2], 10);
  return `${year}-${String(Math.min(Math.max(month, 1), 12)).padStart(2, '0')}-01`;
}

function mapFuel(value: unknown): FuelType {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('hybr') || text.includes('etsi')) return 'hybrid';
  if (text.includes('elektr') || text.includes('electric')) return 'electric';
  if (text.includes('diesel')) return 'diesel';
  if (text.includes('lpg')) return 'lpg';
  if (text.includes('benz') || text.includes('petrol') || text.includes('gasoline')) return 'petrol';
  return 'unknown';
}

function mapTransmission(value: unknown): Transmission {
  const text = String(value ?? '').toLowerCase();
  if (text.includes('auto') || text.includes('dsg')) return 'automatic';
  if (text.includes('hand') || text.includes('manual') || text.includes('manueel')) return 'manual';
  return 'unknown';
}

function attrValue(item: Record<string, unknown>, key: string): unknown {
  const attrs = item.attributes;
  if (!Array.isArray(attrs)) return undefined;
  const found = attrs.find((attr) => typeof attr === 'object' && attr !== null && (attr as Record<string, unknown>).key === key) as Record<string, unknown> | undefined;
  return found?.value;
}

function matchesSearch(listing: LiveObservationPayload, search: SavedSearch): boolean {
  if (listing.make.toLowerCase() !== search.make.toLowerCase()) return false;
  if (!listing.model.toLowerCase().includes(search.model.toLowerCase())) return false;
  if (!search.countries.includes(listing.country)) return false;
  if (search.minYear !== undefined && listing.year < search.minYear) return false;
  if (search.maxYear !== undefined && listing.year > search.maxYear) return false;
  if (search.maxMileageKm !== undefined && listing.mileageKm > search.maxMileageKm) return false;
  if (search.minPriceEur !== undefined && listing.priceEur < search.minPriceEur) return false;
  if (search.maxPriceEur !== undefined && listing.priceEur > search.maxPriceEur) return false;
  if (search.fuels !== undefined && !search.fuels.includes(listing.fuel)) return false;
  if (search.transmissions !== undefined && !search.transmissions.includes(listing.transmission)) return false;
  if (search.sellerTypes !== undefined && !search.sellerTypes.includes(listing.sellerType)) return false;
  return listing.priceEur > 0 && listing.mileageKm > 0;
}

function sourceUrl(source: MarketSource, pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http')) return pathOrUrl;
  if (source === 'autoscout24') return `https://www.autoscout24.nl${pathOrUrl}`;
  if (source === 'marktplaats') return `https://www.marktplaats.nl${pathOrUrl}`;
  if (source === '2dehands') return `https://www.2dehands.be${pathOrUrl}`;
  return pathOrUrl;
}

function autoscoutCountryUrls(url: string, countries: CountryCode[]): string[] {
  const cyByCountry: Partial<Record<CountryCode, string>> = { NL: 'NL', BE: 'B', DE: 'D', FR: 'F' };
  if (!url.includes('autoscout24.nl') || !url.includes('cy=')) return [url];
  return countries
    .map((country) => cyByCountry[country])
    .filter((cy): cy is string => Boolean(cy))
    .map((cy) => url.replace(/([?&]cy=)[^&]+/, `$1${cy}`));
}

function normalizeTitleMakeModel(title: string, fallbackMake: string, fallbackModel: string): Pick<LiveObservationPayload, 'make' | 'model'> {
  const cleanTitle = title.toLowerCase();
  if (cleanTitle.includes('toyota') && cleanTitle.includes('corolla')) return { make: 'Toyota', model: 'Corolla' };
  if (cleanTitle.includes('volkswagen') && cleanTitle.includes('golf')) return { make: 'Volkswagen', model: 'Golf' };
  return { make: fallbackMake, model: fallbackModel };
}

function buildObservation(args: {
  source: MarketSource;
  sourceListingId: string;
  searchId: string;
  observedAt: string;
  url: string;
  payload: LiveObservationPayload;
}): LiveListingObservation {
  return {
    source: args.source,
    sourceListingId: args.sourceListingId,
    observedAt: args.observedAt,
    searchId: args.searchId,
    url: args.url,
    payload: args.payload,
  };
}

function confidenceFor(payload: LiveObservationPayload): Listing['confidence'] {
  if (payload.priceEur > 0 && payload.mileageKm > 0 && payload.year >= 1990 && payload.fuel !== 'unknown' && payload.transmission !== 'unknown') return 'high';
  if (payload.priceEur > 0 && payload.year >= 1990) return 'medium';
  return 'low';
}

function createAdapter(source: MarketSource, parse: (html: string, search: SavedSearch, observedAt: string, url: string) => LiveListingObservation[]): ListingAdapter<LiveListingObservation> {
  return {
    source,
    async fetchSearch(search) {
      const url = search.queryUrlBySource[source];
      if (!url) return [];
      const urls = source === 'autoscout24' ? autoscoutCountryUrls(url, search.countries) : [url];
      const observations: LiveListingObservation[] = [];
      for (const sourceSearchUrl of urls) {
        await sleep(750);
        try {
          const html = await fetchHtml(sourceSearchUrl);
          observations.push(...parse(html, search, new Date().toISOString(), sourceSearchUrl));
        } catch (error) {
          if (observations.length === 0) throw error;
          console.warn(`${source} partial live ingestion skipped ${sourceSearchUrl}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return observations.filter((raw) => matchesSearch(raw.payload, search)).slice(0, 45);
    },
    normalize(raw) {
      return {
        id: `${raw.source}-${raw.sourceListingId}`,
        source: raw.source,
        country: raw.payload.country,
        url: raw.url,
        title: raw.payload.title,
        make: raw.payload.make,
        model: raw.payload.model,
        trim: raw.payload.title,
        priceEur: raw.payload.priceEur,
        mileageKm: raw.payload.mileageKm,
        year: raw.payload.year,
        fuel: raw.payload.fuel,
        transmission: raw.payload.transmission,
        location: raw.payload.location,
        sellerType: raw.payload.sellerType,
        firstSeen: raw.observedAt.slice(0, 10),
        lastSeen: raw.observedAt.slice(0, 10),
        firstRegistrationDate: raw.payload.firstRegistrationDate,
        confidence: confidenceFor(raw.payload),
        notes: raw.payload.notes,
      };
    },
  };
}

function parseAutoScout(html: string, search: SavedSearch, observedAt: string): LiveListingObservation[] {
  const data = extractNextData(html);
  const rows = getPath(data, ['props', 'pageProps', 'listings']);
  if (!Array.isArray(rows)) return [];
  return rows.map((row): LiveListingObservation | null => {
    const item = row as Record<string, unknown>;
    const vehicle = (item.vehicle ?? {}) as Record<string, unknown>;
    const tracking = (item.tracking ?? {}) as Record<string, unknown>;
    const location = (item.location ?? {}) as Record<string, unknown>;
    const seller = (item.seller ?? {}) as Record<string, unknown>;
    const title = [vehicle.make, vehicle.model, vehicle.modelVersionInput].filter(Boolean).join(' ');
    const { make, model } = normalizeTitleMakeModel(title, String(vehicle.make ?? search.make), String(vehicle.model ?? search.model));
    const country = String(location.countryCode ?? 'NL') as CountryCode;
    const priceEur = parseEuro(tracking.price ?? (item.price as Record<string, unknown> | undefined)?.priceFormatted);
    const firstRegistrationDate = parseFirstRegistration(tracking.firstRegistration);
    const payload: LiveObservationPayload = {
      title,
      make,
      model,
      priceEur,
      mileageKm: parseMileage(tracking.mileage ?? vehicle.mileageInKm),
      year: parseYear(tracking.firstRegistration, title),
      fuel: mapFuel(vehicle.fuel ?? tracking.fuelType ?? title),
      transmission: mapTransmission(vehicle.transmission ?? title),
      location: String(location.city ?? ''),
      country,
      sellerType: String(seller.type ?? '').toLowerCase().includes('dealer') ? 'dealer' : 'private',
      firstRegistrationDate,
      notes: 'Live AutoScout24 search-page observation; parsed from public __NEXT_DATA__ listing payload.',
    };
    return buildObservation({ source: 'autoscout24', sourceListingId: String(item.id), searchId: search.id, observedAt, url: sourceUrl('autoscout24', String(item.url ?? '')), payload });
  }).filter(Boolean) as LiveListingObservation[];
}

function parseAdevinta(source: 'marktplaats' | '2dehands', html: string, search: SavedSearch, observedAt: string): LiveListingObservation[] {
  const data = extractNextData(html);
  const rows = getPath(data, ['props', 'pageProps', 'searchRequestAndResponse', 'listings']);
  if (!Array.isArray(rows)) return [];
  return rows.map((row): LiveListingObservation | null => {
    const item = row as Record<string, unknown>;
    const title = String(item.title ?? item.displayTitle ?? '');
    const { make, model } = normalizeTitleMakeModel(title, search.make, search.model);
    const location = (item.location ?? {}) as Record<string, unknown>;
    const priceInfo = (item.priceInfo ?? {}) as Record<string, unknown>;
    const fuel = attrValue(item, 'fuel') ?? title;
    const transmission = attrValue(item, 'transmission') ?? title;
    const year = parseYear(attrValue(item, 'constructionYear'), title);
    const payload: LiveObservationPayload = {
      title,
      make,
      model,
      priceEur: Math.round(Number(priceInfo.priceCents ?? 0) / 100),
      mileageKm: parseMileage(attrValue(item, 'mileage') ?? item.description),
      year,
      fuel: mapFuel(fuel),
      transmission: mapTransmission(transmission),
      location: String(location.cityName ?? ''),
      country: (source === '2dehands' ? 'BE' : String(location.countryAbbreviation ?? 'NL')) as CountryCode,
      sellerType: String((item.sellerInformation as Record<string, unknown> | undefined)?.sellerName ?? '').match(/auto|cars|garage|dealer|occasions/i) ? 'dealer' : 'unknown',
      firstRegistrationDate: parseFirstRegistration(attrValue(item, 'constructionYear') ?? title),
      notes: `Live ${source} search-page observation; parsed from public __NEXT_DATA__ listing payload.`,
    };
    return buildObservation({ source, sourceListingId: String(item.itemId), searchId: search.id, observedAt, url: sourceUrl(source, String(item.vipUrl ?? '')), payload });
  }).filter(Boolean) as LiveListingObservation[];
}

export const autoscout24LiveAdapter = createAdapter('autoscout24', parseAutoScout);
export const marktplaatsLiveAdapter = createAdapter('marktplaats', (html, search, observedAt) => parseAdevinta('marktplaats', html, search, observedAt));
export const tweedehandsLiveAdapter = createAdapter('2dehands', (html, search, observedAt) => parseAdevinta('2dehands', html, search, observedAt));

export const liveAdapters = [autoscout24LiveAdapter, marktplaatsLiveAdapter, tweedehandsLiveAdapter];
