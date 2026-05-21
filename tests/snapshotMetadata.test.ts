import { describe, expect, it } from 'vitest';
import { buildIngestionRunMetadata } from '../src/ingest/snapshotMetadata';
import type { RawListingObservation } from '../src/ingest/types';

const startedAt = '2026-05-21T08:00:00.000Z';
const finishedAt = '2026-05-21T08:00:02.500Z';

function observation(source: RawListingObservation['source'], sourceListingId: string, searchId: string): RawListingObservation {
  return {
    source,
    sourceListingId,
    searchId,
    observedAt: startedAt,
    url: `https://example.test/${source}/${sourceListingId}`,
    payload: {},
  };
}

describe('ingestion run metadata', () => {
  it('summarizes runtime, configured limits, sources, searches, errors, and source statuses', () => {
    const metadata = buildIngestionRunMetadata({
      mode: 'live-marketplaces',
      adapter: 'live-marketplaces',
      startedAt,
      finishedAt,
      pageCountConfig: { requested: 4, effective: 3, max: 20 },
      requestDelayConfig: { requestedMs: 750, effectiveMs: 750 },
      searchIds: ['search-a', 'search-b'],
      rawObservations: [
        observation('autoscout24', 'a1', 'search-a'),
        observation('autoscout24', 'a2', 'search-a'),
        observation('marktplaats', 'm1', 'search-b'),
      ],
      listingSourceCounts: { autoscout24: 2, marktplaats: 1 },
      errors: ['autoscout24 / search-b: HTTP 500'],
      notes: ['mobile-de-api skipped: Official/gated API only.'],
      sourceStatuses: [
        { source: 'autoscout24', status: 'enabled' },
        { source: 'mobile-de-api', status: 'blocked', reason: 'Official/gated API only.' },
      ],
    });

    expect(metadata).toEqual(
      expect.objectContaining({
        startedAt,
        finishedAt,
        durationMs: 2500,
        pageCountConfig: { requested: 4, effective: 3, max: 20 },
        requestDelayConfig: { requestedMs: 750, effectiveMs: 750 },
        totalRawObservationCount: 3,
        totalListingCount: 3,
        errors: ['autoscout24 / search-b: HTTP 500'],
      }),
    );
    expect(metadata.sourceBreakdown.autoscout24).toEqual({ rawObservationCount: 2, listingCount: 2, errorCount: 1, status: 'enabled' });
    expect(metadata.sourceBreakdown.marktplaats).toEqual({ rawObservationCount: 1, listingCount: 1, errorCount: 0, status: 'not-configured' });
    expect(metadata.searchBreakdown['search-a']).toEqual({ rawObservationCount: 2, listingCount: 2, errorCount: 0 });
    expect(metadata.searchBreakdown['search-b']).toEqual({ rawObservationCount: 1, listingCount: 1, errorCount: 1 });
    expect(metadata.sourceStatusSummary).toEqual({ enabled: 1, disabled: 0, blocked: 1, error: 0, skipped: 0, 'not-configured': 0 });
  });
});
