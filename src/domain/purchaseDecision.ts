import type {
  DataQualityReport,
  ImportCostEstimate,
  Listing,
  NetRentalEstimate,
  NormalizedValuationExport,
  PurchaseDecision,
  PurchaseVerdict,
  RentalEstimate,
} from '../types';
import { comparableListings, median } from './valuation';

export type PurchaseDecisionInput = {
  listing: Listing;
  listings: Listing[];
  importEstimate: ImportCostEstimate;
  netRentalEstimate: NetRentalEstimate;
  rentalEstimate: RentalEstimate;
  dataQualityReport: DataQualityReport;
  valuation?: NormalizedValuationExport;
};

const confidenceScore: Record<Listing['confidence'], number> = {
  high: 100,
  medium: 70,
  low: 35,
};

const confidenceAdjustment: Record<Listing['confidence'], number> = {
  high: 8,
  medium: 2,
  low: -20,
};

const dataConfidenceAdjustment: Record<DataQualityReport['confidence'], number> = {
  high: 12,
  medium: 5,
  low: -12,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundPct(value: number): number {
  return Math.round(value * 10) / 10;
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function dutchMarketMedian(listing: Listing, listings: Listing[], valuation?: NormalizedValuationExport): { medianEur: number; comparableCount: number } {
  const nlComparablePrices = comparableListings(listing, listings)
    .filter((candidate) => candidate.country === 'NL')
    .map((candidate) => candidate.priceEur);

  if (nlComparablePrices.length > 0) {
    return { medianEur: median(nlComparablePrices), comparableCount: nlComparablePrices.length };
  }

  if (valuation?.valuation.marketMedianEur) {
    return { medianEur: valuation.valuation.marketMedianEur, comparableCount: valuation.valuation.comparableCount };
  }

  return { medianEur: listing.priceEur, comparableCount: 0 };
}

function importComplexityScore(estimate: ImportCostEstimate): number {
  let score = estimate.region === 'domestic-nl' ? 100 : estimate.region === 'eu-efta' ? 68 : 35;
  if (estimate.needsManualBpm) score -= 25;
  if (estimate.confidence === 'low') score -= 15;
  if (estimate.confidence === 'high') score += 5;
  return clamp(score, 0, 100);
}

function importComplexityPenalty(estimate: ImportCostEstimate): number {
  if (estimate.region === 'domestic-nl') return 6;
  const basePenalty = estimate.region === 'eu-efta' ? -5 : -15;
  return basePenalty + (estimate.needsManualBpm ? -20 : 0) + (estimate.confidence === 'low' ? -8 : 0);
}

function liquidityAdjustment(nlComparableCount: number): number {
  if (nlComparableCount >= 3) return 8;
  if (nlComparableCount >= 1) return 3;
  return -8;
}

function verdictFromScore(score: number): PurchaseVerdict {
  if (score >= 78) return 'buy-now';
  if (score >= 62) return 'negotiate';
  if (score >= 45) return 'watch';
  return 'avoid';
}

export function decidePurchase(input: PurchaseDecisionInput): PurchaseDecision {
  const { listing, listings, importEstimate, netRentalEstimate, rentalEstimate, dataQualityReport, valuation } = input;
  const { medianEur: dutchMarketMedianEur, comparableCount: nlComparableCount } = dutchMarketMedian(listing, listings, valuation);
  const landedCostEur = importEstimate.landedCostEur;
  const landedCostDeltaToDutchMarketEur = landedCostEur - dutchMarketMedianEur;
  const landedCostDeltaToDutchMarketPct = dutchMarketMedianEur > 0 ? roundPct((landedCostDeltaToDutchMarketEur / dutchMarketMedianEur) * 100) : 0;
  const landedDiscountPct = -landedCostDeltaToDutchMarketPct;
  const netAnnualRentalEur = netRentalEstimate.netAnnualRentalEur;
  const netRentalYieldPct = netRentalEstimate.netRentalYieldOnLandedCostPct;
  const paybackMonths = netAnnualRentalEur > 0 ? Math.round((landedCostEur / netAnnualRentalEur) * 12) : null;
  const sourceConfidenceScore = confidenceScore[listing.confidence];
  const dataConfidenceScore = dataQualityReport.completenessPct;
  const complexityScore = importComplexityScore(importEstimate);
  const reasons: string[] = [];
  const blockers: string[] = [];

  if (dutchMarketMedianEur > 0) {
    if (landedCostDeltaToDutchMarketPct <= -10) reasons.push(`Landed cost is ${Math.abs(landedCostDeltaToDutchMarketPct)}% below Dutch market median.`);
    if (landedCostDeltaToDutchMarketPct > 0 && landedCostDeltaToDutchMarketPct <= 5) reasons.push(`Landed cost is ${landedCostDeltaToDutchMarketPct}% above Dutch market median; negotiation margin is limited.`);
  }

  if (netRentalYieldPct >= 12) reasons.push(`Net rental yield is strong at ${netRentalYieldPct}%.`);
  else if (netRentalYieldPct >= 8) reasons.push(`Net rental yield is workable at ${netRentalYieldPct}%.`);
  else reasons.push(`Net rental yield is weak at ${netRentalYieldPct}%.`);

  if (nlComparableCount >= 1) reasons.push(`Dutch market anchor uses ${nlComparableCount} NL comparable(s).`);
  else reasons.push('No close NL comparable; Dutch median falls back to valuation/listing data.');

  if (dataQualityReport.confidence !== 'low') reasons.push(`Data quality is ${dataQualityReport.confidence} (${dataQualityReport.completenessPct}% complete).`);
  if (listing.confidence === 'high') reasons.push('Listing source confidence is high.');
  if (importEstimate.region !== 'domestic-nl') reasons.push(`Import path is ${importEstimate.region} with ${importEstimate.confidence} cost confidence.`);

  if (importEstimate.needsManualBpm && typeof listing.bpmOverrideEur !== 'number') {
    blockers.push('Manual BPM input required before purchase decision.');
  }
  if (landedCostEur > dutchMarketMedianEur * 1.05) {
    blockers.push('Landed cost is more than 5% above Dutch market median.');
  }
  if (rentalEstimate.compCount === 0) {
    blockers.push('No rental comparables; rental income estimate needs validation.');
  }
  if (listing.confidence === 'low') {
    blockers.push('Listing confidence is low; verify seller/listing details before buying.');
  }
  for (const field of dataQualityReport.missingCriticalFields) {
    if (!blockers.includes(`Missing critical field: ${field}.`)) blockers.push(`Missing critical field: ${field}.`);
  }

  let score =
    35 +
    clamp(landedDiscountPct * 1.4, -35, 35) +
    clamp((netRentalYieldPct - 8) * 2.5, -20, 25) +
    dataConfidenceAdjustment[dataQualityReport.confidence] +
    liquidityAdjustment(nlComparableCount) +
    confidenceAdjustment[listing.confidence] +
    importComplexityPenalty(importEstimate);

  if (rentalEstimate.compCount === 0) score = Math.min(score, 68);
  if (listing.confidence === 'low') score = Math.min(score, 55);
  if (dataQualityReport.confidence === 'low') score = Math.min(score, 60);
  const purchaseScore = roundScore(score);

  let verdict: PurchaseVerdict = verdictFromScore(purchaseScore);
  if (landedCostEur > dutchMarketMedianEur * 1.05) {
    verdict = 'avoid';
  } else if (importEstimate.needsManualBpm && typeof listing.bpmOverrideEur !== 'number') {
    verdict = 'needs-data';
  } else if (dataQualityReport.missingCriticalFields.length > 0 && purchaseScore < 78) {
    verdict = 'needs-data';
  } else if (rentalEstimate.compCount === 0 && purchaseScore >= 78) {
    verdict = 'negotiate';
  } else if (listing.confidence === 'low' && purchaseScore >= 62) {
    verdict = 'watch';
  }

  return {
    listingId: listing.id,
    landedCostEur,
    dutchMarketMedianEur,
    landedCostDeltaToDutchMarketEur,
    landedCostDeltaToDutchMarketPct,
    netAnnualRentalEur,
    netRentalYieldPct,
    paybackMonths,
    importComplexityScore: complexityScore,
    dataConfidenceScore,
    purchaseScore,
    verdict,
    reasons,
    blockers,
  };
}

export function buildPurchaseDecisions(args: {
  listings: Listing[];
  importCostEstimates: ImportCostEstimate[];
  netRentalEstimates: NetRentalEstimate[];
  rentalEstimates: RentalEstimate[];
  dataQualityReports: DataQualityReport[];
  valuations?: NormalizedValuationExport[];
}): PurchaseDecision[] {
  const importById = new Map(args.importCostEstimates.map((estimate) => [estimate.listingId, estimate]));
  const netRentalById = new Map(args.netRentalEstimates.map((estimate) => [estimate.listingId, estimate]));
  const rentalById = new Map(args.rentalEstimates.map((estimate) => [estimate.listingId, estimate]));
  const qualityById = new Map(args.dataQualityReports.map((report) => [report.listingId, report]));
  const valuationById = new Map((args.valuations ?? []).map((valuation) => [valuation.listingId, valuation]));

  return args.listings.map((listing) => {
    const importEstimate = importById.get(listing.id);
    const netRentalEstimate = netRentalById.get(listing.id);
    const rentalEstimate = rentalById.get(listing.id);
    const dataQualityReport = qualityById.get(listing.id);
    if (!importEstimate || !netRentalEstimate || !rentalEstimate || !dataQualityReport) {
      throw new Error(`Missing purchase decision input for listing ${listing.id}`);
    }
    return decidePurchase({
      listing,
      listings: args.listings,
      importEstimate,
      netRentalEstimate,
      rentalEstimate,
      dataQualityReport,
      valuation: valuationById.get(listing.id),
    });
  });
}
