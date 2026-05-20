import { describe, expect, it } from 'vitest';
import { importCountryProfiles } from '../src/data/importProfiles';
import { estimateImportCost } from '../src/domain/importCost';
import type { Listing } from '../src/types';

const baseListing: Listing = {
  id: 'target',
  source: 'autoscout24',
  country: 'DE',
  url: 'https://example.test/target',
  title: 'Volkswagen Golf target',
  make: 'Volkswagen',
  model: 'Golf',
  priceEur: 18000,
  mileageKm: 90000,
  year: 2020,
  fuel: 'petrol',
  transmission: 'automatic',
  location: 'Köln',
  sellerType: 'dealer',
  firstSeen: '2026-05-01',
  lastSeen: '2026-05-20',
  confidence: 'high',
};

function listing(overrides: Partial<Listing>): Listing {
  return { ...baseListing, ...overrides };
}

describe('import cost estimates', () => {
  it('keeps EU/EFTA customs duty and VAT at zero', () => {
    const estimate = estimateImportCost(listing({ country: 'BE', co2GPerKm: 118, firstRegistrationDate: '2020-04-15' }));

    expect(estimate.region).toBe('eu-efta');
    expect(estimate.customsDutyEstimateEur).toBe(0);
    expect(estimate.vatEstimateEur).toBe(0);
    expect(estimate.bpmEstimateEur).toBeGreaterThan(0);
    expect(estimate.assumptions.join(' ')).toContain('EU/EFTA');
  });

  it('marks missing BPM inputs as manual and low confidence', () => {
    const estimate = estimateImportCost(listing({ country: 'DE', co2GPerKm: undefined, firstRegistrationDate: undefined }));

    expect(estimate.needsManualBpm).toBe(true);
    expect(estimate.confidence).toBe('low');
    expect(estimate.bpmEstimateEur).toBeGreaterThanOrEqual(3000);
    expect(estimate.adminBufferEur).toBeGreaterThan(importCountryProfiles.DE.adminBufferEur);
  });

  it('returns zero import costs for domestic NL listings', () => {
    const estimate = estimateImportCost(listing({ country: 'NL', id: 'nl-listing', priceEur: 15000 }));

    expect(estimate.region).toBe('domestic-nl');
    expect(estimate.confidence).toBe('high');
    expect(estimate.totalImportCostEur).toBe(0);
    expect(estimate.landedCostEur).toBe(15000);
    expect(estimate.needsManualBpm).toBe(false);
  });

  it('uses listing BPM overrides for EU/EFTA imports', () => {
    const estimate = estimateImportCost(listing({ country: 'DE', bpmOverrideEur: 1234 }));

    expect(estimate.bpmEstimateEur).toBe(1234);
    expect(estimate.needsManualBpm).toBe(false);
    expect(['medium', 'high']).toContain(estimate.confidence);
    expect(estimate.assumptions.join(' ')).toContain('override');
  });

  it('defines increasing transport tiers for nearby EU profiles', () => {
    expect(importCountryProfiles.NL.transportEur).toBe(0);
    expect(importCountryProfiles.BE.transportEur).toBeLessThan(importCountryProfiles.DE.transportEur);
    expect(importCountryProfiles.DE.transportEur).toBeLessThan(importCountryProfiles.FR.transportEur);
  });
});
