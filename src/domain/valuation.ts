import type { Listing, NormalizedValuationExport, Valuation } from '../types';

const dayMs = 24 * 60 * 60 * 1000;

export function daysBetween(a: string, b: string): number {
  return Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / dayMs));
}

export function comparableListings(target: Listing, listings: Listing[]): Listing[] {
  return listings.filter((listing) => {
    const sameCar = listing.make.toLowerCase() === target.make.toLowerCase() && listing.model.toLowerCase() === target.model.toLowerCase();
    const yearClose = Math.abs(listing.year - target.year) <= 2;
    const mileageClose = Math.abs(listing.mileageKm - target.mileageKm) <= 40000;
    const sameFuel = listing.fuel === target.fuel || listing.fuel === 'unknown' || target.fuel === 'unknown';
    return sameCar && yearClose && mileageClose && sameFuel;
  });
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? Math.round((sorted[mid - 1] + sorted[mid]) / 2) : sorted[mid];
}

export function valueListing(target: Listing, listings: Listing[], today = '2026-05-20'): Valuation {
  const comps = comparableListings(target, listings);
  const marketMedianEur = median(comps.map((listing) => listing.priceEur));
  const priceDeltaEur = target.priceEur - marketMedianEur;
  const priceDeltaPct = marketMedianEur ? Math.round((priceDeltaEur / marketMedianEur) * 1000) / 10 : 0;
  const daysOnMarket = daysBetween(target.firstSeen, today);
  const pricePer10kKm = Math.round(target.priceEur / Math.max(1, target.mileageKm / 10000));

  const discountScore = Math.max(-30, Math.min(40, -priceDeltaPct * 1.7));
  const freshnessPenalty = Math.min(15, daysOnMarket / 8);
  const confidenceBonus = target.confidence === 'high' ? 8 : target.confidence === 'medium' ? 3 : -5;
  const dealScore = Math.round(Math.max(0, Math.min(100, 55 + discountScore - freshnessPenalty + confidenceBonus)));

  const verdict = priceDeltaPct <= -12 ? 'undervalued' : priceDeltaPct >= 10 ? 'expensive' : daysOnMarket > 45 ? 'watch' : 'fair';

  return {
    marketMedianEur,
    comparableCount: comps.length,
    comparableIds: comps.map((listing) => listing.id),
    priceDeltaEur,
    priceDeltaPct,
    daysOnMarket,
    pricePer10kKm,
    dealScore,
    verdict,
  };
}

export function buildValuationExports(listings: Listing[], today = '2026-05-20'): NormalizedValuationExport[] {
  return listings.map((listing) => ({
    listingId: listing.id,
    source: listing.source,
    make: listing.make,
    model: listing.model,
    year: listing.year,
    priceEur: listing.priceEur,
    mileageKm: listing.mileageKm,
    valuation: valueListing(listing, listings, today),
  }));
}
