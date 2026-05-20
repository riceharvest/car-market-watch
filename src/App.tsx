import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Car,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Gauge,
  Globe2,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildMarketSnapshot } from './domain/snapshot';
import type { Listing, MarketSnapshot, MarketSource, Valuation } from './types';
import './styles.css';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const km = new Intl.NumberFormat('nl-NL');
const percent = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const percentPlain = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });

type EnrichedListing = { listing: Listing; valuation: Valuation; rentalEstimate?: unknown };
type SortKey = 'score' | 'price-low' | 'price-high' | 'newest' | 'delta';
type RentalEstimate = {
  dailyEur?: number;
  monthlyGrossEur?: number;
  annualGrossEur?: number;
  annualYieldPct?: number;
  confidence?: string;
  source?: string;
};

const fallbackSnapshot = buildMarketSnapshot({ generatedAt: '2026-05-20T00:00:00.000Z' });

function enrichFromSnapshot(snapshot: MarketSnapshot): EnrichedListing[] {
  const valuationByListingId = new Map(snapshot.valuations.map((item) => [item.listingId, item.valuation]));
  const snapshotRecord = asRecord(snapshot);
  const rentalRows = Array.isArray(snapshotRecord?.rentalEstimates) ? snapshotRecord.rentalEstimates : [];
  const rentalByListingId = new Map(
    rentalRows
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item?.listingId))
      .map((item) => [String(item.listingId), item]),
  );
  return snapshot.listings
    .flatMap((listing): EnrichedListing[] => {
      const valuation = valuationByListingId.get(listing.id);
      if (!valuation) return [];
      return [{
        listing,
        valuation,
        rentalEstimate: rentalByListingId.get(listing.id),
      }];
    })
    .sort((a, b) => b.valuation.dealScore - a.valuation.dealScore);
}

const sourceLabels: Record<MarketSource, string> = {
  autoscout24: 'AutoScout24',
  gaspedaal: 'Gaspedaal',
  marktplaats: 'Marktplaats',
  '2dehands': '2dehands',
  kleinanzeigen: 'Kleinanzeigen',
  'mobile-de-api': 'mobile.de API',
};

const sourceNotes: Record<MarketSource, string> = {
  autoscout24: 'Rich listing metadata and cross-border dealer inventory.',
  gaspedaal: 'NL aggregator signal for duplicate discovery and price checks.',
  marktplaats: 'Private-party marketplace with fast-moving local opportunities.',
  '2dehands': 'Belgian classifieds coverage for nearby import candidates.',
  kleinanzeigen: 'German private listings for arbitrage and supply comparison.',
  'mobile-de-api': 'Structured DE marketplace baseline when API access is available.',
};

function formatSource(source: MarketSource): string {
  return sourceLabels[source] ?? source;
}

function uniqueSorted<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
}

