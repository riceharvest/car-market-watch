import { alertRules, rentalComparables, rentalSourceMetadata, savedSearches, sourceMetadata, watchlist } from '../data';
import { sampleListings } from '../data/sampleListings';
import type { Listing, MarketSnapshot, RentalComparable } from '../types';
import { buildDataQualityReports } from './dataQuality';
import { buildImportCostEstimates } from './importCost';
import { buildPurchaseDecisions } from './purchaseDecision';
import { buildNetRentalEstimate, buildRentalEstimates } from './rentalRevenue';
import { buildValuationExports, median } from './valuation';

export function buildMarketSnapshot(
  options: { generatedAt?: string; listings?: Listing[]; rentalComps?: RentalComparable[] } = {},
): MarketSnapshot {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const listings = options.listings ?? sampleListings;
  const rentalComps = options.rentalComps ?? rentalComparables;
  const today = generatedAt.slice(0, 10);
  const valuations = buildValuationExports(listings, today);
  const importCostEstimates = buildImportCostEstimates(listings);
  const rentalEstimates = buildRentalEstimates(listings, rentalComps);
  const importById = new Map(importCostEstimates.map((estimate) => [estimate.listingId, estimate]));
  const rentalById = new Map(rentalEstimates.map((estimate) => [estimate.listingId, estimate]));
  const netRentalEstimates = listings.map((listing) => {
    const importEstimate = importById.get(listing.id);
    const rentalEstimate = rentalById.get(listing.id);
    if (!importEstimate || !rentalEstimate) throw new Error(`Missing snapshot economics input for listing ${listing.id}`);
    return buildNetRentalEstimate({ ...listing, landedCostEur: importEstimate.landedCostEur }, rentalEstimate);
  });
  const dataQualityReports = buildDataQualityReports(
    listings,
    Object.fromEntries(
      listings.map((listing) => [
        listing.id,
        {
          importEstimate: importById.get(listing.id),
          rentalEstimate: rentalById.get(listing.id),
        },
      ]),
    ),
  );
  const purchaseDecisions = buildPurchaseDecisions({
    listings,
    importCostEstimates,
    netRentalEstimates,
    rentalEstimates,
    dataQualityReports,
    valuations,
  });
  const bestDeal = [...valuations].sort((a, b) => b.valuation.dealScore - a.valuation.dealScore)[0];
  const bestRentalYield = [...rentalEstimates].sort((a, b) => b.annualYieldPct - a.annualYieldPct)[0];
  const bestPurchase = [...purchaseDecisions]
    .filter((decision) => decision.verdict === 'buy-now' || decision.verdict === 'negotiate')
    .sort((a, b) => b.purchaseScore - a.purchaseScore)[0];

  return {
    schemaVersion: 1,
    generatedAt,
    sources: sourceMetadata,
    rentalSources: rentalSourceMetadata,
    rentalComps,
    savedSearches,
    alertRules,
    watchlist,
    listings,
    valuations,
    rentalEstimates,
    importCostEstimates,
    netRentalEstimates,
    dataQualityReports,
    purchaseDecisions,
    summary: {
      listingCount: listings.length,
      sourceCount: sourceMetadata.length,
      searchCount: savedSearches.length,
      watchlistCount: watchlist.length,
      bestDealListingId: bestDeal?.listingId ?? null,
      bestRentalYieldListingId: bestRentalYield?.listingId ?? null,
      medianPriceEur: median(listings.map((listing) => listing.priceEur)),
      rentalCompCount: rentalComps.length,
      rentalEstimateCount: rentalEstimates.length,
      importCostEstimateCount: importCostEstimates.length,
      netRentalEstimateCount: netRentalEstimates.length,
      purchaseDecisionCount: purchaseDecisions.length,
      buyNowCount: purchaseDecisions.filter((decision) => decision.verdict === 'buy-now').length,
      needsDataCount: purchaseDecisions.filter((decision) => decision.verdict === 'needs-data').length,
      bestPurchaseListingId: bestPurchase?.listingId ?? null,
    },
  };
}
