import { useState, useEffect } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, ArrowUpDown, ExternalLink, Info } from 'lucide-react'

// ── Smart investment defaults (value investing principles) ───────────────────
// Market Cap > ₹5,000 Cr   → established, stable companies
// P/E 5–25                 → reasonably valued (avoid loss-making & overvalued)
// Revenue Growth > 10%     → growing business
// Trend: Bullish            → price momentum in your favour
// These can be changed to anything — they're just a sensible starting point.
const DEFAULT_FILTERS = {
  sector:             'all',
  min_price:          '',
  max_price:          '',
  min_market_cap_cr:  5000,
  min_pe:             5,
  max_pe:             25,
  min_revenue_growth: 10,
  trend:              'bullish',
}

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '> ₹500 Cr (Small cap+)', value: 500 },
  { label: '> ₹1,000 Cr (Mid cap+)', value: 1000 },
  { label: '> ₹5,000 Cr (Large mid+)', value: 5000 },
  { label: '> ₹10,000 Cr (Large cap)', value: 10000 },
  { label: '> ₹50,000 Cr (Blue chip)', value: 50000 },
  { label: '> ₹1,00,000 Cr (Mega cap)', value: 100000 },
]

const REVENUE_OPTIONS = [
  { label: 'Any', value: -9999 },
  { label: '> 0% (Positive growth)', value: 0 },
  { label: '> 5%', value: 5 },
  { label: '> 10% ⭐ Recommended', value: 10 },
  { label: '> 15%', value: 15 },
  { label: '> 20%', value: 20 },
  { label: '> 30% (High growth)', value: 30 },
]

const TREND_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: '📈 Bullish — above 50-day avg ⭐ Recommended', value: 'bullish' },
  { label: '📉 Bearish — below 50-day avg', value: 'bearish' },
]

const TREND_STYLE = {
  bullish: { cls: 'text-gain bg-gain/10 border-gain/30', Icon: TrendingUp },
  bearish: { cls: 'text-loss bg-loss/10 border-loss/30', Icon: TrendingDown },
  unknown: { cls: 'text-muted bg-white/5 border-hairline',  Icon: Minus },
}