function numberFrom(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function stringFrom(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readRentalEstimate(item: EnrichedListing): RentalEstimate | undefined {
  const listingRecord = asRecord(item.listing);
  const valuationRecord = asRecord(item.valuation);
  const rootEstimate = asRecord(item.rentalEstimate);
  const nested = rootEstimate
    ?? asRecord(listingRecord?.rentalEstimate)
    ?? asRecord(listingRecord?.rental)
    ?? asRecord(valuationRecord?.rentalEstimate)
    ?? asRecord(valuationRecord?.rental);

  const dailyEur = numberFrom(nested?.dailyEur)
    ?? numberFrom(nested?.dailyRateEur)
    ?? numberFrom(nested?.estimatedDailyEur)
    ?? numberFrom(nested?.estimatedDailyRentEur)
    ?? numberFrom(nested?.estimatedDailyRentalEur)
    ?? numberFrom(listingRecord?.estimatedDailyRentalEur)
    ?? numberFrom(valuationRecord?.estimatedDailyRentalEur);
  const monthlyGrossEur = numberFrom(nested?.monthlyGrossEur)
    ?? numberFrom(nested?.estimatedMonthlyGrossEur)
    ?? numberFrom(listingRecord?.estimatedMonthlyGrossEur)
    ?? numberFrom(valuationRecord?.estimatedMonthlyGrossEur)
    ?? (dailyEur ? Math.round(dailyEur * 20) : undefined);
  const annualGrossEur = numberFrom(nested?.annualGrossEur)
    ?? numberFrom(nested?.estimatedAnnualGrossEur)
    ?? numberFrom(listingRecord?.estimatedAnnualGrossEur)
    ?? numberFrom(valuationRecord?.estimatedAnnualGrossEur)
    ?? (monthlyGrossEur ? Math.round(monthlyGrossEur * 12) : undefined);
  const annualYieldPct = numberFrom(nested?.annualYieldPct)
    ?? numberFrom(nested?.rentalYieldPct)
    ?? numberFrom(listingRecord?.rentalYieldPct)
    ?? numberFrom(valuationRecord?.rentalYieldPct)
    ?? (annualGrossEur ? (annualGrossEur / item.listing.priceEur) * 100 : undefined);
  const confidence = stringFrom(nested?.confidence)
    ?? stringFrom(nested?.benchmarkConfidence)
    ?? stringFrom(listingRecord?.rentalConfidence)
    ?? stringFrom(valuationRecord?.rentalConfidence);
  const source = stringFrom(nested?.source)
    ?? stringFrom(nested?.benchmarkSource)
    ?? stringFrom(listingRecord?.rentalSource)
    ?? stringFrom(valuationRecord?.rentalSource);

  if (!dailyEur && !monthlyGrossEur && !annualGrossEur && !annualYieldPct) return undefined;
  return { dailyEur, monthlyGrossEur, annualGrossEur, annualYieldPct, confidence, source };
}

function PendingValue({ label = 'Pending benchmark' }: { label?: string }) {
  return <span className="pending-value">{label}</span>;
}

function StatCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  detail: string;
  tone?: 'neutral' | 'good' | 'warn' | 'accent';
}) {
  return (
    <article className={`stat-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="control-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function ListingCard({ item }: { item: EnrichedListing }) {
  const { listing, valuation } = item;
  const rental = readRentalEstimate(item);
  const dropped = listing.previousPriceEur && listing.previousPriceEur > listing.priceEur;
  const priceMove = dropped ? listing.previousPriceEur! - listing.priceEur : 0;

  return (
    <article className="listing-card">
      <div className="card-topline">
        <span>{formatSource(listing.source)} · {listing.country}</span>
        <span className={`verdict ${valuation.verdict}`}>{valuation.verdict}</span>
      </div>
      <h3>{listing.title}</h3>
      <div className="price-row">
        <strong>{eur.format(listing.priceEur)}</strong>
        {dropped ? (
          <span className="drop"><ArrowDownRight size={16} /> {eur.format(priceMove)} drop</span>
        ) : (
          <span className="rise"><ArrowUpRight size={16} /> stable ask</span>
        )}
      </div>
      <dl>
        <div><dt>Market delta</dt><dd>{percent.format(valuation.priceDeltaPct)}%</dd></div>
        <div><dt>Median comp</dt><dd>{eur.format(valuation.marketMedianEur)}</dd></div>
        <div><dt>Mileage</dt><dd>{km.format(listing.mileageKm)} km</dd></div>
        <div><dt>Deal score</dt><dd>{valuation.dealScore}/100</dd></div>
        <div><dt>Rental / day</dt><dd>{rental?.dailyEur ? eur.format(rental.dailyEur) : <PendingValue />}</dd></div>
        <div><dt>Rent yield</dt><dd>{rental?.annualYieldPct ? `${percentPlain.format(rental.annualYieldPct)}%` : <PendingValue />}</dd></div>
      </dl>
      <p className="meta">{listing.year} · {listing.fuel} · {listing.transmission} · {listing.location} · {listing.sellerType}</p>
      <div className="card-footer">
        <span>{valuation.daysOnMarket} days watched</span>
        <a href={listing.url} target="_blank" rel="noreferrer">Open source</a>
      </div>
    </article>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot>(fallbackSnapshot);
  const [snapshotStatus, setSnapshotStatus] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [country, setCountry] = useState('all');
  const [verdict, setVerdict] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('score');

  useEffect(() => {
    let cancelled = false;
    fetch('/data/market-snapshot.json', { cache: 'no-store' })
      .then((response) => {
        if (!response.ok) throw new Error(`Snapshot request failed: ${response.status}`);
        return response.json() as Promise<MarketSnapshot>;
      })
      .then((nextSnapshot) => {
        if (!cancelled && nextSnapshot.schemaVersion === 1) {
          setSnapshot(nextSnapshot);
          setSnapshotStatus('live');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSnapshot(fallbackSnapshot);
          setSnapshotStatus('fallback');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const enrichedListings = useMemo(() => enrichFromSnapshot(snapshot), [snapshot]);
  const listings = snapshot.listings;
  const sources = useMemo(() => uniqueSorted(listings.map((item) => item.source)), [listings]);
  const countries = useMemo(() => uniqueSorted(listings.map((item) => item.country)), [listings]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return enrichedListings
      .filter(({ listing, valuation }) => {
        const haystack = [listing.title, listing.make, listing.model, listing.trim, listing.location, listing.fuel, listing.transmission]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const matchesQuery = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
        const matchesSource = source === 'all' || listing.source === source;
        const matchesCountry = country === 'all' || listing.country === country;
        const matchesVerdict = verdict === 'all' || valuation.verdict === verdict;
        return matchesQuery && matchesSource && matchesCountry && matchesVerdict;
      })
      .sort((a, b) => {
        if (sortBy === 'price-low') return a.listing.priceEur - b.listing.priceEur;
        if (sortBy === 'price-high') return b.listing.priceEur - a.listing.priceEur;
        if (sortBy === 'newest') return Date.parse(b.listing.firstSeen) - Date.parse(a.listing.firstSeen);
        if (sortBy === 'delta') return a.valuation.priceDeltaPct - b.valuation.priceDeltaPct;
        return b.valuation.dealScore - a.valuation.dealScore;
      });
  }, [country, enrichedListings, query, sortBy, source, verdict]);

  const best = filteredListings[0] ?? enrichedListings[0];
  const averagePrice = Math.round(filteredListings.reduce((sum, item) => sum + item.listing.priceEur, 0) / Math.max(1, filteredListings.length));
  const undervaluedCount = filteredListings.filter((item) => item.valuation.verdict === 'undervalued').length;
  const totalPriceDrops = filteredListings.reduce((sum, { listing }) => {
    if (!listing.previousPriceEur || listing.previousPriceEur <= listing.priceEur) return sum;
    return sum + (listing.previousPriceEur - listing.priceEur);
  }, 0);

  const rentalEstimates = filteredListings
    .map((item) => ({ item, rental: readRentalEstimate(item) }))
    .filter((entry): entry is { item: EnrichedListing; rental: RentalEstimate } => Boolean(entry.rental));
  const averageDailyRental = Math.round(
    rentalEstimates.reduce((sum, { rental }) => sum + (rental.dailyEur ?? 0), 0) / Math.max(1, rentalEstimates.filter(({ rental }) => rental.dailyEur).length),
  );
  const averageMonthlyGross = Math.round(
    rentalEstimates.reduce((sum, { rental }) => sum + (rental.monthlyGrossEur ?? 0), 0) / Math.max(1, rentalEstimates.filter(({ rental }) => rental.monthlyGrossEur).length),
  );
  const averageAnnualYield = rentalEstimates.reduce((sum, { rental }) => sum + (rental.annualYieldPct ?? 0), 0)
    / Math.max(1, rentalEstimates.filter(({ rental }) => rental.annualYieldPct).length);
  const bestRentalYield = rentalEstimates
    .filter(({ rental }) => typeof rental.annualYieldPct === 'number')
    .sort((a, b) => (b.rental.annualYieldPct ?? 0) - (a.rental.annualYieldPct ?? 0))[0];

  const chartData = filteredListings.map(({ listing, valuation }) => ({
    name: `${formatSource(listing.source)} ${listing.year}`,
    asking: listing.priceEur,
    median: valuation.marketMedianEur,
    score: valuation.dealScore,
  }));

  const coverage = sources.map((marketSource) => {
    const rows = listings.filter((item) => item.source === marketSource);
    const countriesCovered = uniqueSorted(rows.map((item) => item.country)).join(', ');
    const highConfidence = rows.filter((item) => item.confidence === 'high').length;
    return { source: marketSource, rows, countriesCovered, highConfidence };
  });

  const snapshotRecord = asRecord(snapshot);
  const rentalSourceRows = Array.isArray(snapshotRecord?.rentalSources)
    ? snapshotRecord.rentalSources.map((item) => asRecord(item)).filter((item): item is Record<string, unknown> => Boolean(item))
    : [];
  const rentalSourceSummary = rentalSourceRows.length > 0
    ? rentalSourceRows
      .map((item) => `${stringFrom(item.label) ?? stringFrom(item.id) ?? 'Rental source'}: ${stringFrom(item.scrapePriority) ?? 'benchmark'} · ${stringFrom(item.reliability) ?? 'unknown'} confidence`)
      .join(' / ')
    : 'SnappCar primary; Getaround API/paid only; MyWheels/Greenwheels and Sixt/Europcar benchmark-only.';

  const snapshotFreshness = snapshotStatus === 'live'
    ? `Loaded generated snapshot from ${new Date(snapshot.generatedAt).toLocaleString('nl-NL')}`
    : snapshotStatus === 'loading'
      ? 'Loading generated market snapshot…'
      : 'Using built-in fallback snapshot; run pnpm data:build before deploying.';

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Database size={16} /> NL + nearby used-car market intelligence</p>
          <h1>Find underpriced cars before the market catches up.</h1>
          <p className="lede">
            A production-ready valuation dashboard for watching used-car listings, comparing local market medians,
            spotting price drops, and prioritizing alerts from a generated static market snapshot.
          </p>
          <div className="hero-actions">
            <button><Bell size={18} /> Create watch alert</button>
            <button className="secondary"><Car size={18} /> Review all listings</button>
          </div>
        </div>
        <aside className="hero-panel">
          <div className="signal-badge"><Sparkles size={16} /> Best current signal</div>
          <strong>{best.listing.title}</strong>
          <p>{eur.format(best.listing.priceEur)} · {km.format(best.listing.mileageKm)} km · score {best.valuation.dealScore}</p>
          <div className="mini-metrics">
            <span>{percent.format(best.valuation.priceDeltaPct)}% vs median</span>
            <span>{best.valuation.comparableCount} comps</span>
          </div>
          <p className="snapshot-status">{snapshotFreshness}</p>
        </aside>
      </section>

      <section className="filters-panel" aria-label="Search and filters">
        <div className="search-field">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search make, model, trim, location, fuel..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <SelectControl label="Source" value={source} onChange={setSource}>
          <option value="all">All sources</option>
          {sources.map((item) => <option key={item} value={item}>{formatSource(item)}</option>)}
        </SelectControl>
        <SelectControl label="Country" value={country} onChange={setCountry}>
          <option value="all">All countries</option>
          {countries.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectControl>
        <SelectControl label="Signal" value={verdict} onChange={setVerdict}>
          <option value="all">All signals</option>
          <option value="undervalued">Undervalued</option>
          <option value="fair">Fair</option>
          <option value="watch">Watch</option>
          <option value="expensive">Expensive</option>
        </SelectControl>
        <SelectControl label="Sort" value={sortBy} onChange={(value) => setSortBy(value as SortKey)}>
          <option value="score">Best deal score</option>
          <option value="delta">Deepest discount</option>
          <option value="newest">Newest seen</option>
          <option value="price-low">Lowest price</option>
          <option value="price-high">Highest price</option>
        </SelectControl>
      </section>

      <section className="stats-grid">
        <StatCard label="Listings in view" value={String(filteredListings.length)} detail={`${snapshot.summary.listingCount} tracked snapshot listings`} tone="accent" />
        <StatCard label="Sources covered" value={String(sources.length)} detail="Marketplaces and aggregators modeled" />
        <StatCard label="Average ask" value={eur.format(averagePrice)} detail="Current filtered inventory" />
        <StatCard label="Price-drop value" value={eur.format(totalPriceDrops)} detail={`${undervaluedCount} undervalued candidates`} tone="good" />
        <StatCard
          label="Estimated rental/day"
          value={averageDailyRental > 0 ? eur.format(averageDailyRental) : 'Pending'}
          detail={rentalEstimates.length > 0 ? `${rentalEstimates.length} rental benchmarks matched` : 'Awaiting SnappCar/API rental comps'}
          tone="accent"
        />
        <StatCard
          label="Monthly rental gross"
          value={averageMonthlyGross > 0 ? eur.format(averageMonthlyGross) : 'Pending'}
          detail="Modeled before platform fees, cleaning and downtime"
        />
        <StatCard
          label="Annual rent yield"
          value={averageAnnualYield > 0 ? `${percentPlain.format(averageAnnualYield)}%` : 'Pending'}
          detail="Gross ROI against current asking price"
          tone={averageAnnualYield >= 15 ? 'good' : 'neutral'}
        />
        <StatCard
          label="Best rent-yield candidate"
          value={bestRentalYield ? `${percentPlain.format(bestRentalYield.rental.annualYieldPct ?? 0)}%` : 'Pending'}
          detail={bestRentalYield ? `${bestRentalYield.item.listing.make} ${bestRentalYield.item.listing.model} · ${eur.format(bestRentalYield.item.listing.priceEur)}` : 'No rental ROI estimate yet'}
          tone="good"
        />
      </section>

      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Gauge size={16} /> valuation</p>
            <h2>Asking price vs comparable median</h2>
          </div>
          <p>Valuation uses same make/model, ±2 years, ±40k km and compatible fuel from the existing domain helpers.</p>
        </div>
        <div className="chart-wrap">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222936" vertical={false} />
                <XAxis dataKey="name" stroke="#8a93a5" tick={{ fontSize: 12 }} interval={0} angle={-10} height={58} />
                <YAxis stroke="#8a93a5" tickFormatter={(value) => `€${Number(value) / 1000}k`} width={58} />
                <Tooltip
                  cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
                  formatter={(value, name) => [eur.format(Number(value)), name === 'asking' ? 'Asking price' : 'Comparable median']}
                  contentStyle={{ background: '#10151f', border: '1px solid #273143', borderRadius: 14, color: '#eef2ff' }}
                  labelStyle={{ color: '#c4b5fd' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
                <Bar dataKey="median" fill="#334155" radius={[7, 7, 0, 0]} name="Comparable median" />
                <Bar dataKey="asking" fill="#8b5cf6" radius={[7, 7, 0, 0]} name="Asking price" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><Filter size={20} /> No listings match these filters.</div>
          )}
        </div>
      </section>

      <section className="panel listings-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Clock size={16} /> live watchlist</p>
            <h2>Comparable listings</h2>
          </div>
          <p>Sorted and filtered locally. Cards highlight price movement, market delta, days watched and source links.</p>
        </div>
        <div className="listing-grid">
          {filteredListings.map((item) => <ListingCard key={item.listing.id} item={item} />)}
        </div>
        {filteredListings.length === 0 && <div className="empty-state"><Search size={20} /> Try widening your filters or clearing the search query.</div>}
      </section>

      <section className="panel table-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow"><Target size={16} /> analyst table</p>
            <h2>Deal queue</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Listing</th>
                <th>Source</th>
                <th>Ask</th>
                <th>Median</th>
                <th>Delta</th>
                <th>Rent/day</th>
                <th>Rent yield</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredListings.map((item) => {
                const { listing, valuation } = item;
                const rental = readRentalEstimate(item);
                return (
                  <tr key={`row-${listing.id}`}>
                    <td><strong>{listing.make} {listing.model}</strong><span>{listing.year} · {km.format(listing.mileageKm)} km · {listing.location}</span></td>
                    <td>{formatSource(listing.source)}<span>{listing.country}</span></td>
                    <td>{eur.format(listing.priceEur)}</td>
                    <td>{eur.format(valuation.marketMedianEur)}</td>
                    <td className={valuation.priceDeltaPct <= 0 ? 'positive' : 'negative'}>{percent.format(valuation.priceDeltaPct)}%</td>
                    <td>{rental?.dailyEur ? eur.format(rental.dailyEur) : <PendingValue />}</td>
                    <td>{rental?.annualYieldPct ? `${percentPlain.format(rental.annualYieldPct)}%` : <PendingValue />}</td>
                    <td>{valuation.dealScore}</td>
                    <td><span className={`verdict ${valuation.verdict}`}>{valuation.verdict}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="coverage-grid">
        <article className="panel alert-panel">
          <p className="eyebrow"><Bell size={16} /> alert workflow</p>
          <h2>Watchlists without backend assumptions</h2>
          <p>
            Saved searches can monitor model, budget, mileage, countries and trusted sources. When snapshots arrive,
            alerts should trigger on fresh under-market listings, meaningful price drops, and long-watched cars that
            cross a deal-score threshold.
          </p>
          <ul>
            <li><CheckCircle2 size={17} /> Deep discount against comparable median</li>
            <li><CheckCircle2 size={17} /> Price drop from previous snapshot</li>
            <li><CheckCircle2 size={17} /> Confidence-aware source prioritization</li>
            <li><CheckCircle2 size={17} /> Static JSON artifact at /data/market-snapshot.json</li>
          </ul>
        </article>

        <article className="panel coverage-panel">
          <p className="eyebrow"><Globe2 size={16} /> source coverage</p>
          <h2>Marketplace readiness</h2>
          <div className="source-list">
            {coverage.map(({ source: marketSource, rows, countriesCovered, highConfidence }) => (
              <div className="source-row" key={marketSource}>
                <div>
                  <strong>{formatSource(marketSource)}</strong>
                  <p>{snapshot.sources.find((item) => item.id === marketSource)?.robotsNote ?? sourceNotes[marketSource]}</p>
                </div>
                <span>{rows.length} listings · {countriesCovered || '—'} · {highConfidence} high confidence</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel rental-methodology-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Sparkles size={16} /> rental ROI</p>
            <h2>Owner-rental benchmark confidence</h2>
          </div>
          <p>Rental estimates are shown only when the generated snapshot includes defensible comp data; otherwise cards stay in pending state.</p>
        </div>
        <div className="rental-source-grid">
          <div className="rental-source-card primary">
            <strong>Snapshot confidence</strong>
            <p>{rentalSourceSummary}</p>
          </div>
          <div className="rental-source-card primary">
            <strong>SnappCar first</strong>
            <p>Preferred owner-rental comparable surface for NL/BE car-share day rates, with confidence tied to make/model, age, location and sample count.</p>
          </div>
          <div className="rental-source-card">
            <strong>Getaround via API/paid only</strong>
            <p>Use only structured or licensed access; search scraping is not assumed because robots restrictions disallow it.</p>
          </div>
          <div className="rental-source-card">
            <strong>Benchmarks, not direct comps</strong>
            <p>MyWheels/Greenwheels fleet rates and Sixt/Europcar commercial pricing can calibrate ceilings, but should carry lower confidence than owner-rental comps.</p>
          </div>
          <div className="rental-source-card muted">
            <strong>Turo skipped</strong>
            <p>Excluded from the default NL workflow; estimates remain pending unless a future data snapshot provides an allowed source.</p>
          </div>
        </div>
      </section>

      <footer>
        <ShieldCheck size={16} /> Static snapshot driven · valuation logic tested · ready for Vercel deployment.
      </footer>
    </main>
  );
}
