import { describe, expect, it } from 'vitest';
import { buildMarketSnapshot } from '../src/domain/snapshot';

describe('market snapshot purchase integration', () => {
  it('includes import, net rental, data quality, and purchase decisions for every listing', () => {
    const snapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T12:00:00.000Z' });

    expect(snapshot.importCostEstimates).toHaveLength(snapshot.listings.length);
    expect(snapshot.netRentalEstimates).toHaveLength(snapshot.listings.length);
    expect(snapshot.dataQualityReports).toHaveLength(snapshot.listings.length);
    expect(snapshot.purchaseDecisions).toHaveLength(snapshot.listings.length);
    expect(snapshot.summary.listingCount).toBe(snapshot.listings.length);
    expect(snapshot.summary.importCostEstimateCount).toBe(snapshot.importCostEstimates.length);
    expect(snapshot.summary.netRentalEstimateCount).toBe(snapshot.netRentalEstimates.length);
    expect(snapshot.summary.purchaseDecisionCount).toBe(snapshot.purchaseDecisions.length);
    expect(snapshot.summary.buyNowCount).toBe(snapshot.purchaseDecisions.filter((decision) => decision.verdict === 'buy-now').length);
    expect(snapshot.summary.needsDataCount).toBe(snapshot.purchaseDecisions.filter((decision) => decision.verdict === 'needs-data').length);
  });

  it('keeps purchase economics aligned by listing id', () => {
    const snapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T12:00:00.000Z' });
    const listingIds = snapshot.listings.map((listing) => listing.id);

    expect(snapshot.importCostEstimates.map((estimate) => estimate.listingId)).toEqual(listingIds);
    expect(snapshot.netRentalEstimates.map((estimate) => estimate.listingId)).toEqual(listingIds);
    expect(snapshot.purchaseDecisions.map((decision) => decision.listingId)).toEqual(listingIds);
  });
});
