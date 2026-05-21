import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = join(__dirname, '..');
const liveIngestionWorkflow = readFileSync(join(repoRoot, '.github/workflows/live-ingestion.yml'), 'utf8');

describe('automated live ingestion workflow', () => {
  it('runs on a daily off-peak schedule instead of artifact-only weekly cadence', () => {
    expect(liveIngestionWorkflow).toContain("- cron: '17 4 * * *'");
    expect(liveIngestionWorkflow).not.toContain("- cron: '17 4 * * 2'");
  });

  it('can publish refreshed static snapshot chunks back to the repository', () => {
    expect(liveIngestionWorkflow).toContain('contents: write');
    expect(liveIngestionWorkflow).toContain('pnpm run data:build');
    expect(liveIngestionWorkflow).toContain('public/data/market-snapshot-manifest.json');
    expect(liveIngestionWorkflow).toContain('public/data/chunks/');
    expect(liveIngestionWorkflow).toContain('git commit');
    expect(liveIngestionWorkflow).toContain('git push');
  });

  it('persists price history to the database automatically when DATABASE_URL is configured', () => {
    expect(liveIngestionWorkflow).toContain('INGESTION_DB_MODE: ${{ secrets.DATABASE_URL != \'\' && \'db\' || \'json\' }}');
    expect(liveIngestionWorkflow).toContain('DATABASE_URL: ${{ secrets.DATABASE_URL }}');
  });
});
