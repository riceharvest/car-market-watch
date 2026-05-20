import { describe, expect, it } from 'vitest';
import type { Listing, RentalComparable, RentalCostAssumptions } from '../src/types';
import {
  defaultRentalCostAssumptions,
  estimateNetRentalRevenue,
  estimateRentalRevenue,
} from '../src/domain/rentalRevenue';

const baseListing: Listing = {
  id: 'target',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://example.test/target',
  title: 'Volkswagen Golf target',
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

function rentalComp(overrides: Partial<RentalComparable> = {}): RentalComparable {
  return {
    id: 'rent-comp',
    source: 'snappcar',
    sourceType: 'peer-to-peer',
    country: 'NL',
    city: 'Utrecht',
    dailyRateEur: 50,
    vehicleClass: 'compact',
    anchors: {
      make: 'Volkswagen',
      model: 'Golf',
      fuel: 'petrol',
      transmission: 'automatic',
      year: 2020,
      mileageBandKm: { min: 70000, max: 110000 },
    },
    confidence: 'high',
    availabilityNote: 'Test availability note',
    feesNote: 'Test fees note',
    observedAt: '2026-05-20',
    ...overrides,
  };
}

const rentalComps = [
  rentalComp({ id: 'c1', dailyRateEur: 50 }),
  rentalComp({ id: 'c2', dailyRateEur: 54, city: 'Amsterdam' }),
  rentalComp({ id: 'c3', dailyRateEur: 52, anchors: { make: 'Volkswagen', model: 'Golf', fuel: 'petrol', transmission: 'manual', year: 2020, mileageBandKm: { min: 70000, max: 110000 } } }),
];

function grossEstimate(listing: Listing = baseListing) {
  return estimateRentalRevenue(listing, rentalComps, {
    weeklyBookedDays: 3,
    monthlyBookedDays: 12,
    annualBookedDays: 120,
  });
}

describe('net rental economics', () => {
  it('converts gross rental revenue into lower net rental economics using exported conservative defaults', () => {
    const gross = grossEstimate();
    const net = estimateNetRentalRevenue(baseListing, gross);

    expect(defaultRentalCostAssumptions).toEqual({
      platformFeePct: expect.any(Number),
      insuranceMonthlyEur: expect.any(Number),
      cleaningPerBookingEur: expect.any(Number),
      maintenanceReservePct: expect.any(Number),
      taxReservePct: expect.any(Number),
      downtimeReservePct: expect.any(Number),
      averageBookingsPerMonth: expect.any(Number),
    });
    expect(net.annualGrossEur).toBe(gross.annualGrossEur);
    expect(net.platformFeesEur).toBeGreaterThan(0);
    expect(net.insuranceEur).toBeGreaterThan(0);
    expect(net.cleaningEur).toBeGreaterThan(0);
    expect(net.maintenanceReserveEur).toBeGreaterThan(0);
    expect(net.taxReserveEur).toBeGreaterThan(0);
    expect(net.downtimeReserveEur).toBeGreaterThan(0);
    expect(net.netAnnualRentalEur).toBeLessThan(gross.annualGrossEur);
    expect(net.netMonthlyRentalEur).toBe(Math.round(net.netAnnualRentalEur / 12));
    expect(net.landedCostEur).toBe(baseListing.priceEur);
    expect(net.netRentalYieldOnLandedCostPct).toBeCloseTo((net.netAnnualRentalEur / baseListing.priceEur) * 100, 1);
  });

  it('changes net output when rental cost assumptions change', () => {
    const gross = grossEstimate();
    const lowCostAssumptions: RentalCostAssumptions = {
      platformFeePct: 5,
      insuranceMonthlyEur: 50,
      cleaningPerBookingEur: 10,
      maintenanceReservePct: 3,
      taxReservePct: 8,
      downtimeReservePct: 2,
      averageBookingsPerMonth: 4,
    };

    const defaultNet = estimateNetRentalRevenue(baseListing, gross);
    const lowCostNet = estimateNetRentalRevenue(baseListing, gross, lowCostAssumptions);

    expect(lowCostNet.netAnnualRentalEur).toBeGreaterThan(defaultNet.netAnnualRentalEur);
    expect(lowCostNet.platformFeesEur).toBeLessThan(defaultNet.platformFeesEur);
    expect(lowCostNet.cleaningEur).toBeLessThan(defaultNet.cleaningEur);
    expect(lowCostNet.assumptions).toEqual(lowCostAssumptions);
  });

  it('uses import landed cost for German listings, lowering net yield compared with listing price basis', () => {
    const germanListing: Listing = {
      ...baseListing,
      id: 'de-import',
      country: 'DE',
      source: 'mobile-de-api',
      priceEur: 16000,
      location: 'Köln',
    };
    const gross = grossEstimate({ ...germanListing, country: 'NL', location: 'Utrecht' });

    const listingPriceYield = estimateNetRentalRevenue(germanListing, gross);
    const landedCostYield = estimateNetRentalRevenue({ ...germanListing, landedCostEur: 21000 }, gross);

    expect(listingPriceYield.landedCostEur).toBe(germanListing.priceEur);
    expect(landedCostYield.landedCostEur).toBe(21000);
    expect(landedCostYield.netAnnualRentalEur).toBe(listingPriceYield.netAnnualRentalEur);
    expect(landedCostYield.netRentalYieldOnLandedCostPct).toBeLessThan(listingPriceYield.netRentalYieldOnLandedCostPct);
  });
});