function fmtCap(v) {
  if (!v) return '—'
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L Cr`
  if (v >= 1000)   return `₹${(v / 1000).toFixed(1)}K Cr`
  return `₹${v} Cr`
}

export default function Screener({ onAnalyze }) {
  const [sectors, setSectors]   = useState([])
  const [filters, setFilters]   = useState(DEFAULT_FILTERS)
  const [results, setResults]   = useState(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const [sortCol, setSortCol]   = useState('market_cap_cr')
  const [sortAsc, setSortAsc]   = useState(false)

  useEffect(() => {
    fetch('/api/sectors')
      .then(r => r.json())
      .then(d => setSectors(d.sectors || []))
      .catch(() => {})
  }, [])

  function set(key, val) { setFilters(f => ({ ...f, [key]: val })) }

  async function run() {
    setLoading(true); setError(null)
    try {
      const p = new URLSearchParams()
      if (filters.sector !== 'all')              p.set('sector', filters.sector)
      if (filters.min_price)                     p.set('min_price', filters.min_price)
      if (filters.max_price)                     p.set('max_price', filters.max_price)
      if (filters.min_market_cap_cr)             p.set('min_market_cap_cr', filters.min_market_cap_cr)
      if (filters.min_pe)                        p.set('min_pe', filters.min_pe)
      if (filters.max_pe && filters.max_pe < 9999) p.set('max_pe', filters.max_pe)
      if (filters.min_revenue_growth > -9999)    p.set('min_revenue_growth', filters.min_revenue_growth)
      if (filters.trend !== 'any')               p.set('trend', filters.trend)

      const res = await fetch(`/api/screener?${p}`)
      if (!res.ok) throw new Error('Screener API failed')
      setResults(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  function reset() { setFilters(DEFAULT_FILTERS); setResults(null); setError(null) }

  function toggleSort(col) {
    sortCol === col ? setSortAsc(a => !a) : (setSortCol(col), setSortAsc(false))
  }

  const sorted = [...(results?.stocks || [])].sort((a, b) => {
    const av = a[sortCol] ?? (sortAsc ? Infinity : -Infinity)
    const bv = b[sortCol] ?? (sortAsc ? Infinity : -Infinity)
    return sortAsc ? av - bv : bv - av
  })

  function SortTh({ col, label }) {
    return (
      <th onClick={() => toggleSort(col)}
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted hover:text-ink transition">
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown size={10} className={sortCol === col ? 'text-gold' : 'opacity-40'} />
        </span>
      </th>
    )
  }

  return (
    <div className="flex flex-col gap-6">

      {/* ── Default filters explanation ──────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-sm border border-gold/20 bg-gold/5 px-4 py-3">
        <Info size={15} className="mt-0.5 shrink-0 text-gold" />
        <p className="text-xs leading-relaxed text-muted">
          <span className="font-medium text-goldsoft">Smart defaults pre-applied</span> — based on value investing principles:
          Market Cap &gt; ₹5,000 Cr · P/E 5–25 · Revenue Growth &gt; 10% · Bullish trend.
          These filter for stable, growing, reasonably-valued companies with price momentum.
          Change any filter to suit your style.
        </p>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────────────────── */}
      <div className="rounded-sm border border-hairline bg-panel p-6">
        <p className="mb-5 text-xs uppercase tracking-wider text-muted">Filter Criteria
          <span className="ml-2 text-[10px] normal-case text-muted/60">— screening {results?.universe ?? '219+'} stocks across 17 sectors</span>
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* Sector */}
          <div className="sm:col-span-2 lg:col-span-3">
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Sector</label>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => set('sector', 'all')}
                className={`rounded-sm border px-3 py-1.5 text-xs transition ${filters.sector === 'all' ? 'border-gold bg-gold/15 text-gold' : 'border-hairline text-muted hover:border-gold/50 hover:text-ink'}`}>
                All Sectors
              </button>
              {sectors.map(s => (
                <button key={s} onClick={() => set('sector', s)}
                  className={`rounded-sm border px-3 py-1.5 text-xs transition ${filters.sector === s ? 'border-gold bg-gold/15 text-gold' : 'border-hairline text-muted hover:border-gold/50 hover:text-ink'}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Price Range */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Price Range (₹)</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.min_price}
                onChange={e => set('min_price', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
              <span className="text-muted">—</span>
              <input type="number" placeholder="Max" value={filters.max_price}
                onChange={e => set('max_price', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
            </div>
          </div>

          {/* Market Cap */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">
              Market Cap
              <span className="ml-1 text-[10px] text-muted">(⭐ &gt;₹5,000 Cr)</span>
            </label>
            <select value={filters.min_market_cap_cr} onChange={e => set('min_market_cap_cr', Number(e.target.value))}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {MARKET_CAP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* P/E Ratio */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">
              P/E Ratio
              <span className="ml-1 text-[10px] text-muted">(⭐ 5–25)</span>
            </label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.min_pe}
                onChange={e => set('min_pe', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
              <span className="text-muted">—</span>
              <input type="number" placeholder="Max" value={filters.max_pe}
                onChange={e => set('max_pe', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
            </div>
          </div>

          {/* Revenue Growth */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Revenue Growth (YoY)</label>
            <select value={filters.min_revenue_growth} onChange={e => set('min_revenue_growth', Number(e.target.value))}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {REVENUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Trend */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Price Trend (vs 50-day avg)</label>
            <select value={filters.trend} onChange={e => set('trend', e.target.value)}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {TREND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-3">
            <button onClick={run} disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-gold px-4 py-2 text-sm font-medium text-base transition hover:bg-goldsoft disabled:opacity-60">
              <Search size={15} />
              {loading ? 'Scanning stocks…' : 'Run Screener'}
            </button>
            <button onClick={reset}
              className="rounded-sm border border-hairline px-4 py-2 text-sm text-muted transition hover:border-gold hover:text-ink">
              Reset
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-sm border border-loss/40 bg-loss/10 p-4 text-sm text-loss">{error}</div>
      )}

      {loading && (
        <div className="rounded-sm border border-hairline bg-panel p-8 text-center">
          <p className="text-sm text-muted">Fetching live data in parallel…</p>
          <p className="mt-1 text-xs text-muted/60">First run takes ~10 sec · subsequent runs are instant (15-min cache)</p>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      {results && !loading && (
        <div className="rounded-sm border border-hairline bg-panel">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3">
            <div>
              <span className="text-xs uppercase tracking-wider text-muted">Results — </span>
              <span className="text-sm font-medium text-gold">{results.total} stocks matched</span>
              <span className="ml-2 text-xs text-muted">out of {results.universe} screened</span>
            </div>
            <p className="text-xs text-muted">Click column header to sort · Analyze button for full analysis</p>
          </div>

          {results.total === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No stocks matched. Try relaxing filters — e.g. increase max P/E, lower market cap, or set trend to "Any".
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-hairline bg-panel2">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Symbol / Sector</th>
                    <SortTh col="price"          label="Price (₹)" />
                    <SortTh col="change_pct"     label="Day %" />
                    <SortTh col="market_cap_cr"  label="Mkt Cap" />
                    <SortTh col="pe"             label="P/E" />
                    <SortTh col="revenue_growth" label="Rev Growth" />
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Trend</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {sorted.map(stock => {
                    const ts   = TREND_STYLE[stock.trend] || TREND_STYLE.unknown
                    const isUp = (stock.change_pct ?? 0) >= 0
                    return (
                      <tr key={stock.symbol} className="transition hover:bg-white/[0.02]">
                        <td className="px-3 py-3">
                          <p className="font-mono text-sm font-medium text-ink">{stock.symbol}</p>
                          <p className="max-w-[180px] truncate text-[10px] text-muted">{stock.name}</p>
                          <p className="text-[10px] text-gold/70">{stock.sector}</p>
                        </td>
                        <td className="tabular px-3 py-3 text-sm font-medium text-ink">
                          ₹{stock.price?.toLocaleString('en-IN')}
                        </td>
                        <td className={`tabular px-3 py-3 text-sm ${isUp ? 'text-gain' : 'text-loss'}`}>
                          {stock.change_pct != null ? `${isUp ? '+' : ''}${stock.change_pct}%` : '—'}
                        </td>
                        <td className="tabular px-3 py-3 text-sm text-ink">{fmtCap(stock.market_cap_cr)}</td>
                        <td className={`tabular px-3 py-3 text-sm ${stock.pe ? 'text-ink' : 'text-muted'}`}>
                          {stock.pe ?? '—'}
                        </td>
                        <td className={`tabular px-3 py-3 text-sm ${
                          stock.revenue_growth == null ? 'text-muted'
                          : stock.revenue_growth >= 0  ? 'text-gain' : 'text-loss'
                        }`}>
                          {stock.revenue_growth != null
                            ? `${stock.revenue_growth >= 0 ? '+' : ''}${stock.revenue_growth}%`
                            : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[10px] ${ts.cls}`}>
                            <ts.Icon size={10} />
                            {stock.trend}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <button onClick={() => onAnalyze(stock.symbol)}
                            className="flex items-center gap-1 rounded-sm border border-gold/40 px-2.5 py-1 text-xs text-gold transition hover:bg-gold/10">
                            <ExternalLink size={11} />
                            Analyze
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!results && !loading && (
        <div className="rounded-sm border border-dashed border-hairline p-10 text-center">
          <p className="font-display text-xl text-ink/80">Smart defaults are ready — just hit Run Screener.</p>
          <p className="mt-2 text-sm text-muted">
            219+ NSE stocks · 17 sectors · Banking, IT, Pharma, Auto, Metals, PSU and more.
            Pre-filtered for value investing criteria.
          </p>
        </div>
      )}
    </div>
  )
}
