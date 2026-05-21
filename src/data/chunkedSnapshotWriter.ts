import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { buildChunkedMarketSnapshot, type ChunkedSnapshotOptions, type MarketSnapshotManifest } from './chunkedSnapshot';
import type { MarketSnapshot } from '../types';

export async function writeChunkedMarketSnapshot(
  snapshot: MarketSnapshot,
  outputDir: string,
  options: ChunkedSnapshotOptions = {},
): Promise<{ manifestPath: string; chunkPaths: string[]; manifest: MarketSnapshotManifest }> {
  const chunked = buildChunkedMarketSnapshot(snapshot, options);
  const chunksDir = join(outputDir, 'chunks');
  await mkdir(chunksDir, { recursive: true });
  await mkdir(outputDir, { recursive: true });

  const existing = await readdir(chunksDir).catch(() => [] as string[]);
  await Promise.all(existing.filter((file) => file.endsWith('.json')).map((file) => rm(join(chunksDir, file), { force: true })));

  const chunkPaths: string[] = [];
  for (const chunk of chunked.chunks) {
    const finalPath = join(outputDir, chunk.path);
    const tmpPath = `${finalPath}.tmp`;
    await writeFile(tmpPath, `${JSON.stringify(chunk.rows)}\n`, 'utf8');
    await rename(tmpPath, finalPath);
    chunkPaths.push(finalPath);
  }

  const manifestPath = join(outputDir, 'market-snapshot-manifest.json');
  const manifestTmpPath = `${manifestPath}.tmp`;
  await writeFile(manifestTmpPath, `${JSON.stringify(chunked.manifest, null, 2)}\n`, 'utf8');
  await rename(manifestTmpPath, manifestPath);

  return { manifestPath, chunkPaths, manifest: chunked.manifest };
}
