-- Production persistence scaffold for Car Market Watch.
-- Target: Neon/Postgres. This file is a contract only; no live service is wired yet.

create extension if not exists pgcrypto;

create table if not exists source_configs (
  id text primary key,
  label text not null,
  base_url text not null,
  enabled boolean not null default false,
  countries text[] not null default '{}',
  access_method text not null,
  cadence_hours integer not null check (cadence_hours > 0),
  robots_review_version text not null,
  robots_note text not null,
  adapter_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists saved_searches (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  name text not null,
  source text not null references source_configs(id),
  country text not null,
  make text,
  model text,
  filters jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id, name)
);

create table if not exists ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null references source_configs(id),
  saved_search_id uuid references saved_searches(id),
  adapter_version text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('queued', 'running', 'succeeded', 'partial', 'failed')),
  listings_seen integer not null default 0 check (listings_seen >= 0),
  listings_created integer not null default 0 check (listings_created >= 0),
  listings_updated integer not null default 0 check (listings_updated >= 0),
  parser_error_count integer not null default 0 check (parser_error_count >= 0),
  robots_review_version text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  source text not null references source_configs(id),
  source_listing_id text not null,
  country text not null,
  canonical_url text not null,
  url_hash text not null,
  title text not null,
  make text not null,
  model text not null,
  trim text,
  price_eur integer not null check (price_eur >= 0),
  mileage_km integer not null check (mileage_km >= 0),
  registration_year integer not null check (registration_year between 1950 and 2100),
  fuel text not null,
  transmission text not null,
  location text not null,
  seller_type text not null,
  co2_g_per_km integer,
  first_registration_date date,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  availability_status text not null default 'active' check (availability_status in ('active', 'reserved', 'sold', 'removed', 'unknown')),
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  notes text,
  latest_ingestion_run_id uuid references ingestion_runs(id),
  normalized_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_listing_id)
);

create index if not exists listings_search_idx on listings (make, model, registration_year, price_eur);
create index if not exists listings_last_seen_idx on listings (last_seen_at desc);

create table if not exists listing_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  ingestion_run_id uuid references ingestion_runs(id),
  observed_at timestamptz not null,
  price_eur integer not null check (price_eur >= 0),
  previous_price_eur integer,
  mileage_km integer not null check (mileage_km >= 0),
  availability_status text not null,
  unique (listing_id, observed_at)
);

create table if not exists valuations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  generated_at timestamptz not null default now(),
  market_median_eur integer not null check (market_median_eur >= 0),
  comparable_count integer not null check (comparable_count >= 0),
  comparable_listing_ids uuid[] not null default '{}',
  price_delta_eur integer not null,
  price_delta_pct numeric(8, 2) not null,
  days_on_market integer not null check (days_on_market >= 0),
  price_per_10k_km numeric(12, 2) not null,
  deal_score integer not null check (deal_score between 0 and 100),
  verdict text not null check (verdict in ('undervalued', 'fair', 'expensive', 'watch')),
  model_version text not null,
  assumptions jsonb not null default '{}'::jsonb,
  unique (listing_id, generated_at)
);

create table if not exists purchase_decisions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  valuation_id uuid references valuations(id) on delete set null,
  generated_at timestamptz not null default now(),
  landed_cost_eur integer not null check (landed_cost_eur >= 0),
  dutch_market_median_eur integer not null check (dutch_market_median_eur >= 0),
  landed_cost_delta_to_dutch_market_eur integer not null,
  landed_cost_delta_to_dutch_market_pct numeric(8, 2) not null,
  net_annual_rental_eur integer not null,
  net_rental_yield_pct numeric(8, 2) not null,
  payback_months integer,
  import_complexity_score integer not null check (import_complexity_score between 0 and 100),
  data_confidence_score integer not null check (data_confidence_score between 0 and 100),
  purchase_score integer not null check (purchase_score between 0 and 100),
  verdict text not null check (verdict in ('buy-now', 'negotiate', 'watch', 'avoid', 'needs-data')),
  reasons jsonb not null default '[]'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  model_version text not null,
  unique (listing_id, generated_at)
);
