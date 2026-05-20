import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMarketSnapshot } from '../src/domain/snapshot';
import type { IngestionSnapshot } from '../src/ingest/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputPath = resolve(root, 'public/data/market-snapshot.json');
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

await mkdir(dirname(outputPath), { recursive: true });
const tmpPath = `${outputPath}.tmp`;
await writeFile(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await rename(tmpPath, outputPath);

console.log(
  JSON.stringify(
    {
      outputPath,
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
