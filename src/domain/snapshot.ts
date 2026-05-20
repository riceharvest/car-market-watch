import { alertRules, savedSearches, sourceMetadata, watchlist } from '../data';
import { sampleListings } from '../data/sampleListings';
import type { Listing, MarketSnapshot } from '../types';
import { buildValuationExports, median } from './valuation';

export function buildMarketSnapshot(options: { generatedAt?: string; listings?: Listing[] } = {}): MarketSnapshot {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const listings = options.listings ?? sampleListings;
  const today = generatedAt.slice(0, 10);
  const valuations = buildValuationExports(listings, today);
  const bestDeal = [...valuations].sort((a, b) => b.valuation.dealScore - a.valuation.dealScore)[0];

  return {
    schemaVersion: 1,
    generatedAt,
    sources: sourceMetadata,
    savedSearches,
    alertRules,
    watchlist,
    listings,
    valuations,
    summary: {
      listingCount: listings.length,
      sourceCount: sourceMetadata.length,
      searchCount: savedSearches.length,
      watchlistCount: watchlist.length,
      bestDealListingId: bestDeal?.listingId ?? null,
      medianPriceEur: median(listings.map((listing) => listing.priceEur)),
    },
  };
}
