import { mkdtemp, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { buildChunkedMarketSnapshot, loadChunkedMarketSnapshot } from '../src/data/chunkedSnapshot';
import { writeChunkedMarketSnapshot } from '../src/data/chunkedSnapshotWriter';
import { buildMarketSnapshot } from '../src/domain/snapshot';

const generatedAt = '2026-05-20T12:00:00.000Z';

describe('chunked market snapshot delivery', () => {
  it('splits large listing-scoped arrays into aligned chunk manifests without embedding rows', () => {
    const snapshot = buildMarketSnapshot({ generatedAt });
    const chunked = buildChunkedMarketSnapshot(snapshot, { chunkSize: 2, publicBasePath: '/data/chunks' });

    expect(chunked.manifest.schemaVersion).toBe(2);
    expect(chunked.manifest.generatedAt).toBe(generatedAt);
    expect(chunked.manifest.summary).toEqual(snapshot.summary);
    expect(chunked.manifest.listings).toBeUndefined();
    expect(chunked.manifest.chunks.listings).toHaveLength(Math.ceil(snapshot.listings.length / 2));
    expect(chunked.manifest.chunks.valuations).toHaveLength(chunked.manifest.chunks.listings.length);
    expect(chunked.manifest.chunks.purchaseDecisions[0]).toMatchObject({ index: 0, count: 2, url: '/data/chunks/purchase-decisions-000.json' });
    expect(chunked.chunks.find((chunk) => chunk.path === 'chunks/listings-000.json')?.rows).toEqual(snapshot.listings.slice(0, 2));
    expect(chunked.chunks.find((chunk) => chunk.path === 'chunks/valuations-000.json')?.rows).toEqual(snapshot.valuations.slice(0, 2));
  });

  it('round-trips through a manifest fetcher into the legacy MarketSnapshot shape', async () => {
    const snapshot = buildMarketSnapshot({ generatedAt });
    const chunked = buildChunkedMarketSnapshot(snapshot, { chunkSize: 3, publicBasePath: '/data/chunks' });
    const payloads = new Map<string, unknown>([
      ['/data/market-snapshot-manifest.json', chunked.manifest],
      ...chunked.chunks.map((chunk) => [`/data/${chunk.path}`, chunk.rows] as const),
    ]);

    const loaded = await loadChunkedMarketSnapshot(async (url) => {
      const payload = payloads.get(url);
      if (!payload) throw new Error(`Unexpected URL ${url}`);
      return payload;
    });

    expect(loaded).toEqual(snapshot);
  });

  it('writes manifest and chunk files under public/data', async () => {
    const snapshot = buildMarketSnapshot({ generatedAt });
    const outputDir = await mkdtemp(join(tmpdir(), 'market-snapshot-'));

    const result = await writeChunkedMarketSnapshot(snapshot, outputDir, { chunkSize: 4, publicBasePath: '/data/chunks' });

    expect(result.manifestPath).toBe(join(outputDir, 'market-snapshot-manifest.json'));
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
    expect(manifest.schemaVersion).toBe(2);
    expect(manifest.chunks.listings[0].url).toBe('/data/chunks/listings-000.json');
    const firstListingChunk = JSON.parse(await readFile(join(outputDir, 'chunks/listings-000.json'), 'utf8'));
    expect(firstListingChunk).toEqual(snapshot.listings.slice(0, 4));
  });
});
