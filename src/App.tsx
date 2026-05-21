import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  AlertTriangle,
  Bell,
  Car,
  CheckCircle2,
  Clock,
  Database,
  Filter,
  Gauge,
  Globe2,
  Info,
  ExternalLink,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { loadMarketSnapshotFromStaticData } from './data/chunkedSnapshot';
import { limitDashboardRows } from './domain/dashboardDisplay';
import { buildListingActionLinks, buildRentalCompetitorLinks, type RentalCompetitorLink } from './domain/rentalCompetitorLinks';
import { buildMarketSnapshot } from './domain/snapshot';
import type { DataQualityReport, ImportCostEstimate, Listing, MarketSnapshot, MarketSource, NetRentalEstimate, PurchaseDecision, Valuation } from './types';
import './styles.css';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const km = new Intl.NumberFormat('nl-NL');
const percent = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1, signDisplay: 'exceptZero' });
const percentPlain = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 });

type EnrichedListing = { listing: Listing; valuation: Valuation; rentalEstimate?: unknown; rentalCompetitorLinks: RentalCompetitorLink[] };
type PurchaseCandidate = {
  listing: Listing;
  valuation: Valuation;
  decision: PurchaseDecision;
  importEstimate?: ImportCostEstimate;
  netRentalEstimate?: NetRentalEstimate;
  qualityReport?: DataQualityReport;
  rentalCompetitorLinks: RentalCompetitorLink[];
};
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
        rentalCompetitorLinks: buildRentalCompetitorLinks(listing, snapshot.rentalComps, snapshot.rentalSources),
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
  autoscout24: 'Rijke listingdata en grensoverschrijdende dealer-voorraad.',
  gaspedaal: 'Nederlandse aggregator voor duplicaten en prijschecks.',
  marktplaats: 'Particuliere marktplaats met snel bewegende lokale kansen.',
  '2dehands': 'Belgische advertenties voor importkandidaten dichtbij.',
  kleinanzeigen: 'Duitse particuliere listings voor arbitrage en aanbodvergelijking.',
  'mobile-de-api': 'Gestructureerde Duitse marktplaatsbasis wanneer API-toegang beschikbaar is.',
};

function formatSource(source: MarketSource): string {
  return sourceLabels[source] ?? source;
}

function fuelLabel(fuel: string): string {
  const labels: Record<string, string> = {
    petrol: 'benzine',
    diesel: 'diesel',
    hybrid: 'hybride',
    electric: 'elektrisch',
    lpg: 'lpg',
    unknown: 'onbekend',
  };
  return labels[fuel] ?? fuel;
}

function transmissionLabel(transmission: string): string {
  const labels: Record<string, string> = {
    manual: 'handgeschakeld',
    automatic: 'automaat',
    unknown: 'onbekend',
  };
  return labels[transmission] ?? transmission;
}

function sellerLabel(sellerType: string): string {
  const labels: Record<string, string> = {
    dealer: 'dealer',
    private: 'particulier',
    unknown: 'onbekend',
  };
  return labels[sellerType] ?? sellerType;
}

function regionLabel(region: string): string {
  const labels: Record<string, string> = {
    'domestic-nl': 'binnenlands NL',
    'eu-efta': 'EU/EFTA',
    'non-eu': 'buiten EU',
  };
  return labels[region] ?? region;
}

function confidenceLabel(confidence: string | undefined): string {
  if (confidence === 'high') return 'hoog';
  if (confidence === 'medium') return 'gemiddeld';
  if (confidence === 'low') return 'laag';
  return 'onbekend';
}

