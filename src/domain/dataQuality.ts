import type { Confidence, DataQualityContext, DataQualityReport, Listing } from '../types';

const UNKNOWN_VALUES = new Set(['', 'unknown', 'n/a', 'na', 'null', 'undefined']);

export function buildDataQualityReport(listing: Listing, context: DataQualityContext = {}): DataQualityReport {
  const missingCriticalFields: string[] = [];
  const warnings: string[] = [];
  const checks: boolean[] = [];

  const addCheck = (field: string, present: boolean, critical = true) => {
    checks.push(present);
    if (!present && critical) missingCriticalFields.push(field);
  };

  addCheck('price', hasPositiveNumber(listing.priceEur));
  addCheck('country', hasValue(listing.country));
  addCheck('source URL', hasValue(listing.url));
  addCheck('year or first registration date', hasPositiveNumber(listing.year) || hasValue(listing.firstRegistrationDate));
  addCheck('mileage', hasNonNegativeNumber(listing.mileageKm));
  addCheck('fuel', hasKnownValue(listing.fuel));
  addCheck('transmission', hasKnownValue(listing.transmission));
  addCheck('location', hasValue(listing.location));

  const imported = isImportedListing(listing);
  if (imported) {
    const importNeedsManualBpm = context.importEstimate?.needsManualBpm === true;
    const hasBpmInput =
      hasPositiveNumber(listing.co2GPerKm) ||
      hasNonNegativeNumber(listing.bpmOverrideEur) ||
      (!importNeedsManualBpm && hasNonNegativeNumber(context.importEstimate?.bpmEur));
    addCheck('CO2 or BPM override for import', hasBpmInput);
    if (!hasBpmInput || importNeedsManualBpm) {
      pushUnique(missingCriticalFields, 'CO2 or BPM override for import');
      warnings.push('Imported listing is missing CO2/BPM override/manual BPM input; BPM confidence is low until supplied.');
    }
  } else {
    checks.push(true);
  }

  const rentalCompCount = context.rentalEstimate?.compCount;
  const hasRentalComps = typeof rentalCompCount === 'number' && rentalCompCount > 0;
  addCheck('rental comparable count', hasRentalComps);
  if (!hasRentalComps) {
    warnings.push('Rental comparable count is zero or unavailable; rental revenue confidence is reduced.');
  }

  if (context.importEstimate?.confidence === 'low') warnings.push('Import estimate confidence is low.');
  if (context.rentalEstimate?.confidence === 'low') warnings.push('Rental estimate confidence is low.');

  const completenessPct = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    listingId: listing.id,
    completenessPct,
    missingCriticalFields,
    warnings,
    confidence: reportConfidence(completenessPct, missingCriticalFields, warnings),
  };
}

export function buildDataQualityReports(
  listings: Listing[],
  contextByListingId: Record<string, DataQualityContext> = {},
): DataQualityReport[] {
  return listings.map((listing) => buildDataQualityReport(listing, contextByListingId[listing.id] ?? {}));
}

function reportConfidence(completenessPct: number, missingCriticalFields: string[], warnings: string[]): Confidence {
  if (missingCriticalFields.length === 0 && completenessPct >= 90 && warnings.length === 0) return 'high';
  if (missingCriticalFields.length <= 1 && completenessPct >= 75) return 'medium';
  return 'low';
}

function isImportedListing(listing: Listing): boolean {
  return listing.country !== 'NL';
}

function hasValue(value: unknown): boolean {
  return typeof value === 'string' ? !UNKNOWN_VALUES.has(value.trim().toLowerCase()) : value !== null && value !== undefined;
}

function hasKnownValue(value: unknown): boolean {
  return hasValue(value) && String(value).toLowerCase() !== 'unknown';
}

function hasPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function hasNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function pushUnique(items: string[], item: string): void {
  if (!items.includes(item)) items.push(item);
}
