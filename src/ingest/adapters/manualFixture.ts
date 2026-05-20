import { sampleListings } from '../../data/sampleListings';
import type { Listing, SavedSearch } from '../../types';
import type { ListingAdapter, RawListingObservation } from '../types';

export type ManualFixtureObservation = RawListingObservation & {
  payload: Listing;
};

const DEFAULT_OBSERVED_AT = '2026-05-20T00:00:00.000Z';

function matchesSearch(listing: Listing, search: SavedSearch): boolean {
  if (listing.make.toLowerCase() !== search.make.toLowerCase()) return false;
  if (listing.model.toLowerCase() !== search.model.toLowerCase()) return false;
  if (!search.countries.includes(listing.country)) return false;
  if (search.minYear !== undefined && listing.year < search.minYear) return false;
  if (search.maxYear !== undefined && listing.year > search.maxYear) return false;
  if (search.maxMileageKm !== undefined && listing.mileageKm > search.maxMileageKm) return false;
  if (search.minPriceEur !== undefined && listing.priceEur < search.minPriceEur) return false;
  if (search.maxPriceEur !== undefined && listing.priceEur > search.maxPriceEur) return false;
  if (search.fuels !== undefined && !search.fuels.includes(listing.fuel)) return false;
  if (search.transmissions !== undefined && !search.transmissions.includes(listing.transmission)) return false;
  if (search.sellerTypes !== undefined && !search.sellerTypes.includes(listing.sellerType)) return false;

  return true;
}

function toObservation(listing: Listing, searchId: string): ManualFixtureObservation {
  return {
    source: listing.source,
    sourceListingId: listing.id,
    observedAt: DEFAULT_OBSERVED_AT,
    searchId,
    url: listing.url,
    payload: { ...listing },
  };
}

export const manualFixtureAdapter: ListingAdapter<ManualFixtureObservation> = {
  source: 'manual-fixture',

  async fetchSearch(search) {
    return sampleListings.filter((listing) => matchesSearch(listing, search)).map((listing) => toObservation(listing, search.id));
  },

  normalize(raw) {
    return {
      ...raw.payload,
      source: raw.source,
      id: raw.sourceListingId,
      url: raw.url,
      lastSeen: raw.payload.lastSeen,
    };
  },
};
