import { describe, expect, it } from 'vitest';
import { buildMarketSnapshot } from '../src/domain/snapshot';

describe('purchase readiness gates', () => {
  it('requires every buy-now decision to pass critical readiness checks', () => {
    const snapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T12:00:00.000Z' });
    const listingById = new Map(snapshot.listings.map((listing) => [listing.id, listing]));
    const importById = new Map(snapshot.importCostEstimates.map((estimate) => [estimate.listingId, estimate]));
    const netRentalById = new Map(snapshot.netRentalEstimates.map((estimate) => [estimate.listingId, estimate]));
    const qualityById = new Map(snapshot.dataQualityReports.map((report) => [report.listingId, report]));

    for (const decision of snapshot.purchaseDecisions.filter((candidate) => candidate.verdict === 'buy-now')) {
      const listing = listingById.get(decision.listingId);
      const importEstimate = importById.get(decision.listingId);
      const netRentalEstimate = netRentalById.get(decision.listingId);
      const quality = qualityById.get(decision.listingId);

      expect(listing, decision.listingId).toBeDefined();
      expect(importEstimate, decision.listingId).toBeDefined();
      expect(netRentalEstimate, decision.listingId).toBeDefined();
      expect(quality, decision.listingId).toBeDefined();
      expect(quality?.missingCriticalFields, decision.listingId).toEqual([]);
      expect(netRentalEstimate?.netAnnualRentalEur, decision.listingId).toBeGreaterThan(0);
      expect(decision.landedCostEur, decision.listingId).toBeLessThanOrEqual(decision.dutchMarketMedianEur * 1.05);
      expect(decision.blockers, decision.listingId).not.toContain('Handmatige BPM-invoer nodig before purchase decision.');

      if (listing?.country !== 'NL') {
        expect(importEstimate?.needsManualBpm, decision.listingId).toBe(false);
      }
    }
  });
});
