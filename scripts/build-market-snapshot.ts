import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMarketSnapshot } from '../src/domain/snapshot';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputPath = resolve(root, 'public/data/market-snapshot.json');

const generatedAt = process.env.SNAPSHOT_GENERATED_AT ?? new Date().toISOString();
const snapshot = buildMarketSnapshot({ generatedAt });

await mkdir(dirname(outputPath), { recursive: true });
const tmpPath = `${outputPath}.tmp`;
await writeFile(tmpPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
await rename(tmpPath, outputPath);

console.log(
  JSON.stringify(
    {
      outputPath,
      listingCount: snapshot.summary.listingCount,
      sourceCount: snapshot.summary.sourceCount,
      valuationCount: snapshot.valuations.length,
      generatedAt: snapshot.generatedAt,
    },
    null,
    2,
  ),
);
