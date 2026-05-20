import type { Confidence, DuplicateListingCluster, Listing } from '../types';

export function clusterDuplicateListings(listings: Listing[]): DuplicateListingCluster[] {
  if (listings.length < 2) return [];

  const parent = new Map<string, string>();
  const edgeScores = new Map<string, number[]>();
  const edgeReasons = new Map<string, Set<string>>();

  for (const listing of listings) parent.set(listing.id, listing.id);

  for (let i = 0; i < listings.length; i += 1) {
    for (let j = i + 1; j < listings.length; j += 1) {
      const match = duplicateScore(listings[i], listings[j]);
      if (match.score >= 70) {
        union(parent, listings[i].id, listings[j].id);
        const key = clusterPairKey(listings[i].id, listings[j].id);
        edgeScores.set(key, [match.score]);
        edgeReasons.set(key, new Set(match.reasons));
      }
    }
  }

  const groups = new Map<string, Listing[]>();
  for (const listing of listings) {
    const root = find(parent, listing.id);
    const group = groups.get(root) ?? [];
    group.push(listing);
    groups.set(root, group);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .map((group) => buildCluster(group, edgeScores, edgeReasons))
    .sort((a, b) => a.clusterId.localeCompare(b.clusterId));
}

type DuplicateMatch = {
  score: number;
  reasons: string[];
};

function duplicateScore(a: Listing, b: Listing): DuplicateMatch {
  let score = 0;
  const reasons: string[] = [];

  if (sameNormalized(a.make, b.make)) {
    score += 20;
    reasons.push('same make');
  }
  if (sameNormalized(a.model, b.model)) {
    score += 25;
    reasons.push('same model');
  }

  const yearDelta = Math.abs(a.year - b.year);
  if (yearDelta === 0) {
    score += 15;
    reasons.push('same year');
  } else if (yearDelta <= 1) {
    score += 8;
    reasons.push('near year');
  }

  const mileageDelta = Math.abs(a.mileageKm - b.mileageKm);
  if (mileageDelta <= 1000) {
    score += 15;
    reasons.push('same mileage band');
  } else if (mileageDelta <= 5000) {
    score += 10;
    reasons.push('near mileage');
  }

  if (normalizeTitle(a.title) === normalizeTitle(b.title)) {
    score += 20;
    reasons.push('same normalized title');
  } else if (titleTokenOverlap(a.title, b.title) >= 0.75) {
    score += 10;
    reasons.push('similar normalized title');
  }

  if (sameNormalized(a.location, b.location)) {
    score += 10;
    reasons.push('same city');
  }
  if (a.source === b.source) {
    score += 5;
    reasons.push('same source');
  }
  if (a.sellerType !== 'unknown' && a.sellerType === b.sellerType) {
    score += 5;
    reasons.push('same seller type');
  }

  if (!sameNormalized(a.make, b.make) || !sameNormalized(a.model, b.model)) score -= 30;
  if (yearDelta > 1) score -= 25;
  if (mileageDelta > 15000) score -= 25;

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

function buildCluster(
  group: Listing[],
  edgeScores: Map<string, number[]>,
  edgeReasons: Map<string, Set<string>>,
): DuplicateListingCluster {
  const listingIds = group.map((listing) => listing.id).sort();
  const scores: number[] = [];
  const reasons = new Set<string>();

  for (let i = 0; i < listingIds.length; i += 1) {
    for (let j = i + 1; j < listingIds.length; j += 1) {
      const key = clusterPairKey(listingIds[i], listingIds[j]);
      scores.push(...(edgeScores.get(key) ?? []));
      for (const reason of edgeReasons.get(key) ?? []) reasons.add(reason);
    }
  }

  const averageScore = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 70;
  const anchor = group.slice().sort((a, b) => a.id.localeCompare(b.id))[0];

  return {
    clusterId: `dup-${slug([anchor.make, anchor.model, String(anchor.year), anchor.location].join('-'))}`,
    listingIds,
    confidence: confidenceFromScore(averageScore),
    reasons: Array.from(reasons).sort(),
  };
}

function confidenceFromScore(score: number): Confidence {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

function union(parent: Map<string, string>, a: string, b: string): void {
  const rootA = find(parent, a);
  const rootB = find(parent, b);
  if (rootA !== rootB) parent.set(rootB, rootA);
}

function find(parent: Map<string, string>, id: string): string {
  const current = parent.get(id) ?? id;
  if (current === id) return current;
  const root = find(parent, current);
  parent.set(id, root);
  return root;
}

function clusterPairKey(a: string, b: string): string {
  return [a, b].sort().join('\u0000');
}

function sameNormalized(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

function normalizeTitle(title: string): string {
  return normalizeText(title)
    .replace(/\b\d{4}\b/g, '')
    .replace(/\b\d+[.,]?\d*\s*(km|kilometer|kms)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleTokenOverlap(a: string, b: string): number {
  const left = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const right = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (left.size === 0 || right.size === 0) return 0;
  const shared = Array.from(left).filter((token) => right.has(token)).length;
  return shared / Math.max(left.size, right.size);
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(value: string): string {
  return normalizeText(value).replace(/\s+/g, '-');
}
