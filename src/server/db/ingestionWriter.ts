import { createHash } from 'node:crypto';
import { sourceMetadata } from '../../data/sources';
import type { IngestionSnapshot } from '../../ingest/types';
import type { Listing, MarketSource, SourceMetadata } from '../../types';
import { statement, type QueryExecutor } from './sql';

type ExistingListingRow = { id: string; price_eur: number };
type IdRow = { id: string };

export type IngestionWriteStats = {
  runId: string;
  listingsSeen: number;
  listingsCreated: number;
  listingsUpdated: number;
  priceHistoryInserted: number;
};

export async function writeIngestionSnapshotToDb(db: QueryExecutor, snapshot: IngestionSnapshot): Promise<IngestionWriteStats> {
  const source = runSource(snapshot);
  const sources = new Set<MarketSource>([source, ...snapshot.listings.map((listing) => listing.source)]);
  for (const listingSource of sources) {
    await ensureSourceConfig(db, listingSource);
  }

  const runRows = await db.execute<IdRow>(
    statement(
      `insert into ingestion_runs (source, adapter_version, started_at, finished_at, status, listings_seen, parser_error_count, robots_review_version, notes, metadata)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id`,
      [
        source,
        snapshot.adapter,
        snapshot.run.startedAt,
        snapshot.run.finishedAt,
        snapshot.run.errors.length > 0 ? 'partial' : 'succeeded',
        snapshot.listings.length,
        snapshot.run.errors.length,
        'not-reviewed-by-db-writer',
        snapshot.notes.join('\n'),
        sanitizedRunMetadata(snapshot),
      ],
    ),
  );
  const runId = runRows[0]?.id;
  if (!runId) throw new Error('ingestion run insert did not return an id');

  let listingsCreated = 0;
  let listingsUpdated = 0;
  let priceHistoryInserted = 0;

  for (const listing of snapshot.listings) {
    const sourceListingId = sourceListingIdFor(listing);
    const existingRows = await db.execute<ExistingListingRow>(
      statement('select id, price_eur from listings where source = $1 and source_listing_id = $2 limit 1', [listing.source, sourceListingId]),
    );
    const existing = existingRows[0];
    if (existing) listingsUpdated += 1;
    else listingsCreated += 1;

    const upsertRows = await db.execute<IdRow>(
      statement(
        `insert into listings (
          source, source_listing_id, country, canonical_url, url_hash, title, make, model, trim, price_eur, mileage_km,
          registration_year, fuel, transmission, location, seller_type, co2_g_per_km, first_registration_date,
          first_seen_at, last_seen_at, confidence, notes, latest_ingestion_run_id, normalized_payload
        ) values (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
        )
        on conflict (source, source_listing_id) do update set
          country = excluded.country,
          canonical_url = excluded.canonical_url,
          url_hash = excluded.url_hash,
          title = excluded.title,
          make = excluded.make,
          model = excluded.model,
          trim = excluded.trim,
          price_eur = excluded.price_eur,
          mileage_km = excluded.mileage_km,
          registration_year = excluded.registration_year,
          fuel = excluded.fuel,
          transmission = excluded.transmission,
          location = excluded.location,
          seller_type = excluded.seller_type,
          co2_g_per_km = excluded.co2_g_per_km,
          first_registration_date = excluded.first_registration_date,
          last_seen_at = excluded.last_seen_at,
          confidence = excluded.confidence,
          notes = excluded.notes,
          latest_ingestion_run_id = excluded.latest_ingestion_run_id,
          normalized_payload = excluded.normalized_payload,
          updated_at = now()
        returning id`,
        listingValues(listing, sourceListingId, runId),
      ),
    );
    const listingId = upsertRows[0]?.id ?? existing?.id;
    if (!listingId) throw new Error(`listing upsert did not return an id for ${listing.id}`);

    if (!existing || Number(existing.price_eur) !== listing.priceEur) {
      const historyRows = await db.execute<IdRow>(
        statement(
          `insert into listing_price_history (listing_id, ingestion_run_id, observed_at, price_eur, previous_price_eur, mileage_km, availability_status)
           values ($1, $2, $3, $4, $5, $6, $7)
           on conflict (listing_id, observed_at) do nothing
           returning id`,
          [listingId, runId, listing.lastSeen, listing.priceEur, existing?.price_eur ?? listing.previousPriceEur ?? null, listing.mileageKm, 'active'],
        ),
      );
      priceHistoryInserted += historyRows.length;
    }
  }

  await db.execute<IdRow>(
    statement(
      `update ingestion_runs
       set listings_created = $1, listings_updated = $2, finished_at = $3, status = $4
       where id = $5
       returning id`,
      [listingsCreated, listingsUpdated, snapshot.run.finishedAt, snapshot.run.errors.length > 0 ? 'partial' : 'succeeded', runId],
    ),
  );

  return { runId, listingsSeen: snapshot.listings.length, listingsCreated, listingsUpdated, priceHistoryInserted };
}

