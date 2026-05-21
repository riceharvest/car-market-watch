import type { Listing, RentalComparable, RentalSourceMetadata } from '../types';

export type ListingActionLinks = {
  source: {
    label: 'Actual listing';
    url: string;
  };
};

export type RentalCompetitorLink = {
  source: RentalComparable['source'];
  label: string;
  url: string;
  matchType: 'same-model' | 'close-spec';
  dailyRateEur: number;
  city: string;
  confidence: RentalComparable['confidence'];
  sourceType: RentalComparable['sourceType'];
  basis: string;
  notes: string;
};

export function buildListingActionLinks(listing: Listing): ListingActionLinks {
  return {
    source: {
      label: 'Actual listing',
      url: listing.url,
    },
  };
}

export function buildRentalCompetitorLinks(
  listing: Listing,
  rentalComps: RentalComparable[],
  rentalSources: RentalSourceMetadata[],
  maxLinks = 4,
): RentalCompetitorLink[] {
  const sourceById = new Map(rentalSources.map((source) => [source.id, source]));
  const bestBySource = new Map<RentalComparable['source'], { comp: RentalComparable; score: number; matchType: 'same-model' | 'close-spec' }>();

  for (const comp of rentalComps) {
    const match = scoreRentalCompMatch(listing, comp);
    if (!match) continue;

    const existing = bestBySource.get(comp.source);
    if (!existing || match.score > existing.score) {
      bestBySource.set(comp.source, { comp, score: match.score, matchType: match.matchType });
    }
  }

  return Array.from(bestBySource.values())
    .sort((a, b) => b.score - a.score || b.comp.dailyRateEur - a.comp.dailyRateEur)
    .slice(0, maxLinks)
    .map(({ comp, matchType }) => {
      const source = sourceById.get(comp.source);
      return {
        source: comp.source,
        label: source?.label ?? comp.source,
        url: source?.baseUrl ?? '#',
        matchType,
        dailyRateEur: comp.dailyRateEur,
        city: comp.city,
        confidence: comp.confidence,
        sourceType: comp.sourceType,
        basis: describeCompBasis(comp),
        notes: comp.sourceType === 'peer-to-peer'
          ? comp.availabilityNote
          : `${comp.availabilityNote} Benchmark only; not owner payout.`,
      };
    });
}

function scoreRentalCompMatch(listing: Listing, comp: RentalComparable): { score: number; matchType: 'same-model' | 'close-spec' } | null {
  const anchors = comp.anchors;
  const sameMake = normalizedEqual(anchors.make, listing.make);
  const sameModel = normalizedEqual(anchors.model, listing.model);
  const yearDistance = Math.abs(anchors.year - listing.year);
  const mileageInBand = listing.mileageKm >= anchors.mileageBandKm.min && listing.mileageKm <= anchors.mileageBandKm.max;
  const fuelCompatible = anchors.fuel === 'unknown' || anchors.fuel === listing.fuel;
  const transmissionCompatible = anchors.transmission === 'unknown' || anchors.transmission === listing.transmission;

  if (sameMake && sameModel && yearDistance <= 4 && fuelCompatible) {
    return {
      matchType: 'same-model',
      score: 100 - yearDistance * 5 + (mileageInBand ? 10 : 0) + (transmissionCompatible ? 5 : 0) + confidenceScore(comp.confidence),
    };
  }

  const hasClassBenchmark = !anchors.make && !anchors.model;
  if (hasClassBenchmark && yearDistance <= 5 && transmissionCompatible && fuelCompatible) {
    return {
      matchType: 'close-spec',
      score: 55 - yearDistance * 3 + (mileageInBand ? 8 : 0) + confidenceScore(comp.confidence),
    };
  }

  return null;
}

function normalizedEqual(left: string | undefined, right: string): boolean {
  return normalize(left) === normalize(right);
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '') ?? '';
}

function confidenceScore(confidence: RentalComparable['confidence']): number {
  if (confidence === 'high') return 10;
  if (confidence === 'medium') return 5;
  return 0;
}

function describeCompBasis(comp: RentalComparable): string {
  const model = [comp.anchors.make, comp.anchors.model].filter(Boolean).join(' ') || `${comp.vehicleClass} class`;
  return `${model} · ${comp.city} · ${comp.anchors.year} · ${comp.anchors.fuel} · ${comp.anchors.transmission}`;
}
