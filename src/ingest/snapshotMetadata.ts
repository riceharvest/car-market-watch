import type { AdapterSource, IngestionRunMetadata, IngestionSourceStatus, RawListingObservation } from './types';
import type { Listing } from '../types';

type CountMap = Record<string, number>;

export type BuildIngestionRunMetadataInput = {
  mode: 'manual-fixture' | 'live-marketplaces';
  adapter: AdapterSource | 'live-marketplaces';
  startedAt: string;
  finishedAt: string;
  pageCountConfig: IngestionRunMetadata['pageCountConfig'];
  requestDelayConfig: IngestionRunMetadata['requestDelayConfig'];
  searchIds: string[];
  rawObservations: RawListingObservation[];
  listingSourceCounts: CountMap;
  errors: string[];
  notes: string[];
  sourceStatuses: IngestionSourceStatus[];
};

const STATUS_VALUES: IngestionSourceStatus['status'][] = ['enabled', 'disabled', 'blocked', 'error', 'skipped', 'not-configured'];

function increment(target: CountMap, key: string, amount = 1): void {
  target[key] = (target[key] ?? 0) + amount;
}

function parseErrorTarget(error: string): { source?: string; searchId?: string } {
  const match = error.match(/^([^/]+)\s\/\s([^:]+):/);
  if (!match) return {};
  return { source: match[1].trim(), searchId: match[2].trim() };
}

export function countListingsBySource(listings: Listing[]): CountMap {
  return listings.reduce<CountMap>((counts, listing) => {
    increment(counts, listing.source);
    return counts;
  }, {});
}

export function buildIngestionRunMetadata(input: BuildIngestionRunMetadataInput): IngestionRunMetadata {
  const rawCountsBySource: CountMap = {};
  const rawCountsBySearch: CountMap = {};
  const errorCountsBySource: CountMap = {};
  const errorCountsBySearch: CountMap = {};
  const statusBySource = new Map<string, IngestionSourceStatus['status']>(input.sourceStatuses.map((item) => [item.source, item.status]));

  for (const observation of input.rawObservations) {
    increment(rawCountsBySource, observation.source);
    if (observation.searchId) increment(rawCountsBySearch, observation.searchId);
  }

  for (const error of input.errors) {
    const target = parseErrorTarget(error);
    if (target.source) increment(errorCountsBySource, target.source);
    if (target.searchId) increment(errorCountsBySearch, target.searchId);
  }

  const sourceBreakdown: IngestionRunMetadata['sourceBreakdown'] = {};
  const sources = new Set([...Object.keys(rawCountsBySource), ...Object.keys(input.listingSourceCounts), ...Object.keys(errorCountsBySource)]);
  for (const source of sources) {
    sourceBreakdown[source] = {
      rawObservationCount: rawCountsBySource[source] ?? 0,
      listingCount: input.listingSourceCounts[source] ?? 0,
      errorCount: errorCountsBySource[source] ?? 0,
      status: statusBySource.get(source) ?? 'not-configured',
    };
  }

  const searchBreakdown: IngestionRunMetadata['searchBreakdown'] = {};
  for (const searchId of input.searchIds) {
    const listingCount = input.rawObservations.filter((observation) => observation.searchId === searchId).reduce((count, observation) => count + (input.listingSourceCounts[observation.source] ? 1 : 0), 0);
    searchBreakdown[searchId] = {
      rawObservationCount: rawCountsBySearch[searchId] ?? 0,
      listingCount,
      errorCount: errorCountsBySearch[searchId] ?? 0,
    };
  }

  const sourceStatusSummary = STATUS_VALUES.reduce<Record<IngestionSourceStatus['status'], number>>(
    (summary, status) => ({ ...summary, [status]: 0 }),
    {} as Record<IngestionSourceStatus['status'], number>,
  );
  for (const sourceStatus of input.sourceStatuses) {
    sourceStatusSummary[sourceStatus.status] += 1;
  }

  return {
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    durationMs: Math.max(0, new Date(input.finishedAt).getTime() - new Date(input.startedAt).getTime()),
    pageCountConfig: input.pageCountConfig,
    requestDelayConfig: input.requestDelayConfig,
    totalRawObservationCount: input.rawObservations.length,
    totalListingCount: Object.values(input.listingSourceCounts).reduce((sum, count) => sum + count, 0),
    sourceBreakdown,
    searchBreakdown,
    errors: input.errors,
    notes: input.notes,
    sourceStatuses: input.sourceStatuses,
    sourceStatusSummary,
  };
}