async function ensureSourceConfig(db: QueryExecutor, source: MarketSource): Promise<void> {
  const metadata = sourceMetadata.find((item) => item.id === source) ?? fallbackSourceMetadata(source);
  await db.execute(
    statement(
      `insert into source_configs (id, label, base_url, enabled, countries, access_method, cadence_hours, robots_review_version, robots_note, adapter_version)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       on conflict (id) do update set
         label = excluded.label,
         base_url = excluded.base_url,
         countries = excluded.countries,
         access_method = excluded.access_method,
         cadence_hours = excluded.cadence_hours,
         robots_note = excluded.robots_note,
         adapter_version = excluded.adapter_version,
         updated_at = now()`,
      [
        metadata.id,
        metadata.label,
        metadata.baseUrl,
        true,
        metadata.countries,
        metadata.access,
        metadata.cadenceHours,
        'manual-review-required',
        metadata.robotsNote,
        'live-adapter-v1',
      ],
    ),
  );
}

function fallbackSourceMetadata(source: MarketSource): SourceMetadata {
  return {
    id: source,
    label: source,
    baseUrl: 'https://example.invalid/',
    countries: ['NL'],
    access: 'manual',
    cadenceHours: 24,
    robotsNote: 'Fallback source config created by ingestion DB writer; review before enabling scheduled use.',
    fields: [],
    reliability: 'low',
  };
}

function listingValues(listing: Listing, sourceListingId: string, runId: string) {
  return [
    listing.source,
    sourceListingId,
    listing.country,
    listing.url,
    sha256(listing.url),
    listing.title,
    listing.make,
    listing.model,
    listing.trim ?? null,
    listing.priceEur,
    listing.mileageKm,
    listing.year,
    listing.fuel,
    listing.transmission,
    listing.location,
    listing.sellerType,
    listing.co2GPerKm ?? null,
    listing.firstRegistrationDate ?? null,
    listing.firstSeen,
    listing.lastSeen,
    listing.confidence,
    listing.notes ?? null,
    runId,
    normalizedPayload(listing),
  ];
}

function normalizedPayload(listing: Listing): Record<string, unknown> {
  return {
    schemaVersion: 1,
    source: listing.source,
    sourceListingId: sourceListingIdFor(listing),
    url: listing.url,
    title: listing.title,
    make: listing.make,
    model: listing.model,
    trim: listing.trim,
    priceEur: listing.priceEur,
    mileageKm: listing.mileageKm,
    year: listing.year,
    fuel: listing.fuel,
    transmission: listing.transmission,
    sellerType: listing.sellerType,
    confidence: listing.confidence,
  };
}

function sanitizedRunMetadata(snapshot: IngestionSnapshot): Record<string, unknown> {
  return {
    schemaVersion: snapshot.schemaVersion,
    generatedAt: snapshot.generatedAt,
    mode: snapshot.mode,
    adapter: snapshot.adapter,
    searchIds: snapshot.searchIds,
    notes: snapshot.notes,
    run: {
      startedAt: snapshot.run.startedAt,
      finishedAt: snapshot.run.finishedAt,
      durationMs: snapshot.run.durationMs,
      totalRawObservationCount: snapshot.run.totalRawObservationCount,
      totalListingCount: snapshot.run.totalListingCount,
      errors: snapshot.run.errors,
      sourceStatuses: snapshot.run.sourceStatuses,
      sourceStatusSummary: snapshot.run.sourceStatusSummary,
    },
  };
}

function sourceListingIdFor(listing: Listing): string {
  const prefix = `${listing.source}:`;
  return listing.id.startsWith(prefix) ? listing.id.slice(prefix.length) : listing.id;
}

function runSource(snapshot: IngestionSnapshot): MarketSource {
  const firstListingSource = snapshot.listings[0]?.source;
  if (firstListingSource) return firstListingSource;
  if (isMarketSource(snapshot.adapter)) return snapshot.adapter;
  return 'autoscout24';
}

function isMarketSource(value: string): value is MarketSource {
  return ['autoscout24', 'gaspedaal', 'marktplaats', '2dehands', 'kleinanzeigen', 'mobile-de-api'].includes(value);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
