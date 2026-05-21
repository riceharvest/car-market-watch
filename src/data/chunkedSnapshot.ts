import type {
  DataQualityReport,
  ImportCostEstimate,
  Listing,
  MarketSnapshot,
  NetRentalEstimate,
  NormalizedValuationExport,
  PurchaseDecision,
  RentalEstimate,
} from '../types';

type ChunkedCollectionKey =
  | 'listings'
  | 'valuations'
  | 'rentalEstimates'
  | 'importCostEstimates'
  | 'netRentalEstimates'
  | 'dataQualityReports'
  | 'purchaseDecisions';

type ChunkRowByCollection = {
  listings: Listing;
  valuations: NormalizedValuationExport;
  rentalEstimates: RentalEstimate;
  importCostEstimates: ImportCostEstimate;
  netRentalEstimates: NetRentalEstimate;
  dataQualityReports: DataQualityReport;
  purchaseDecisions: PurchaseDecision;
};

type ChunkRows<K extends ChunkedCollectionKey> = ChunkRowByCollection[K][];

export type SnapshotChunkDescriptor = {
  index: number;
  count: number;
  url: string;
};

export type MarketSnapshotManifest = Omit<MarketSnapshot,
  | 'schemaVersion'
  | 'listings'
  | 'valuations'
  | 'rentalEstimates'
  | 'importCostEstimates'
  | 'netRentalEstimates'
  | 'dataQualityReports'
  | 'purchaseDecisions'
> & {
  schemaVersion: 2;
  chunkSize: number;
  chunks: Record<ChunkedCollectionKey, SnapshotChunkDescriptor[]>;
};

export type SnapshotChunkFile<K extends ChunkedCollectionKey = ChunkedCollectionKey> = {
  collection: K;
  path: string;
  rows: ChunkRows<K>;
};

export type ChunkedMarketSnapshot = {
  manifest: MarketSnapshotManifest;
  chunks: SnapshotChunkFile[];
};

export type ChunkedSnapshotOptions = {
  chunkSize?: number;
  publicBasePath?: string;
};

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_PUBLIC_BASE_PATH = '/data/chunks';
const MANIFEST_URL = '/data/market-snapshot-manifest.json';
const LEGACY_SNAPSHOT_URL = '/data/market-snapshot.json';

const collectionFilePrefixes: Record<ChunkedCollectionKey, string> = {
  listings: 'listings',
  valuations: 'valuations',
  rentalEstimates: 'rental-estimates',
  importCostEstimates: 'import-cost-estimates',
  netRentalEstimates: 'net-rental-estimates',
  dataQualityReports: 'data-quality-reports',
  purchaseDecisions: 'purchase-decisions',
};

const collectionKeys = Object.keys(collectionFilePrefixes) as ChunkedCollectionKey[];

function normalizeBasePath(path: string): string {
  return path.replace(/\/+$/, '');
}

function chunkPath(prefix: string, index: number): string {
  return `chunks/${prefix}-${String(index).padStart(3, '0')}.json`;
}

function chunkUrl(publicBasePath: string, prefix: string, index: number): string {
  return `${normalizeBasePath(publicBasePath)}/${prefix}-${String(index).padStart(3, '0')}.json`;
}

function chunkRows<T>(rows: T[], chunkSize: number): T[][] {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) throw new Error(`chunkSize must be a positive integer, got ${chunkSize}`);
  const chunks: T[][] = [];
  for (let index = 0; index < rows.length; index += chunkSize) {
    chunks.push(rows.slice(index, index + chunkSize));
  }
  return chunks;
}

function collectionRows<K extends ChunkedCollectionKey>(snapshot: MarketSnapshot, key: K): ChunkRows<K> {
  return snapshot[key] as ChunkRows<K>;
}

export function buildChunkedMarketSnapshot(snapshot: MarketSnapshot, options: ChunkedSnapshotOptions = {}): ChunkedMarketSnapshot {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const publicBasePath = normalizeBasePath(options.publicBasePath ?? DEFAULT_PUBLIC_BASE_PATH);
  const descriptors = {} as Record<ChunkedCollectionKey, SnapshotChunkDescriptor[]>;
  const chunks: SnapshotChunkFile[] = [];

  for (const key of collectionKeys) {
    const prefix = collectionFilePrefixes[key];
    const rowChunks = chunkRows(collectionRows(snapshot, key), chunkSize);
    descriptors[key] = rowChunks.map((rows, index) => ({
      index,
      count: rows.length,
      url: chunkUrl(publicBasePath, prefix, index),
    }));
    chunks.push(...rowChunks.map((rows, index) => ({
      collection: key,
      path: chunkPath(prefix, index),
      rows,
    }) as SnapshotChunkFile));
  }

  const {
    schemaVersion: _schemaVersion,
    listings: _listings,
    valuations: _valuations,
    rentalEstimates: _rentalEstimates,
    importCostEstimates: _importCostEstimates,
    netRentalEstimates: _netRentalEstimates,
    dataQualityReports: _dataQualityReports,
    purchaseDecisions: _purchaseDecisions,
    ...staticSnapshot
  } = snapshot;

  return {
    manifest: {
      schemaVersion: 2,
      ...staticSnapshot,
      chunkSize,
      chunks: descriptors,
    },
    chunks,
  };
}

function asManifest(value: unknown): MarketSnapshotManifest {
  if (!value || typeof value !== 'object' || (value as { schemaVersion?: unknown }).schemaVersion !== 2) {
    throw new Error('Invalid chunked market snapshot manifest');
  }
  return value as MarketSnapshotManifest;
}

export async function loadChunkedMarketSnapshot(
  fetchJson: (url: string) => Promise<unknown>,
  manifestUrl = MANIFEST_URL,
): Promise<MarketSnapshot> {
  const manifest = asManifest(await fetchJson(manifestUrl));
  const entries = await Promise.all(collectionKeys.map(async (key) => {
    const rowSets = await Promise.all(manifest.chunks[key].map(async (chunk) => fetchJson(chunk.url)));
    return [key, rowSets.flat()] as const;
  }));
  const rowsByCollection = Object.fromEntries(entries) as Pick<MarketSnapshot,
    | 'listings'
    | 'valuations'
    | 'rentalEstimates'
    | 'importCostEstimates'
    | 'netRentalEstimates'
    | 'dataQualityReports'
    | 'purchaseDecisions'
  >;

  return {
    schemaVersion: 1,
    generatedAt: manifest.generatedAt,
    sources: manifest.sources,
    rentalSources: manifest.rentalSources,
    rentalComps: manifest.rentalComps,
    savedSearches: manifest.savedSearches,
    alertRules: manifest.alertRules,
    watchlist: manifest.watchlist,
    summary: manifest.summary,
    ...rowsByCollection,
  };
}

export async function loadMarketSnapshotFromStaticData(fetchJson: (url: string) => Promise<unknown>): Promise<MarketSnapshot> {
  try {
    return await loadChunkedMarketSnapshot(fetchJson, MANIFEST_URL);
  } catch (error) {
    const legacy = await fetchJson(LEGACY_SNAPSHOT_URL);
    if (!legacy || typeof legacy !== 'object' || (legacy as { schemaVersion?: unknown }).schemaVersion !== 1) throw error;
    return legacy as MarketSnapshot;
  }
}
