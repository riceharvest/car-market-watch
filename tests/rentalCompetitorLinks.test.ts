import { describe, expect, it } from 'vitest';
import { buildListingActionLinks, buildRentalCompetitorLinks } from '../src/domain/rentalCompetitorLinks';
import type { Listing, RentalComparable, RentalSourceMetadata } from '../src/types';

const listing: Listing = {
  id: 'autoscout24:test-golf',
  source: 'autoscout24',
  country: 'NL',
  url: 'https://www.autoscout24.nl/aanbod/test-golf',
  title: 'Volkswagen Golf 1.5 TSI DSG',
  make: 'Volkswagen',
  model: 'Golf',
  priceEur: 15_000,
  mileageKm: 90_000,
  year: 2019,
  fuel: 'petrol',
  transmission: 'automatic',
  location: 'Utrecht',
  sellerType: 'dealer',
  firstSeen: '2026-05-20T00:00:00.000Z',
  lastSeen: '2026-05-21T00:00:00.000Z',
  confidence: 'high',
};

const sources: RentalSourceMetadata[] = [
  {
    id: 'snappcar',
    label: 'SnappCar',
    baseUrl: 'https://www.snappcar.nl/',
    countries: ['NL'],
    sourceType: 'peer-to-peer',
    access: 'city-page-html',
    scrapePriority: 'primary',
    robotsNote: 'ok',
    feasibilityNote: 'ok',
    reliability: 'medium',
  },
  {
    id: 'sixt',
    label: 'Sixt',
    baseUrl: 'https://www.sixt.com/',
    countries: ['NL'],
    sourceType: 'commercial-fleet',
    access: 'api-partner',
    scrapePriority: 'benchmark',
    robotsNote: 'ok',
    feasibilityNote: 'ok',
    reliability: 'low',
  },
];

const comps: RentalComparable[] = [
  {
    id: 'snap-golf-close',
    source: 'snappcar',
    sourceType: 'peer-to-peer',
    country: 'NL',
    city: 'Utrecht',
    dailyRateEur: 49,
    vehicleClass: 'compact',
    anchors: {
      make: 'Volkswagen',
      model: 'Golf',
      fuel: 'petrol',
      transmission: 'automatic',
      year: 2018,
      mileageBandKm: { min: 70_000, max: 130_000 },
    },
    confidence: 'medium',
    availabilityNote: 'Close comp',
    feesNote: 'Gross rate',
    observedAt: '2026-05-20',
  },
  {
    id: 'sixt-compact-class',
    source: 'sixt',
    sourceType: 'commercial-fleet',
    country: 'NL',
    city: 'Amsterdam',
    dailyRateEur: 74,
    vehicleClass: 'compact',
    anchors: {
      fuel: 'unknown',
      transmission: 'automatic',
      year: 2022,
      mileageBandKm: { min: 0, max: 50_000 },
    },
    confidence: 'low',
    availabilityNote: 'Class benchmark',
    feesNote: 'Fleet benchmark',
    observedAt: '2026-05-20',
  },
];

describe('listing action links', () => {
  it('keeps the actual marketplace listing URL as the primary source link', () => {
    expect(buildListingActionLinks(listing).source).toEqual({
      label: 'Advertentie bekijken',
      url: 'https://www.autoscout24.nl/aanbod/test-golf',
    });
  });
});

describe('rental competitor links', () => {
  it('returns rental company links for exact and close-spec comps without duplicating a source', () => {
    const links = buildRentalCompetitorLinks(listing, comps, sources);

    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      label: 'SnappCar',
      url: 'https://www.snappcar.nl/',
      matchType: 'same-model',
      dailyRateEur: 49,
      basis: 'Volkswagen Golf · Utrecht · 2018 · benzine · automaat',
    });
    expect(links[1]).toMatchObject({
      label: 'Sixt',
      url: 'https://www.sixt.com/',
      matchType: 'close-spec',
      dailyRateEur: 74,
    });
  });

  it('filters out rental comps that are too far away from the listing spec', () => {
    const unrelated: RentalComparable = {
      ...comps[0],
      id: 'snap-aygo-old-manual',
      anchors: {
        make: 'Toyota',
        model: 'Aygo',
        fuel: 'petrol',
        transmission: 'manual',
        year: 2010,
        mileageBandKm: { min: 200_000, max: 250_000 },
      },
    };

    expect(buildRentalCompetitorLinks(listing, [unrelated], sources)).toEqual([]);
  });
});
