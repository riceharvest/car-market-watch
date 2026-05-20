import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { savedSearches } from '../src/data';
import { manualFixtureAdapter } from '../src/ingest/adapters/manualFixture';
import { blockedOrGatedLiveSources, liveAdapters, reachableLiveSources } from '../src/ingest/liveAdapters';
import type { IngestionSnapshot, ListingAdapter, RawListingObservation } from '../src/ingest/types';
import type { Listing, SavedSearch } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const manualOutputPath = resolve(root, 'artifacts/ingestion/manual-fixture-snapshot.json');
const liveOutputPath = resolve(root, 'artifacts/ingestion/latest-live-ingestion.json');

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const liveMode = args.has('--live');
const requestedSearchIds = process.argv
  .slice(2)
  .filter((arg) => arg.startsWith('--search='))
  .map((arg) => arg.slice('--search='.length));

const selectedSearches = requestedSearchIds.length > 0 ? savedSearches.filter((search) => requestedSearchIds.includes(search.id)) : savedSearches;

if (selectedSearches.length === 0) {
  throw new Error(`No saved searches matched: ${requestedSearchIds.join(', ')}`);
}

async function runAdapter(adapter: ListingAdapter, searches: SavedSearch[]): Promise<{ raw: RawListingObservation[]; listings: Listing[]; errors: string[] }> {
  const raw: RawListingObservation[] = [];
  const listings: Listing[] = [];
  const errors: string[] = [];

  for (const search of searches) {
    try {
      const observations = await adapter.fetchSearch(search);
      raw.push(...observations);
      listings.push(...observations.map((observation) => adapter.normalize(observation)));
    } catch (error) {
      errors.push(`${adapter.source} / ${search.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { raw, listings, errors };
}

function dedupeListings(listings: Listing[]): Listing[] {
  const seen = new Set<string>();
  const deduped: Listing[] = [];
  for (const listing of listings) {
    if (seen.has(listing.id)) continue;
    seen.add(listing.id);
    deduped.push(listing);
  }
  return deduped;
}

const outputPath = liveMode ? liveOutputPath : manualOutputPath;
const generatedAt = process.env.INGESTION_GENERATED_AT ?? new Date().toISOString();
let rawObservations: RawListingObservation[] = [];
let listings: Listing[] = [];
const notes: string[] = [];

if (liveMode) {
  // Compliance guardrails:
  // - Only allowlisted public search-page adapters run here.
  // - No private APIs, no authenticated endpoints, no blocked mobile.de search scraping.
  // - Each adapter is low-volume: one request per configured saved search URL, with delay.
  // - Failed/blocked sources are reported as notes, not bypassed.
  for (const adapter of liveAdapters) {
    const result = await runAdapter(adapter, selectedSearches);
    rawObservations.push(...result.raw);
    listings.push(...result.listings);
    notes.push(...result.errors.map((message) => `Adapter error: ${message}`));
  }
  notes.push(`Live adapters enabled: ${reachableLiveSources.join(', ')}.`);
  for (const [source, reason] of Object.entries(blockedOrGatedLiveSources)) {
    notes.push(`${source} skipped: ${reason}`);
  }
} else {
  const result = await runAdapter(manualFixtureAdapter, selectedSearches);
  rawObservations = result.raw;
  listings = result.listings;
  notes.push(...result.errors.map((message) => `Adapter error: ${message}`));
  notes.push('Manual fixture runner only; no marketplace, rental platform, or RDW requests were made.');
  notes.push('Use --live --write to capture allowlisted public marketplace observations.');
}

listings = dedupeListings(listings);

const snapshot: IngestionSnapshot = {
  schemaVersion: 1,
  generatedAt,
  adapter: liveMode ? 'live-marketplaces' : manualFixtureAdapter.source,
  mode: liveMode ? 'live-marketplaces' : 'manual-fixture',
  searchIds: selectedSearches.map((search) => search.id),
  rawObservations,
  listings,
  notes,
};

if (shouldWrite) {
  await mkdir(dirname(outputPath), { recursive: true });
  const tmpPath = `${outputPath}.tmp`;
  await writeFile(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  await rename(tmpPath, outputPath);
}

console.log(
  JSON.stringify(
    {
      mode: snapshot.mode,
      adapter: snapshot.adapter,
      searchIds: snapshot.searchIds,
      rawObservationCount: snapshot.rawObservations.length,
      listingCount: snapshot.listings.length,
      outputPath: shouldWrite ? outputPath : null,
      write: shouldWrite,
      notes: snapshot.notes,
      note: shouldWrite ? 'Snapshot written.' : `Preview only. Re-run with ${liveMode ? '--live ' : ''}--write to create ${outputPath}.`,
    },
    null,
    2,
  ),
);
