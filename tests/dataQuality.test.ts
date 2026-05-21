import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/types';
import { buildDataQualityReport, buildDataQualityReports } from '../src/domain/dataQuality';

const baseListing: Listing = {
  id: 'complete-nl',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/listing/complete-nl',
  title: 'Volkswagen Golf 1.5 TSI',
  make: 'Volkswagen',
  model: 'Golf',
  priceEur: 18000,
  mileageKm: 90000,
  year: 2020,
  fuel: 'petrol',
  transmission: 'automatic',
  location: 'Utrecht',
  sellerType: 'dealer',
  firstSeen: '2026-05-01',
  lastSeen: '2026-05-20',
  confidence: 'high',
};

function listing(overrides: Partial<Listing>): Listing {
  return { ...baseListing, ...overrides };
}

describe('data quality reports', () => {
  it('passes a complete listing with high confidence', () => {
    const report = buildDataQualityReport(baseListing, {
      rentalEstimate: { listingId: baseListing.id, compCount: 3, confidence: 'high' },
    });

    expect(report).toEqual(
      expect.objectContaining({
        listingId: 'complete-nl',
        completenessPct: 100,
        missingCriticalFields: [],
        warnings: [],
        confidence: 'high',
      }),
    );
  });

  it('flags an imported listing missing BPM/CO2 as a critical missing field', () => {
    const imported = listing({ id: 'import-de', country: 'DE', url: 'https://example.test/import-de' });

    const report = buildDataQualityReport(imported, {
      importEstimate: { listingId: imported.id, needsManualBpm: true, confidence: 'low' },
      rentalEstimate: { listingId: imported.id, compCount: 2, confidence: 'medium' },
    });

    expect(report.missingCriticalFields).toContain('CO2 of BPM-override voor import');
    expect(report.warnings.join(' ')).toContain('mist CO2/BPM-override');
    expect(report.completenessPct).toBeLessThan(100);
    expect(report.confidence).not.toBe('high');
  });

  it('lowers confidence when aantal verhuurcomparables is zero', () => {
    const report = buildDataQualityReport(baseListing, {
      rentalEstimate: { listingId: baseListing.id, compCount: 0, confidence: 'low' },
    });

    expect(report.missingCriticalFields).toContain('aantal verhuurcomparables');
    expect(report.warnings.join(' ')).toContain('Aantal verhuurcomparables is nul');
    expect(report.confidence).toBe('medium');
  });

  it('builds reports for multiple listings from a context map', () => {
    const imported = listing({ id: 'import-with-bpm', country: 'BE', bpmOverrideEur: 1200 });

    const reports = buildDataQualityReports([baseListing, imported], {
      'complete-nl': { rentalEstimate: { listingId: 'complete-nl', compCount: 2, confidence: 'high' } },
      'import-with-bpm': {
        importEstimate: { listingId: 'import-with-bpm', bpmEur: 1200, confidence: 'medium' },
        rentalEstimate: { listingId: 'import-with-bpm', compCount: 1, confidence: 'medium' },
      },
    });

    expect(reports).toHaveLength(2);
    expect(reports.map((report) => report.listingId)).toEqual(['complete-nl', 'import-with-bpm']);
    expect(reports[1].missingCriticalFields).not.toContain('CO2 of BPM-override voor import');
  });
});
