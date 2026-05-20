import type { Confidence, Listing, RentalComparable, RentalEstimate, VehicleClass } from '../types';
import { median } from './valuation';

export type RentalUtilizationAssumptions = {
  weeklyBookedDays: number;
  monthlyBookedDays: number;
  annualBookedDays: number;
};

export const defaultRentalUtilizationAssumptions: RentalUtilizationAssumptions = {
  weeklyBookedDays: 3,
  monthlyBookedDays: 12,
  annualBookedDays: 120,
};

const compactMakes = new Set(['Volkswagen', 'Toyota', 'Ford', 'Opel', 'Renault', 'Peugeot', 'Hyundai', 'Kia']);

export function inferVehicleClass(listing: Pick<Listing, 'make' | 'model'>): VehicleClass {
  const model = listing.model.toLowerCase();
  if (model.includes('aygo') || model.includes('up') || model.includes('twingo') || model.includes('fiat 500')) return 'mini';
  if (model.includes('golf') || model.includes('corolla') || model.includes('focus') || model.includes('astra')) return 'compact';
  if (model.includes('variant') || model.includes('touring') || model.includes('estate')) return 'estate';
  if (model.includes('rav4') || model.includes('tiguan') || model.includes('suv')) return 'suv';
  if (compactMakes.has(listing.make)) return 'compact';
  return 'midsize';
}

export function comparableRentalComps(target: Listing, comps: RentalComparable[]): RentalComparable[] {
  const targetClass = inferVehicleClass(target);

  return comps
    .filter((comp) => comp.country === target.country)
    .map((comp) => ({ comp, score: rentalCompScore(target, targetClass, comp) }))
    .filter(({ score }) => score >= 45)
    .sort((a, b) => b.score - a.score || b.comp.confidence.localeCompare(a.comp.confidence))
    .slice(0, 8)
    .map(({ comp }) => comp);
}

function rentalCompScore(target: Listing, targetClass: VehicleClass, comp: RentalComparable): number {
  let score = 0;
  if (comp.country === target.country) score += 25;
  if (normalizeCity(comp.city) === normalizeCity(target.location)) score += 15;
  if (comp.vehicleClass === targetClass) score += 20;
  if (sameText(comp.anchors.make, target.make)) score += 18;
  if (sameText(comp.anchors.model, target.model)) score += 22;
  if (comp.anchors.fuel === target.fuel || comp.anchors.fuel === 'unknown' || target.fuel === 'unknown') score += 8;
  if (comp.anchors.transmission === target.transmission || comp.anchors.transmission === 'unknown' || target.transmission === 'unknown') score += 6;
  if (Math.abs(comp.anchors.year - target.year) <= 2) score += 8;
  if (target.mileageKm >= comp.anchors.mileageBandKm.min && target.mileageKm <= comp.anchors.mileageBandKm.max) score += 6;
  if (comp.confidence === 'high') score += 5;
  if (comp.confidence === 'low') score -= 5;
  return score;
}

export function estimateRentalRevenue(
  listing: Listing,
  comps: RentalComparable[],
  assumptions: RentalUtilizationAssumptions = defaultRentalUtilizationAssumptions,
): RentalEstimate {
  const selectedComps = comparableRentalComps(listing, comps);
  const adjustedDailyRates = selectedComps.map((comp) => adjustDailyRateForListing(listing, comp));
  const estimatedDailyRentEur = Math.max(0, median(adjustedDailyRates));
  const weeklyGrossEur = Math.round(estimatedDailyRentEur * assumptions.weeklyBookedDays);
  const monthlyGrossEur = Math.round(estimatedDailyRentEur * assumptions.monthlyBookedDays);
  const annualGrossEur = Math.round(estimatedDailyRentEur * assumptions.annualBookedDays);
  const annualYieldPct = listing.priceEur ? Math.round((annualGrossEur / listing.priceEur) * 1000) / 10 : 0;
  const confidence = rentalConfidence(selectedComps, estimatedDailyRentEur);

  return {
    listingId: listing.id,
    estimatedDailyRentEur,
    weeklyGrossEur,
    monthlyGrossEur,
    annualGrossEur,
    annualYieldPct,
    utilizationAssumptions: assumptions,
    confidence,
    compCount: selectedComps.length,
    comparableIds: selectedComps.map((comp) => comp.id),
    basisNotes: buildBasisNotes(listing, selectedComps, confidence),
  };
}

export function buildRentalEstimates(
  listings: Listing[],
  comps: RentalComparable[],
  assumptions: RentalUtilizationAssumptions = defaultRentalUtilizationAssumptions,
): RentalEstimate[] {
  return listings.map((listing) => estimateRentalRevenue(listing, comps, assumptions));
}

function adjustDailyRateForListing(listing: Listing, comp: RentalComparable): number {
  let rate = comp.dailyRateEur;
  const yearDelta = listing.year - comp.anchors.year;
  rate *= 1 + Math.max(-0.12, Math.min(0.12, yearDelta * 0.025));

  if (listing.transmission === 'automatic' && comp.anchors.transmission !== 'automatic') rate *= 1.06;
  if (listing.transmission === 'manual' && comp.anchors.transmission === 'automatic') rate *= 0.95;
  if (listing.fuel === 'electric' || listing.fuel === 'hybrid') rate *= comp.anchors.fuel === listing.fuel ? 1 : 1.04;

  const bandMidpoint = (comp.anchors.mileageBandKm.min + comp.anchors.mileageBandKm.max) / 2;
  const mileageDelta = listing.mileageKm - bandMidpoint;
  rate *= 1 - Math.max(-0.08, Math.min(0.1, mileageDelta / 500000));

  if (listing.country !== comp.country) rate *= 0.95;
  return Math.round(rate);
}

function rentalConfidence(comps: RentalComparable[], dailyRate: number): Confidence {
  if (dailyRate <= 0 || comps.length === 0) return 'low';
  const highConfidenceCount = comps.filter((comp) => comp.confidence === 'high').length;
  const peerToPeerCount = comps.filter((comp) => comp.sourceType === 'peer-to-peer').length;
  if (comps.length >= 3 && highConfidenceCount >= 1 && peerToPeerCount >= 2) return 'high';
  if (comps.length >= 2) return 'medium';
  return 'low';
}

function buildBasisNotes(listing: Listing, comps: RentalComparable[], confidence: Confidence): string[] {
  if (comps.length === 0) {
    return ['No close rental comparables; revenue fields default to zero until rental comps are added.'];
  }

  const cities = Array.from(new Set(comps.map((comp) => `${comp.city}, ${comp.country}`))).slice(0, 4).join('; ');
  const sources = Array.from(new Set(comps.map((comp) => comp.source))).join(', ');
  return [
    `Matched ${comps.length} rental comp(s) for ${listing.make} ${listing.model} / ${inferVehicleClass(listing)} class.`,
    `Daily rent is median of adjusted comparable rates from ${sources}.`,
    `Market anchors: ${cities}.`,
    `Confidence ${confidence}; gross revenue excludes cleaning, platform commission, insurance, delivery, tax and downtime beyond utilization assumptions.`,
  ];
}

function sameText(a: string | undefined, b: string): boolean {
  return Boolean(a && a.toLowerCase() === b.toLowerCase());
}

function normalizeCity(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}
