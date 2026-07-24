import { useState } from 'react'
import { Search, TrendingUp, TrendingDown, Minus, ArrowUpDown, ExternalLink } from 'lucide-react'

const MARKET_CAP_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '> ₹1,000 Cr', value: 1000 },
  { label: '> ₹5,000 Cr', value: 5000 },
  { label: '> ₹10,000 Cr', value: 10000 },
  { label: '> ₹50,000 Cr', value: 50000 },
  { label: '> ₹1,00,000 Cr', value: 100000 },
]

const REVENUE_OPTIONS = [
  { label: 'Any', value: -9999 },
  { label: '> 0%', value: 0 },
  { label: '> 10%', value: 10 },
  { label: '> 15%', value: 15 },
  { label: '> 20%', value: 20 },
  { label: '> 30%', value: 30 },
]

const TREND_OPTIONS = [
  { label: 'Any', value: 'any' },
  { label: '📈 Bullish (above 50-day avg)', value: 'bullish' },
  { label: '📉 Bearish (below 50-day avg)', value: 'bearish' },
]

const TREND_STYLE = {
  bullish: { cls: 'text-gain bg-gain/10 border-gain/30', icon: TrendingUp },
  bearish: { cls: 'text-loss bg-loss/10 border-loss/30', icon: TrendingDown },
  unknown: { cls: 'text-muted bg-white/5 border-hairline', icon: Minus },
}

