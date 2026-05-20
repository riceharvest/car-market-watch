import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { manualFixtureAdapter } from '../src/ingest/adapters/manualFixture';
import type { IngestionSnapshot } from '../src/ingest/types';
import { savedSearches } from '../src/data';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputPath = resolve(root, 'artifacts/ingestion/manual-fixture-snapshot.json');

const allowedAdapterSources = new Set<string>(['manual-fixture']);
const adapter = manualFixtureAdapter;

if (!allowedAdapterSources.has(adapter.source)) {
  throw new Error(`Adapter ${adapter.source} is not enabled for the manual ingestion runner.`);
}

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has('--write');
const requestedSearchIds = process.argv
  .slice(2)
  .filter((arg) => arg.startsWith('--search='))
  .map((arg) => arg.slice('--search='.length));

const selectedSearches = requestedSearchIds.length > 0 ? savedSearches.filter((search) => requestedSearchIds.includes(search.id)) : savedSearches;

if (selectedSearches.length === 0) {
  throw new Error(`No saved searches matched: ${requestedSearchIds.join(', ')}`);
}

// Compliance guardrails:
// - This skeleton intentionally performs no live external requests.
// - Future live adapters must stay allowlisted, source-reviewed, and disabled by default.
// - Add per-source robots/ToS review records, honest user-agent, low request rates,
//   retry/backoff, and automatic disablement on 403/429/CAPTCHA before enabling crawling.
// - Never run live crawling in Vercel build/preview commands.
const rawObservations = (await Promise.all(selectedSearches.map((search) => adapter.fetchSearch(search)))).flat();
const listings = rawObservations.map((observation) => adapter.normalize(observation));

const snapshot: IngestionSnapshot = {
  schemaVersion: 1,
  generatedAt: process.env.INGESTION_GENERATED_AT ?? new Date().toISOString(),
  adapter: adapter.source,
  mode: 'manual-fixture',
  searchIds: selectedSearches.map((search) => search.id),
  rawObservations,
  listings,
  notes: [
    'Manual fixture runner only; no marketplace, rental platform, or RDW requests were made.',
    'Use this output to validate normalization and snapshot plumbing before any compliant live adapter exists.',
  ],
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
      note: shouldWrite ? 'Snapshot written.' : 'Preview only. Re-run with --write to create artifacts/ingestion/manual-fixture-snapshot.json.',
    },
    null,
    2,
  ),
);