function priorityLabel(priority: string | undefined): string {
  if (priority === 'primary') return 'primair';
  if (priority === 'benchmark') return 'vergelijkingspunt';
  if (priority === 'skip') return 'overslaan';
  return priority ?? 'vergelijkingspunt';
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

function average(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatPayback(months: number | null): string {
  if (months === null || !Number.isFinite(months)) return 'n.v.t.';
  return `${Math.round(months)} mnd`;
}

function verdictLabel(verdict: string): string {
  const labels: Record<string, string> = {
    'buy-now': 'Nu kopen',
    negotiate: 'Onderhandelen',
    watch: 'Volgen',
    avoid: 'Vermijden',
    'needs-data': 'Meer data nodig',
    undervalued: 'Ondergewaardeerd',
    fair: 'Redelijk',
    expensive: 'Duur',
  };
  return labels[verdict] ?? verdict.replace(/-/g, ' ');
}

function PendingValue({ label = 'Vergelijking volgt' }: { label?: string }) {
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

function ListingLinks({ listing, rentalLinks }: { listing: Listing; rentalLinks: RentalCompetitorLink[] }) {
  const sourceLink = buildListingActionLinks(listing).source;
  return (
    <div className="link-stack" aria-label={`Links voor ${listing.make} ${listing.model}`}>
      <a className="source-link" href={sourceLink.url} target="_blank" rel="noreferrer">
        <ExternalLink size={14} /> {sourceLink.label}
      </a>
      {rentalLinks.length > 0 ? (
        <div className="rental-link-list">
          <span>Verhuurvergelijkingen</span>
          {rentalLinks.map((link) => (
            <a key={`${listing.id}-${link.source}`} href={link.url} target="_blank" rel="noreferrer" title={link.notes}>
              {link.label} · {link.matchType === 'same-model' ? 'zelfde model' : 'vergelijkbare specs'} · {eur.format(link.dailyRateEur)}/dag
            </a>
          ))}
        </div>
      ) : (
        <span className="no-rental-links">Geen match met verhuurbedrijf in snapshot</span>
      )}
    </div>
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
        <span className={`verdict ${valuation.verdict}`}>{verdictLabel(valuation.verdict)}</span>
      </div>
      <h3>{listing.title}</h3>
      <div className="price-row">
        <strong>{eur.format(listing.priceEur)}</strong>
        {dropped ? (
          <span className="drop"><ArrowDownRight size={16} /> {eur.format(priceMove)} daling</span>
        ) : (
          <span className="rise"><ArrowUpRight size={16} /> vraagprijs stabiel</span>
        )}
      </div>
      <dl>
        <div><dt>Marktverschil</dt><dd>{percent.format(valuation.priceDeltaPct)}%</dd></div>
        <div><dt>Mediaan comp</dt><dd>{eur.format(valuation.marketMedianEur)}</dd></div>
        <div><dt>Kilometerstand</dt><dd>{km.format(listing.mileageKm)} km</dd></div>
        <div><dt>Dealscore</dt><dd>{valuation.dealScore}/100</dd></div>
        <div><dt>Verhuur / dag</dt><dd>{rental?.dailyEur ? eur.format(rental.dailyEur) : <PendingValue />}</dd></div>
        <div><dt>Huurrendement</dt><dd>{rental?.annualYieldPct ? `${percentPlain.format(rental.annualYieldPct)}%` : <PendingValue />}</dd></div>
      </dl>
      <p className="meta">{listing.year} · {fuelLabel(listing.fuel)} · {transmissionLabel(listing.transmission)} · {listing.location} · {sellerLabel(listing.sellerType)}</p>
      <div className="card-footer">
        <span>{valuation.daysOnMarket} dagen gevolgd</span>
      </div>
      <ListingLinks listing={listing} rentalLinks={item.rentalCompetitorLinks} />
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
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchJson = async (url: string): Promise<unknown> => {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`Snapshot request failed: ${url} ${response.status}`);
      return response.json();
    };

    loadMarketSnapshotFromStaticData(fetchJson)
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

  const purchaseCandidates = useMemo(() => {
    const listingById = new Map(snapshot.listings.map((item) => [item.id, item]));
    const valuationById = new Map(snapshot.valuations.map((item) => [item.listingId, item.valuation]));
    const importById = new Map(snapshot.importCostEstimates.map((item) => [item.listingId, item]));
    const netRentalById = new Map(snapshot.netRentalEstimates.map((item) => [item.listingId, item]));
    const qualityById = new Map(snapshot.dataQualityReports.map((item) => [item.listingId, item]));
    return snapshot.purchaseDecisions
      .flatMap((decision): PurchaseCandidate[] => {
        const listing = listingById.get(decision.listingId);
        const valuation = valuationById.get(decision.listingId);
        if (!listing || !valuation) return [];
        return [{
          listing,
          valuation,
          decision,
          importEstimate: importById.get(decision.listingId),
          netRentalEstimate: netRentalById.get(decision.listingId),
          qualityReport: qualityById.get(decision.listingId),
          rentalCompetitorLinks: buildRentalCompetitorLinks(listing, snapshot.rentalComps, snapshot.rentalSources),
        }];
      })
      .sort((a, b) => b.decision.purchaseScore - a.decision.purchaseScore);
  }, [snapshot]);

  const filteredPurchaseCandidates = useMemo(() => {
    const filteredListingIds = new Set(filteredListings.map((item) => item.listing.id));
    return purchaseCandidates.filter((item) => filteredListingIds.has(item.listing.id));
  }, [filteredListings, purchaseCandidates]);

  const selectedPurchaseCandidate = filteredPurchaseCandidates.find((item) => item.listing.id === selectedPurchaseId)
    ?? filteredPurchaseCandidates[0]
    ?? purchaseCandidates[0];
  const filteredDisplayRows = useMemo(() => limitDashboardRows(filteredListings), [filteredListings]);
  const purchaseDisplayRows = useMemo(() => limitDashboardRows(filteredPurchaseCandidates), [filteredPurchaseCandidates]);

  useEffect(() => {
    if (!selectedPurchaseCandidate) return;
    if (selectedPurchaseId !== selectedPurchaseCandidate.listing.id) {
      setSelectedPurchaseId(selectedPurchaseCandidate.listing.id);
    }
  }, [selectedPurchaseCandidate, selectedPurchaseId]);

  const countryPurchaseSummaries = useMemo(() => countries.map((countryCode) => {
    const rows = purchaseCandidates.filter((item) => item.listing.country === countryCode);
    const bestCandidate = rows[0];
    const averageListedPrice = average(rows.map((item) => item.listing.priceEur));
    const averageLandedCost = average(rows.map((item) => item.decision.landedCostEur));
    const averageYield = average(rows.map((item) => item.decision.netRentalYieldPct));
    const averageComplexity = average(rows.map((item) => item.decision.importComplexityScore));
    return {
      country: countryCode,
      count: rows.length,
      bestCandidate,
      averageListedPrice,
      averageLandedCost,
      averageYield,
      averageComplexity,
      manualBpmCount: rows.filter((item) => item.importEstimate?.needsManualBpm).length,
    };
  }).filter((item) => item.count > 0), [countries, purchaseCandidates]);

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

  const chartData = filteredDisplayRows.chartRows.map(({ listing, valuation }) => ({
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
      .map((item) => `${stringFrom(item.label) ?? stringFrom(item.id) ?? 'Verhuurbron'}: ${priorityLabel(stringFrom(item.scrapePriority))} · ${confidenceLabel(stringFrom(item.reliability))} betrouwbaarheid`)
      .join(' / ')
    : 'SnappCar primair; Getaround alleen API/betaald; MyWheels/Greenwheels en Sixt/Europcar alleen als benchmark.';

  const snapshotFreshness = snapshotStatus === 'live'
    ? `Gegenereerde momentopname geladen van ${new Date(snapshot.generatedAt).toLocaleString('nl-NL')}`
    : snapshotStatus === 'loading'
      ? 'Gegenereerde marktmomentopname laden…'
      : 'Ingebouwde fallback-momentopname actief; draai pnpm data:build vóór deploy.';

  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow"><Database size={16} /> NL + omliggende tweedehandsautomarkt-intelligentie</p>
          <h1>Vind onderprijsde auto’s voordat de markt bijtrekt.</h1>
          <p className="lede">
            Een productieklaar waarderingsdashboard om tweedehands auto’s te volgen, lokale marktmedianen te vergelijken,
            prijsdalingen te spotten en alerts te prioriteren vanuit een gegenereerde statische marktmomentopname.
          </p>
          <div className="hero-actions">
            <button><Bell size={18} /> Maak volgmelding</button>
            <button className="secondary"><Car size={18} /> Bekijk alle advertenties</button>
          </div>
        </div>
        <aside className="hero-panel">
          <div className="signal-badge"><Sparkles size={16} /> Beste signaal nu</div>
          <strong>{best.listing.title}</strong>
          <p>{eur.format(best.listing.priceEur)} · {km.format(best.listing.mileageKm)} km · score {best.valuation.dealScore}</p>
          <div className="mini-metrics">
            <span>{percent.format(best.valuation.priceDeltaPct)}% vs mediaan</span>
            <span>{best.valuation.comparableCount} vergelijkingen</span>
          </div>
          <p className="snapshot-status">{snapshotFreshness}</p>
        </aside>
      </section>

      <section className="filters-panel" aria-label="Zoeken en filters">
        <div className="search-field">
          <Search size={18} />
          <input
            type="search"
            placeholder="Zoek merk, model, uitvoering, locatie, brandstof..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <SelectControl label="Bron" value={source} onChange={setSource}>
          <option value="all">Alle bronnen</option>
          {sources.map((item) => <option key={item} value={item}>{formatSource(item)}</option>)}
        </SelectControl>
        <SelectControl label="Land" value={country} onChange={setCountry}>
          <option value="all">Alle landen</option>
          {countries.map((item) => <option key={item} value={item}>{item}</option>)}
        </SelectControl>
        <SelectControl label="Signaal" value={verdict} onChange={setVerdict}>
          <option value="all">Alle signalen</option>
          <option value="undervalued">Ondergewaardeerd</option>
          <option value="fair">Redelijk</option>
          <option value="watch">Volgen</option>
          <option value="expensive">Duur</option>
        </SelectControl>
        <SelectControl label="Sorteren" value={sortBy} onChange={(value) => setSortBy(value as SortKey)}>
          <option value="score">Beste dealscore</option>
          <option value="delta">Grootste korting</option>
          <option value="newest">Nieuwst gezien</option>
          <option value="price-low">Laagste prijs</option>
          <option value="price-high">Hoogste prijs</option>
        </SelectControl>
      </section>

      <section className="stats-grid">
        <StatCard label="Advertenties in beeld" value={String(filteredListings.length)} detail={`${snapshot.summary.listingCount} gevolgde momentopname-advertenties`} tone="accent" />
        <StatCard label="Bronnen gedekt" value={String(sources.length)} detail="Marktplaatsen en aggregators gemodelleerd" />
        <StatCard label="Gemiddelde vraagprijs" value={eur.format(averagePrice)} detail="Huidige gefilterde voorraad" />
        <StatCard label="Waarde prijsdalingen" value={eur.format(totalPriceDrops)} detail={`${undervaluedCount} ondergewaardeerde kandidaten`} tone="good" />
        <StatCard
          label="Geschatte verhuur/dag"
          value={averageDailyRental > 0 ? eur.format(averageDailyRental) : 'Volgt'}
          detail={rentalEstimates.length > 0 ? `${rentalEstimates.length} verhuurvergelijkingen gevonden` : 'Wacht op SnappCar/API-verhuurcomps'}
          tone="accent"
        />
        <StatCard
          label="Bruto verhuur per maand"
          value={averageMonthlyGross > 0 ? eur.format(averageMonthlyGross) : 'Volgt'}
          detail="Gemodelleerd vóór platformkosten, schoonmaak en stilstand"
        />
        <StatCard
          label="Jaarlijks huurrendement"
          value={averageAnnualYield > 0 ? `${percentPlain.format(averageAnnualYield)}%` : 'Volgt'}
          detail="Bruto ROI t.o.v. huidige vraagprijs"
          tone={averageAnnualYield >= 15 ? 'good' : 'neutral'}
        />
        <StatCard
          label="Beste huurrendement-kandidaat"
          value={bestRentalYield ? `${percentPlain.format(bestRentalYield.rental.annualYieldPct ?? 0)}%` : 'Volgt'}
          detail={bestRentalYield ? `${bestRentalYield.item.listing.make} ${bestRentalYield.item.listing.model} · ${eur.format(bestRentalYield.item.listing.priceEur)}` : 'Nog geen verhuur-ROI-schatting'}
          tone="good"
        />
      </section>

      <section className="panel purchase-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><WalletCards size={16} /> koopbeslissing</p>
            <h2>Welke auto moet ik kopen?</h2>
          </div>
          <p>Rangschikt gefilterde kandidaten op landingskosten, Nederlandse markt-upside, netto verhuurrendement, terugverdientijd, importcomplexiteit en databetrouwbaarheid.</p>
        </div>
        <div className="purchase-layout">
          <div className="purchase-ranking">
            <div className="table-scroll">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Auto / bron</th>
                    <th>Vraagprijs</th>
                    <th>Geland NL</th>
                    <th>NL-verschil</th>
                    <th>Netto rendement</th>
                    <th>Terugverdientijd</th>
                    <th>Score</th>
                    <th>Oordeel</th>
                    <th>Belangrijkste redenen / blokkades</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseDisplayRows.purchaseRows.map((candidate, index) => {
                    const { listing, decision } = candidate;
                    const selected = selectedPurchaseCandidate?.listing.id === listing.id;
                    const notes = [...decision.blockers.slice(0, 1), ...decision.reasons.slice(0, 2)].slice(0, 3);
                    return (
                      <tr
                        key={`purchase-${listing.id}`}
                        className={selected ? 'selected-row' : undefined}
                        onClick={() => setSelectedPurchaseId(listing.id)}
                      >
                        <td><strong>#{index + 1}</strong></td>
                        <td><strong>{listing.make} {listing.model}</strong><span>{formatSource(listing.source)} · {listing.country} · {listing.year} · {listing.location}</span></td>
                        <td>{eur.format(listing.priceEur)}</td>
                        <td>{eur.format(decision.landedCostEur)}</td>
                        <td className={decision.landedCostDeltaToDutchMarketPct <= 0 ? 'positive' : 'negative'}>{percent.format(decision.landedCostDeltaToDutchMarketPct)}%</td>
                        <td>{percentPlain.format(decision.netRentalYieldPct)}%</td>
                        <td>{formatPayback(decision.paybackMonths)}</td>
                        <td><strong>{decision.purchaseScore}</strong><span>vertr. {decision.dataConfidenceScore}</span></td>
                        <td><span className={`purchase-verdict ${decision.verdict}`}>{verdictLabel(decision.verdict)}</span></td>
                        <td className="reason-cell">{notes.length > 0 ? notes.map((note) => <span key={note}>{note}</span>) : <PendingValue label="Geen notities" />}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {purchaseDisplayRows.hiddenPurchaseRowCount > 0 && (
              <p className="limit-note">Toont de top {purchaseDisplayRows.purchaseRows.length} koopkandidaten. Verfijn filters/zoekopdracht om de overige {purchaseDisplayRows.hiddenPurchaseRowCount} te bekijken zonder mobiel vast te laten lopen.</p>
            )}
            {filteredPurchaseCandidates.length === 0 && <div className="empty-state"><Target size={20} /> Geen koopbeslissingen passen bij de actieve filters.</div>}
          </div>

          {selectedPurchaseCandidate && (
            <aside className="candidate-detail" aria-label="Details geselecteerde koopkandidaat">
              <div className="candidate-detail-header">
                <span className={`purchase-verdict ${selectedPurchaseCandidate.decision.verdict}`}>{verdictLabel(selectedPurchaseCandidate.decision.verdict)}</span>
                <strong>{selectedPurchaseCandidate.listing.title}</strong>
                <p>{formatSource(selectedPurchaseCandidate.listing.source)} · {selectedPurchaseCandidate.listing.country} · {km.format(selectedPurchaseCandidate.listing.mileageKm)} km · {sellerLabel(selectedPurchaseCandidate.listing.sellerType)}</p>
              </div>

              <div className="detail-metric-grid">
                <div><span>Landingskosten</span><strong>{eur.format(selectedPurchaseCandidate.decision.landedCostEur)}</strong></div>
                <div><span>Koopscore</span><strong>{selectedPurchaseCandidate.decision.purchaseScore}/100</strong></div>
                <div><span>Netto jaarverhuur</span><strong>{eur.format(selectedPurchaseCandidate.decision.netAnnualRentalEur)}</strong></div>
                <div><span>Terugverdientijd</span><strong>{formatPayback(selectedPurchaseCandidate.decision.paybackMonths)}</strong></div>
              </div>

              <div className="detail-block">
                <h3><CheckCircle2 size={17} /> Redenen om te kopen</h3>
                <ul>
                  {selectedPurchaseCandidate.decision.reasons.length > 0
                    ? selectedPurchaseCandidate.decision.reasons.map((reason) => <li key={reason}>{reason}</li>)
                    : <li>Er zijn geen positieve koopredenen gegenereerd.</li>}
                </ul>
              </div>

              <div className="detail-block warning">
                <h3><AlertTriangle size={17} /> Blokkades en waarschuwingen</h3>
                <ul>
                  {[...selectedPurchaseCandidate.decision.blockers, ...(selectedPurchaseCandidate.qualityReport?.warnings ?? [])].length > 0
                    ? [...selectedPurchaseCandidate.decision.blockers, ...(selectedPurchaseCandidate.qualityReport?.warnings ?? [])].map((warning) => <li key={warning}>{warning}</li>)
                    : <li>Geen blokkades in de huidige momentopname.</li>}
                </ul>
              </div>

              <div className="detail-block">
                <h3><WalletCards size={17} /> Opbouw landingskosten</h3>
                {selectedPurchaseCandidate.importEstimate ? (
                  <dl className="detail-list">
                    <div><dt>Vraagprijs</dt><dd>{eur.format(selectedPurchaseCandidate.listing.priceEur)}</dd></div>
                    <div><dt>Transport</dt><dd>{eur.format(selectedPurchaseCandidate.importEstimate.transportEur)}</dd></div>
                    <div><dt>RDW + kentekenplaten</dt><dd>{eur.format(selectedPurchaseCandidate.importEstimate.rdwInspectionEur + selectedPurchaseCandidate.importEstimate.platesAndRegistrationEur)}</dd></div>
                    <div><dt>BPM-schatting</dt><dd>{eur.format(selectedPurchaseCandidate.importEstimate.bpmEstimateEur)}{selectedPurchaseCandidate.importEstimate.needsManualBpm ? ' · handmatige check' : ''}</dd></div>
                    <div><dt>Btw / invoerrechten / buffer</dt><dd>{eur.format(selectedPurchaseCandidate.importEstimate.vatEstimateEur + selectedPurchaseCandidate.importEstimate.customsDutyEstimateEur + selectedPurchaseCandidate.importEstimate.adminBufferEur)}</dd></div>
                    <div><dt>Regio</dt><dd>{regionLabel(selectedPurchaseCandidate.importEstimate.region)}</dd></div>
                  </dl>
                ) : <p className="muted-copy">Geen importschatting beschikbaar voor deze kandidaat.</p>}
                {selectedPurchaseCandidate.importEstimate?.assumptions.length ? (
                  <ul className="assumption-list">{selectedPurchaseCandidate.importEstimate.assumptions.map((item) => <li key={item}>{item}</li>)}</ul>
                ) : null}
              </div>

              <div className="detail-block">
                <h3><Info size={17} /> Verhuur en datakwaliteit</h3>
                {selectedPurchaseCandidate.netRentalEstimate ? (
                  <dl className="detail-list">
                    <div><dt>Bruto per maand</dt><dd>{eur.format(selectedPurchaseCandidate.netRentalEstimate.monthlyGrossEur)}</dd></div>
                    <div><dt>Netto per maand</dt><dd>{eur.format(selectedPurchaseCandidate.netRentalEstimate.netMonthlyRentalEur)}</dd></div>
                    <div><dt>Netto rendement op landingskosten</dt><dd>{percentPlain.format(selectedPurchaseCandidate.netRentalEstimate.netRentalYieldOnLandedCostPct)}%</dd></div>
                    <div><dt>Platform / reserves</dt><dd>{percentPlain.format(selectedPurchaseCandidate.netRentalEstimate.assumptions.platformFeePct)}% kosten · {percentPlain.format(selectedPurchaseCandidate.netRentalEstimate.assumptions.downtimeReservePct)}% stilstand</dd></div>
                  </dl>
                ) : <p className="muted-copy">Geen netto verhuurschatting beschikbaar voor deze kandidaat.</p>}
                <p className="quality-line">Kwaliteit: {confidenceLabel(selectedPurchaseCandidate.qualityReport?.confidence)} · volledigheid {selectedPurchaseCandidate.qualityReport?.completenessPct ?? selectedPurchaseCandidate.decision.dataConfidenceScore}%</p>
                {selectedPurchaseCandidate.qualityReport?.missingCriticalFields.length ? (
                  <p className="quality-line">Ontbreekt: {selectedPurchaseCandidate.qualityReport.missingCriticalFields.join(', ')}</p>
                ) : null}
              </div>
              <div className="detail-block">
                <h3><ExternalLink size={17} /> Advertentie- en verhuurmarktlinks</h3>
                <ListingLinks listing={selectedPurchaseCandidate.listing} rentalLinks={selectedPurchaseCandidate.rentalCompetitorLinks} />
              </div>
            </aside>
          )}
        </div>
      </section>

      <section className="country-import-grid" aria-label="Landen- en importvergelijking">
        {countryPurchaseSummaries.map((summary) => (
          <article className="country-card" key={summary.country}>
            <div className="country-card-top">
              <span>{summary.country}</span>
              <strong>{summary.count} kandidaten</strong>
            </div>
            <dl>
              <div><dt>Gem. vraagprijs</dt><dd>{summary.averageListedPrice ? eur.format(summary.averageListedPrice) : 'n.v.t.'}</dd></div>
              <div><dt>Gem. geland NL</dt><dd>{summary.averageLandedCost ? eur.format(summary.averageLandedCost) : 'n.v.t.'}</dd></div>
              <div><dt>Gem. netto rendement</dt><dd>{summary.averageYield ? `${percentPlain.format(summary.averageYield)}%` : 'n.v.t.'}</dd></div>
              <div><dt>Complexiteit</dt><dd>{summary.averageComplexity ? `${Math.round(summary.averageComplexity)}/100` : 'n.v.t.'}</dd></div>
            </dl>
            <p className={summary.manualBpmCount > 0 || (summary.averageComplexity ?? 100) < 70 ? 'import-warning' : 'import-ok'}>
              {summary.manualBpmCount > 0 || (summary.averageComplexity ?? 100) < 70
                ? `${summary.manualBpmCount} hebben handmatige BPM/importcheck nodig`
                : 'Lage importfrictie in huidige momentopname'}
            </p>
            {summary.bestCandidate && (
              <button className="country-pick" onClick={() => setSelectedPurchaseId(summary.bestCandidate!.listing.id)}>
                Beste: {summary.bestCandidate.listing.make} {summary.bestCandidate.listing.model} · score {summary.bestCandidate.decision.purchaseScore}
              </button>
            )}
          </article>
        ))}
      </section>

      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Gauge size={16} /> waardering</p>
            <h2>Vraagprijs vs vergelijkbare mediaan</h2>
          </div>
          <p>Waardering gebruikt hetzelfde merk/model, ±2 jaar, ±40k km en compatibele brandstof via de bestaande domeinlogica.</p>
        </div>
        <div className="chart-wrap">
          {filteredDisplayRows.hiddenChartRowCount > 0 && (
            <p className="limit-note chart-limit">Grafiek toont de top {filteredDisplayRows.chartRows.length} resultaten voor mobiele snelheid; filters gelden nog steeds voor alle {filteredListings.length} rijen.</p>
          )}
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#cfd8dc" vertical={false} />
                <XAxis dataKey="name" stroke="#607d8b" tick={{ fontSize: 12 }} interval={0} angle={-10} height={58} />
                <YAxis stroke="#607d8b" tickFormatter={(value) => `€${Number(value) / 1000}k`} width={58} />
                <Tooltip
                  cursor={{ fill: 'rgba(25, 118, 210, 0.08)' }}
                  formatter={(value, name) => [eur.format(Number(value)), name === 'asking' ? 'Vraagprijs' : 'Vergelijkbare mediaan']}
                  contentStyle={{ background: '#ffffff', border: '1px solid #cfd8dc', borderRadius: 4, color: '#263238' }}
                  labelStyle={{ color: '#1976d2' }}
                />
                <Legend wrapperStyle={{ color: '#607d8b' }} />
                <Bar dataKey="median" fill="#90a4ae" radius={[3, 3, 0, 0]} name="Vergelijkbare mediaan" />
                <Bar dataKey="asking" fill="#1976d2" radius={[3, 3, 0, 0]} name="Vraagprijs" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state"><Filter size={20} /> Geen listings passen bij deze filters.</div>
          )}
        </div>
      </section>

      <section className="panel listings-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Clock size={16} /> live volglijst</p>
            <h2>Vergelijkbare advertenties</h2>
          </div>
          <p>Lokaal gesorteerd en gefilterd. Kaarten tonen prijsbeweging, marktverschil, gevolgde dagen en bronlinks.</p>
        </div>
        <div className="listing-grid">
          {filteredDisplayRows.listingCards.map((item) => <ListingCard key={item.listing.id} item={item} />)}
        </div>
        {filteredDisplayRows.hiddenListingCardCount > 0 && (
          <p className="limit-note">Toont de top {filteredDisplayRows.listingCards.length} advertentiekaarten. Gebruik zoeken/filters voor de andere {filteredDisplayRows.hiddenListingCardCount} resultaten.</p>
        )}
        {filteredListings.length === 0 && <div className="empty-state"><Search size={20} /> Maak je filters ruimer of wis de zoekopdracht.</div>}
      </section>

      <section className="panel table-panel">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow"><Target size={16} /> analistentabel</p>
            <h2>Dealwachtrij</h2>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Advertentie</th>
                <th>Links</th>
                <th>Bron</th>
                <th>Vraagprijs</th>
                <th>Mediaan</th>
                <th>Verschil</th>
                <th>Verhuur/dag</th>
                <th>Huurrendement</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredDisplayRows.analystRows.map((item) => {
                const { listing, valuation } = item;
                const rental = readRentalEstimate(item);
                return (
                  <tr key={`row-${listing.id}`}>
                    <td><strong>{listing.make} {listing.model}</strong><span>{listing.year} · {km.format(listing.mileageKm)} km · {listing.location}</span></td>
                    <td className="table-link-cell">
                      <a href={listing.url} target="_blank" rel="noreferrer">Advertentie</a>
                      {item.rentalCompetitorLinks.slice(0, 2).map((link) => (
                        <a key={`table-${listing.id}-${link.source}`} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                      ))}
                    </td>
                    <td>{formatSource(listing.source)}<span>{listing.country}</span></td>
                    <td>{eur.format(listing.priceEur)}</td>
                    <td>{eur.format(valuation.marketMedianEur)}</td>
                    <td className={valuation.priceDeltaPct <= 0 ? 'positive' : 'negative'}>{percent.format(valuation.priceDeltaPct)}%</td>
                    <td>{rental?.dailyEur ? eur.format(rental.dailyEur) : <PendingValue />}</td>
                    <td>{rental?.annualYieldPct ? `${percentPlain.format(rental.annualYieldPct)}%` : <PendingValue />}</td>
                    <td>{valuation.dealScore}</td>
                    <td><span className={`verdict ${valuation.verdict}`}>{verdictLabel(valuation.verdict)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredDisplayRows.hiddenAnalystRowCount > 0 && (
          <p className="limit-note">Toont de eerste {filteredDisplayRows.analystRows.length} dealwachtrij-rijen; {filteredDisplayRows.hiddenAnalystRowCount} extra blijven filterbaar zonder in de pagina te renderen.</p>
        )}
      </section>

      <section className="coverage-grid">
        <article className="panel alert-panel">
          <p className="eyebrow"><Bell size={16} /> alert-workflow</p>
          <h2>Volglijsten zonder server-aannames</h2>
          <p>
            Opgeslagen zoekopdrachten kunnen model, budget, kilometerstand, landen en vertrouwde bronnen volgen. Wanneer momentopnames binnenkomen,
            moeten alerts afgaan op nieuwe onder-markt advertenties, relevante prijsdalingen en lang gevolgde auto’s die
            een dealscore-drempel passeren.
          </p>
          <ul>
            <li><CheckCircle2 size={17} /> Grote korting t.o.v. vergelijkbare mediaan</li>
            <li><CheckCircle2 size={17} /> Prijsdaling sinds vorige momentopname</li>
            <li><CheckCircle2 size={17} /> Bronprioritering op basis van betrouwbaarheid</li>
            <li><CheckCircle2 size={17} /> Statische JSON-chunks op /data/market-snapshot-manifest.json</li>
          </ul>
        </article>

        <article className="panel coverage-panel">
          <p className="eyebrow"><Globe2 size={16} /> brondekking</p>
          <h2>Marktplaats-gereedheid</h2>
          <div className="source-list">
            {coverage.map(({ source: marketSource, rows, countriesCovered, highConfidence }) => (
              <div className="source-row" key={marketSource}>
                <div>
                  <strong>{formatSource(marketSource)}</strong>
                  <p>{snapshot.sources.find((item) => item.id === marketSource)?.robotsNote ?? sourceNotes[marketSource]}</p>
                </div>
                <span>{rows.length} advertenties · {countriesCovered || '—'} · {highConfidence} hoge betrouwbaarheid</span>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="panel rental-methodology-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Sparkles size={16} /> verhuur-ROI</p>
            <h2>Betrouwbaarheid verhuurvergelijking eigenaar</h2>
          </div>
          <p>Verhuurschattingen worden alleen getoond wanneer de gegenereerde momentopname verdedigbare vergelijkingsdata bevat; anders blijven kaarten op ‘volgt’ staan.</p>
        </div>
        <div className="rental-source-grid">
          <div className="rental-source-card primary">
            <strong>Momentopname-betrouwbaarheid</strong>
            <p>{rentalSourceSummary}</p>
          </div>
          <div className="rental-source-card primary">
            <strong>SnappCar eerst</strong>
            <p>Voorkeursbron voor eigenaar-verhuurvergelijkingen in NL/BE dagtarieven, met betrouwbaarheid gekoppeld aan merk/model, leeftijd, locatie en samplegrootte.</p>
          </div>
          <div className="rental-source-card">
            <strong>Getaround alleen via API/betaald</strong>
            <p>Gebruik alleen gestructureerde of gelicentieerde toegang; scraping van zoekresultaten wordt niet aangenomen omdat robots-regels dit verbieden.</p>
          </div>
          <div className="rental-source-card">
            <strong>Vergelijkingspunten, geen directe vergelijkingen</strong>
            <p>MyWheels/Greenwheels vloottarieven en Sixt/Europcar commerciële prijzen kunnen plafonds kalibreren, maar krijgen lagere betrouwbaarheid dan eigenaar-verhuurvergelijkingen.</p>
          </div>
          <div className="rental-source-card muted">
            <strong>Turo overgeslagen</strong>
            <p>Uitgesloten van de standaard NL-workflow; schattingen blijven ‘volgt’ tenzij een toekomstige datamomentopname een toegestane bron levert.</p>
          </div>
        </div>
      </section>

      <footer>
        <ShieldCheck size={16} /> Draait op statische momentopnames · waarderingslogica getest · klaar voor Vercel-uitrol.
      </footer>
    </main>
  );
}
