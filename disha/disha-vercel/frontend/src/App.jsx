import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import { fetchSymbols, fetchAnalysis } from './api.js'
import VerdictPanel from './components/VerdictPanel.jsx'
import StatsRow from './components/StatsRow.jsx'
import PriceChart from './components/PriceChart.jsx'
import TechnicalCard from './components/TechnicalCard.jsx'
import TickerRhythm from './components/TickerRhythm.jsx'
import NewsFeed from './components/NewsFeed.jsx'

export default function App() {
  const [symbols, setSymbols] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { fetchSymbols().then(setSymbols).catch(() => setSymbols([])) }, [])

  async function handleSearch(symbol) {
    setLoading(true); setError(null)
    try { setData(await fetchAnalysis(symbol)) }
    catch (e) { setError(e.message); setData(null) }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-base">
      <header className="border-b border-hairline">
        <div className="mx-auto max-w-5xl px-6 py-8 flex flex-col gap-5">
          <div className="flex items-center gap-2 text-gold">
            <Compass size={22} />
            <span className="font-display text-2xl text-ink">Disha</span>
            <span className="text-xs uppercase tracking-[0.25em] text-muted">/ AI direction for NSE shares</span>
          </div>
          <form onSubmit={e => { e.preventDefault(); const v = e.target.q.value.trim().toUpperCase(); if(v) handleSearch(v) }} className="flex gap-2 max-w-xl w-full">
            <input name="q" list="syms" placeholder="NSE symbol — e.g. RELIANCE, TCS, INFY"
              className="flex-1 rounded-sm border border-hairline bg-panel px-4 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none" />
            <datalist id="syms">{symbols.map(s => <option key={s.symbol} value={s.symbol}>{s.name}</option>)}</datalist>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 rounded-sm bg-gold px-5 py-3 text-sm font-medium text-base hover:bg-goldsoft disabled:opacity-60">
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>
          <div className="flex flex-wrap gap-2">
            {symbols.slice(0,8).map(s => (
              <button key={s.symbol} onClick={() => handleSearch(s.symbol)}
                className="rounded-sm border border-hairline px-2.5 py-1 text-xs text-muted hover:border-gold hover:text-goldsoft">
                {s.symbol}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {!data && !loading && !error && (
          <div className="rounded-sm border border-dashed border-hairline p-10 text-center">
            <p className="font-display text-xl text-ink/80">Type an NSE symbol to get your bearings.</p>
            <p className="mt-2 text-sm text-muted">Price stats · timing heatmap · AI news sentiment · BUY/SELL/HOLD call</p>
          </div>
        )}
        {loading && <div className="rounded-sm border border-hairline bg-panel p-10 text-center text-sm text-muted">Pulling price history, scanning headlines, and asking AI for a read…</div>}
        {error && <div className="rounded-sm border border-loss/40 bg-loss/10 p-6 text-sm text-loss">{error}</div>}
        {data && !loading && (
          <div className="flex flex-col gap-6">
            <VerdictPanel data={data} />
            <StatsRow stats={data.stats} />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2"><PriceChart series={data.price_series} /></div>
              <TechnicalCard technical={data.technical} />
            </div>
            <TickerRhythm timing={data.timing} />
            <NewsFeed news={data.news} sentiment={data.sentiment} />
          </div>
        )}
        <footer className="mt-10 border-t border-hairline pt-6 text-xs text-muted leading-relaxed">
          Disha is an educational demo. The BUY/SELL/HOLD call and timing heatmap are based on public market data and news only — not personalized financial advice. Markets carry real risk. Consider a SEBI-registered advisor for decisions that matter.
        </footer>
      </main>
    </div>
  )
}
