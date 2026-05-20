import { alertRules, rentalComparables, rentalSourceMetadata, savedSearches, sourceMetadata, watchlist } from '../data';
import { sampleListings } from '../data/sampleListings';
import type { Listing, MarketSnapshot, RentalComparable } from '../types';
import { buildRentalEstimates } from './rentalRevenue';
import { buildValuationExports, median } from './valuation';

export function buildMarketSnapshot(
  options: { generatedAt?: string; listings?: Listing[]; rentalComps?: RentalComparable[] } = {},
): MarketSnapshot {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const listings = options.listings ?? sampleListings;
  const rentalComps = options.rentalComps ?? rentalComparables;
  const today = generatedAt.slice(0, 10);
  const valuations = buildValuationExports(listings, today);
  const rentalEstimates = buildRentalEstimates(listings, rentalComps);
  const bestDeal = [...valuations].sort((a, b) => b.valuation.dealScore - a.valuation.dealScore)[0];
  const bestRentalYield = [...rentalEstimates].sort((a, b) => b.annualYieldPct - a.annualYieldPct)[0];

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
    },
  };
}
