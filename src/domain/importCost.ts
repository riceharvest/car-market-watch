import { importProfileForCountry } from '../data/importProfiles';
import type { Confidence, ImportCostEstimate, Listing } from '../types';

export type ImportCostOptions = {
  originCountry?: string;
  targetCountry?: 'NL';
};

function roundEuro(value: number): number {
  return Math.max(0, Math.round(value));
}

function yearsSinceFirstRegistration(firstRegistrationDate: string, asOf = '2026-05-20'): number {
  const first = new Date(firstRegistrationDate);
  const current = new Date(asOf);

  if (Number.isNaN(first.getTime()) || first > current) {
    return 0;
  }

  const diffMs = current.getTime() - first.getTime();
  return Math.max(0, diffMs / (365.25 * 24 * 60 * 60 * 1000));
}

function placeholderBpmFromCo2(listing: Listing): number {
  const co2 = listing.co2GPerKm ?? 0;
  const ageYears = listing.firstRegistrationDate ? yearsSinceFirstRegistration(listing.firstRegistrationDate) : Math.max(0, 2026 - listing.year);
  const fuelMultiplier = listing.fuel === 'diesel' ? 1.35 : listing.fuel === 'hybrid' ? 0.75 : listing.fuel === 'electric' ? 0 : 1;

  if (listing.fuel === 'electric' || co2 <= 0) {
    return 0;
  }

  const grossBpm =
    co2 <= 80 ? co2 * 18 :
    co2 <= 120 ? 1440 + (co2 - 80) * 55 :
    co2 <= 160 ? 3640 + (co2 - 120) * 105 :
    7840 + (co2 - 160) * 180;
  const ageDepreciation = Math.min(0.88, ageYears * 0.12);

  return roundEuro(grossBpm * fuelMultiplier * (1 - ageDepreciation));
}

function conservativeBpm(listing: Listing): number {
  if (listing.fuel === 'electric') return 0;
  if (listing.fuel === 'diesel') return 5500;
  if (listing.fuel === 'hybrid') return 3000;
  return 4000;
}

export function estimateImportCost(listing: Listing, options: ImportCostOptions = {}): ImportCostEstimate {
  const originCountry = (options.originCountry ?? listing.country).toUpperCase();
  const profile = importProfileForCountry(originCountry);
  const targetCountry = options.targetCountry ?? 'NL';
  const assumptions = [...profile.assumptions];
  let bpmEstimateEur = 0;
  let vatEstimateEur = 0;
  let customsDutyEstimateEur = 0;
  let adminBufferEur = profile.adminBufferEur;
  let needsManualBpm = false;
  let confidence: Confidence = profile.confidence;

  if (profile.region === 'domestic-nl') {
    assumptions.push('Domestic NL listing: total import cost set to zero for landed-cost comparison.');
    return {
      listingId: listing.id,
      originCountry,
      targetCountry,
      region: profile.region,
      transportEur: 0,
      rdwInspectionEur: 0,
      platesAndRegistrationEur: 0,
      bpmEstimateEur: 0,
      vatEstimateEur: 0,
      customsDutyEstimateEur: 0,
      adminBufferEur: 0,
      totalImportCostEur: 0,
      landedCostEur: listing.priceEur,
      needsManualBpm: false,
      confidence: 'high',
      assumptions,
      sourceUrls: profile.sourceUrls,
    };
  }

  if (typeof listing.bpmOverrideEur === 'number') {
    bpmEstimateEur = roundEuro(listing.bpmOverrideEur);
    assumptions.push('BPM override supplied on listing; using override instead of placeholder BPM calculation.');
    confidence = listing.confidence === 'high' ? 'high' : 'medium';
  } else if (!listing.co2GPerKm || !listing.firstRegistrationDate) {
    bpmEstimateEur = conservativeBpm(listing);
    adminBufferEur += 500;
    needsManualBpm = true;
    confidence = 'low';
    assumptions.push('Missing CO2 and/or first registration date; BPM needs manual calculation and conservative BPM/admin buffer is applied.');
  } else {
    bpmEstimateEur = placeholderBpmFromCo2(listing);
    confidence = profile.region === 'eu-efta' ? 'medium' : 'low';
    assumptions.push('Placeholder BPM estimate based on CO2 band, fuel type, and first registration age; replace with official BPM integration before purchase.');
  }

  if (profile.region === 'eu-efta') {
    customsDutyEstimateEur = 0;
    vatEstimateEur = 0;
    assumptions.push('EU/EFTA import: customs duty and import VAT placeholders are zero; Dutch BPM return remains required.');
  } else {
    customsDutyEstimateEur = roundEuro(listing.priceEur * profile.customsDutyRate);
    vatEstimateEur = roundEuro((listing.priceEur + customsDutyEstimateEur + profile.transportEur) * profile.vatRate);
    needsManualBpm = true;
    confidence = 'low';
    assumptions.push('Non-EU placeholder includes indicative customs duty and VAT; manual customs/BPM validation required.');
  }

  const totalImportCostEur = roundEuro(
    profile.transportEur +
      profile.rdwInspectionEur +
      profile.platesAndRegistrationEur +
      bpmEstimateEur +
      vatEstimateEur +
      customsDutyEstimateEur +
      adminBufferEur,
  );

  return {
    listingId: listing.id,
    originCountry,
    targetCountry,
    region: profile.region,
    transportEur: profile.transportEur,
    rdwInspectionEur: profile.rdwInspectionEur,
    platesAndRegistrationEur: profile.platesAndRegistrationEur,
    bpmEstimateEur,
    vatEstimateEur,
    customsDutyEstimateEur,
    adminBufferEur,
    totalImportCostEur,
    landedCostEur: listing.priceEur + totalImportCostEur,
    needsManualBpm,
    confidence,
    assumptions,
    sourceUrls: profile.sourceUrls,
  };
}

export function buildImportCostEstimates(listings: Listing[]): ImportCostEstimate[] {
  return listings.map((listing) => estimateImportCost(listing));
}
