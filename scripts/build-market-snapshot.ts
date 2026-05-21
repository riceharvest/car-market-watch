import { readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeChunkedMarketSnapshot } from '../src/data/chunkedSnapshotWriter';
import { buildMarketSnapshot } from '../src/domain/snapshot';
import type { IngestionSnapshot } from '../src/ingest/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputDir = resolve(root, 'public/data');
const legacyOutputPath = resolve(outputDir, 'market-snapshot.json');
const ingestionSnapshotPath = resolve(root, process.env.INGESTION_SNAPSHOT_PATH ?? 'artifacts/ingestion/latest-live-ingestion.json');

async function loadIngestedListings(): Promise<IngestionSnapshot | null> {
  try {
    const raw = await readFile(ingestionSnapshotPath, 'utf8');
    return JSON.parse(raw) as IngestionSnapshot;
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

const generatedAt = process.env.SNAPSHOT_GENERATED_AT ?? new Date().toISOString();
const ingestionSnapshot = await loadIngestedListings();
const snapshot = buildMarketSnapshot({
  generatedAt,
  listings: ingestionSnapshot?.listings.length ? ingestionSnapshot.listings : undefined,
});

const chunked = await writeChunkedMarketSnapshot(snapshot, outputDir, { chunkSize: 500, publicBasePath: '/data/chunks' });
// Remove the old giant payload if it was produced by a previous build; the app still
// supports it as a fallback when served from older deployments.
await rm(legacyOutputPath, { force: true });

console.log(
  JSON.stringify(
    {
      outputPath: chunked.manifestPath,
      chunkCount: chunked.chunkPaths.length,
      chunkSize: chunked.manifest.chunkSize,
      ingestionSnapshotPath: ingestionSnapshot?.listings.length ? ingestionSnapshotPath : null,
      ingestionMode: ingestionSnapshot?.mode ?? 'sample-fixture-fallback',
      listingCount: snapshot.summary.listingCount,
      sourceCount: snapshot.summary.sourceCount,
      valuationCount: snapshot.valuations.length,
      rentalSourceCount: snapshot.rentalSources.length,
      rentalCompCount: snapshot.rentalComps.length,
      rentalEstimateCount: snapshot.rentalEstimates.length,
      importCostEstimateCount: snapshot.importCostEstimates.length,
      netRentalEstimateCount: snapshot.netRentalEstimates.length,
      purchaseDecisionCount: snapshot.purchaseDecisions.length,
      buyNowCount: snapshot.summary.buyNowCount,
      needsDataCount: snapshot.summary.needsDataCount,
      bestPurchaseListingId: snapshot.summary.bestPurchaseListingId,
      generatedAt: snapshot.generatedAt,
    },
    null,
    2,
  ),
);