function fmt_cr(val) {
  if (!val) return '—'
  if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L Cr`
  if (val >= 1000)   return `₹${(val / 1000).toFixed(1)}K Cr`
  return `₹${val} Cr`
}

export default function Screener({ onAnalyze }) {
  const [filters, setFilters] = useState({
    min_price: '',
    max_price: '',
    min_market_cap_cr: 0,
    min_pe: '',
    max_pe: '',
    min_revenue_growth: -9999,
    trend: 'any',
  })
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [sortCol, setSortCol] = useState('market_cap_cr')
  const [sortAsc, setSortAsc] = useState(false)

  function setFilter(key, val) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  async function runScreener() {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.min_price)          params.set('min_price', filters.min_price)
      if (filters.max_price)          params.set('max_price', filters.max_price)
      if (filters.min_market_cap_cr)  params.set('min_market_cap_cr', filters.min_market_cap_cr)
      if (filters.min_pe)             params.set('min_pe', filters.min_pe)
      if (filters.max_pe)             params.set('max_pe', filters.max_pe)
      if (filters.min_revenue_growth > -9999) params.set('min_revenue_growth', filters.min_revenue_growth)
      if (filters.trend !== 'any')    params.set('trend', filters.trend)

      const res = await fetch(`/api/screener?${params}`)
      if (!res.ok) throw new Error('Screener failed')
      const data = await res.json()
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function resetFilters() {
    setFilters({ min_price: '', max_price: '', min_market_cap_cr: 0, min_pe: '', max_pe: '', min_revenue_growth: -9999, trend: 'any' })
    setResults(null)
  }

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const sorted = results?.stocks ? [...results.stocks].sort((a, b) => {
    const av = a[sortCol] ?? -Infinity
    const bv = b[sortCol] ?? -Infinity
    return sortAsc ? av - bv : bv - av
  }) : []

  function SortHeader({ col, label }) {
    return (
      <th onClick={() => toggleSort(col)}
        className="cursor-pointer select-none whitespace-nowrap px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted hover:text-ink">
        <span className="flex items-center gap-1">
          {label}
          <ArrowUpDown size={10} className={sortCol === col ? 'text-gold' : ''} />
        </span>
      </th>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Filter Panel */}
      <div className="rounded-sm border border-hairline bg-panel p-6">
        <p className="mb-5 text-xs uppercase tracking-wider text-muted">Filter Criteria</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* Price Range */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Price Range (₹)</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.min_price}
                onChange={e => setFilter('min_price', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
              <span className="text-muted">—</span>
              <input type="number" placeholder="Max" value={filters.max_price}
                onChange={e => setFilter('max_price', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
            </div>
          </div>

          {/* Market Cap */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Market Cap</label>
            <select value={filters.min_market_cap_cr} onChange={e => setFilter('min_market_cap_cr', Number(e.target.value))}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {MARKET_CAP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* P/E Ratio */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">P/E Ratio</label>
            <div className="flex items-center gap-2">
              <input type="number" placeholder="Min" value={filters.min_pe}
                onChange={e => setFilter('min_pe', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
              <span className="text-muted">—</span>
              <input type="number" placeholder="Max" value={filters.max_pe}
                onChange={e => setFilter('max_pe', e.target.value)}
                className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
            </div>
          </div>

          {/* Revenue Growth */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Revenue Growth (YoY)</label>
            <select value={filters.min_revenue_growth} onChange={e => setFilter('min_revenue_growth', Number(e.target.value))}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {REVENUE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Trend */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-ink/80">Price Trend (vs 50-day avg)</label>
            <select value={filters.trend} onChange={e => setFilter('trend', e.target.value)}
              className="w-full rounded-sm border border-hairline bg-panel2 px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none">
              {TREND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-end gap-3">
            <button onClick={runScreener} disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-sm bg-gold px-4 py-2 text-sm font-medium text-base transition hover:bg-goldsoft disabled:opacity-60">
              <Search size={15} />
              {loading ? 'Scanning 40 stocks…' : 'Run Screener'}
            </button>
            <button onClick={resetFilters}
              className="rounded-sm border border-hairline px-4 py-2 text-sm text-muted transition hover:border-gold hover:text-ink">
              Reset
            </button>
          </div>
        </div>

        <p className="mt-4 text-xs text-muted">
          Screens 40 large/mid-cap NSE stocks. Revenue growth filter makes individual API calls per stock — may take 5–10 seconds extra.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-sm border border-loss/40 bg-loss/10 p-4 text-sm text-loss">{error}</div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="rounded-sm border border-hairline bg-panel p-8 text-center text-sm text-muted">
          Fetching live data for 40 NSE stocks in one batch call…
        </div>
      )}

      {/* Results */}
      {results && !loading && (
        <div className="rounded-sm border border-hairline bg-panel">
          <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
            <p className="text-xs uppercase tracking-wider text-muted">
              Results — <span className="text-gold">{results.total}</span> stocks matched
            </p>
            <p className="text-xs text-muted">Click any column header to sort · Click symbol to analyze</p>
          </div>

          {results.total === 0 ? (
            <div className="p-8 text-center text-sm text-muted">
              No stocks matched your filters. Try relaxing one or more criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="border-b border-hairline bg-panel2">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Symbol</th>
                    <SortHeader col="price" label="Price" />
                    <SortHeader col="change_pct" label="Day %" />
                    <SortHeader col="market_cap_cr" label="Mkt Cap" />
                    <SortHeader col="pe" label="P/E" />
                    <SortHeader col="revenue_growth" label="Rev Growth" />
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Trend</th>
                    <th className="px-3 py-2 text-left text-[10px] font-medium uppercase tracking-wider text-muted">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {sorted.map((stock) => {
                    const ts = TREND_STYLE[stock.trend] || TREND_STYLE.unknown
                    const TIcon = ts.icon
                    const isUp = (stock.change_pct ?? 0) >= 0
                    return (
                      <tr key={stock.symbol} className="transition hover:bg-white/[0.02]">
                        <td className="px-3 py-3">
                          <div>
                            <p className="font-mono text-sm font-medium text-ink">{stock.symbol}</p>
                            <p className="max-w-[160px] truncate text-[11px] text-muted">{stock.name}</p>
                          </div>
                        </td>
                        <td className="tabular px-3 py-3 text-sm text-ink">
                          ₹{stock.price?.toLocaleString('en-IN')}
                        </td>
                        <td className={`tabular px-3 py-3 text-sm ${isUp ? 'text-gain' : 'text-loss'}`}>
                          {stock.change_pct != null ? `${isUp ? '+' : ''}${stock.change_pct}%` : '—'}
                        </td>
                        <td className="tabular px-3 py-3 text-sm text-ink">
                          {fmt_cr(stock.market_cap_cr)}
                        </td>
                        <td className="tabular px-3 py-3 text-sm text-ink">
                          {stock.pe ?? '—'}
                        </td>
                        <td className={`tabular px-3 py-3 text-sm ${stock.revenue_growth == null ? 'text-muted' : stock.revenue_growth >= 0 ? 'text-gain' : 'text-loss'}`}>
                          {stock.revenue_growth != null ? `${stock.revenue_growth > 0 ? '+' : ''}${stock.revenue_growth}%` : '—'}
                        </td>
                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] ${ts.cls}`}>
                            <TIcon size={11} />
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
          <p className="font-display text-xl text-ink/80">Set your filters and run the screener.</p>
          <p className="mt-2 text-sm text-muted">
            Screens 40 Nifty 50 / large-cap stocks for your exact criteria — price, market cap, P/E, revenue growth, and trend.
          </p>
        </div>
      )}
    </div>
  )
}
