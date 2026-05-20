import { ArrowDownRight, ArrowUpRight, Car, Clock, Database, Gauge, Search } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { sampleListings } from './data/sampleListings';
import { valueListing } from './domain/valuation';
import './styles.css';

const eur = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const km = new Intl.NumberFormat('nl-NL');

const enriched = sampleListings
  .map((listing) => ({ listing, valuation: valueListing(listing, sampleListings) }))
  .sort((a, b) => b.valuation.dealScore - a.valuation.dealScore);

const chartData = enriched.map(({ listing, valuation }) => ({
  name: `${listing.source} ${listing.year}`,
  price: listing.priceEur,
  median: valuation.marketMedianEur,
  score: valuation.dealScore,
}));

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

export default function App() {
  const medianPrice = Math.round(sampleListings.reduce((sum, item) => sum + item.priceEur, 0) / sampleListings.length);
  const best = enriched[0];
  const sources = new Set(sampleListings.map((item) => item.source)).size;

  return (
    <main>
      <section className="hero">
        <div>
          <p className="eyebrow"><Database size={16} /> NL + nearby used-car market tracker</p>
          <h1>Track listings, price drops, and undervalued cars across second-hand markets.</h1>
          <p className="lede">
            Initial private dashboard scaffold with sample marketplace data, valuation logic, source notes,
            and the shape needed for scrapers + database snapshots.
          </p>
          <div className="hero-actions">
            <button><Search size={18} /> Watch Golf 1.5 TSI</button>
            <button className="secondary"><Car size={18} /> Add market source</button>
          </div>
        </div>
        <div className="hero-panel">
          <span>Best current signal</span>
          <strong>{best.listing.title}</strong>
          <p>{eur.format(best.listing.priceEur)} · {km.format(best.listing.mileageKm)} km · score {best.valuation.dealScore}</p>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard label="Listings tracked" value={String(sampleListings.length)} detail="sample schema, crawler-ready" />
        <StatCard label="Sources modeled" value={String(sources)} detail="AutoScout24, Marktplaats, Gaspedaal, etc." />
        <StatCard label="Avg ask price" value={eur.format(medianPrice)} detail="replace with median by comparable set" />
        <StatCard label="Top deal score" value={`${best.valuation.dealScore}/100`} detail={`${best.valuation.priceDeltaPct}% vs local comps`} />
      </section>

      <section className="panel chart-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Gauge size={16} /> valuation</p>
            <h2>Asking price vs comparable median</h2>
          </div>
          <p>Comps are same make/model, ±2 years, ±40k km, same-ish fuel.</p>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222936" />
            <XAxis dataKey="name" stroke="#8a93a5" tick={{ fontSize: 12 }} />
            <YAxis stroke="#8a93a5" tickFormatter={(value) => `€${Number(value) / 1000}k`} />
            <Tooltip contentStyle={{ background: '#10151f', border: '1px solid #273143', borderRadius: 12 }} />
            <Bar dataKey="median" fill="#334155" radius={[6, 6, 0, 0]} />
            <Bar dataKey="price" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow"><Clock size={16} /> watchlist</p>
            <h2>Comparable listings</h2>
          </div>
          <p>Sorted by deal score. Price history starts once the crawler snapshots run daily.</p>
        </div>
        <div className="listing-grid">
          {enriched.map(({ listing, valuation }) => {
            const dropped = listing.previousPriceEur && listing.previousPriceEur > listing.priceEur;
            return (
              <article key={listing.id} className="listing-card">
                <div className="card-topline">
                  <span>{listing.source} · {listing.country}</span>
                  <span className={`verdict ${valuation.verdict}`}>{valuation.verdict}</span>
                </div>
                <h3>{listing.title}</h3>
                <div className="price-row">
                  <strong>{eur.format(listing.priceEur)}</strong>
                  {dropped ? <span className="drop"><ArrowDownRight size={16} /> {eur.format(listing.previousPriceEur! - listing.priceEur)}</span> : <span className="rise"><ArrowUpRight size={16} /> stable</span>}
                </div>
                <dl>
                  <div><dt>Market delta</dt><dd>{valuation.priceDeltaPct}%</dd></div>
                  <div><dt>Median comp</dt><dd>{eur.format(valuation.marketMedianEur)}</dd></div>
                  <div><dt>Mileage</dt><dd>{km.format(listing.mileageKm)} km</dd></div>
                  <div><dt>Days watched</dt><dd>{valuation.daysOnMarket}</dd></div>
                </dl>
                <p className="meta">{listing.year} · {listing.fuel} · {listing.transmission} · {listing.location} · {listing.sellerType}</p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
