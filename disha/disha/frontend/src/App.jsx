import { useEffect, useState } from 'react'
import { Compass } from 'lucide-react'
import SearchBar from './components/SearchBar.jsx'
import VerdictPanel from './components/VerdictPanel.jsx'
import StatsRow from './components/StatsRow.jsx'
import PriceChart from './components/PriceChart.jsx'
import TechnicalCard from './components/TechnicalCard.jsx'
import TickerRhythm from './components/TickerRhythm.jsx'
import NewsFeed from './components/NewsFeed.jsx'
import Disclaimer from './components/Disclaimer.jsx'
import { fetchSymbols, fetchAnalysis } from './api.js'

export default function App() {
  const [symbols, setSymbols] = useState([])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetchSymbols().then(setSymbols).catch(() => setSymbols([]))
  }, [])

  async function handleSearch(symbol) {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchAnalysis(symbol)
      setData(result)
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-base">
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-8">
          <div className="flex items-center gap-2 text-gold">
            <Compass size={22} />
            <span className="font-display text-2xl tracking-wide text-ink">Disha</span>
            <span className="text-xs uppercase tracking-[0.25em] text-muted">/ direction, for NSE shares</span>
          </div>
          <SearchBar symbols={symbols} onSearch={handleSearch} loading={loading} />
          <div className="flex flex-wrap gap-2">
            {symbols.slice(0, 8).map((s) => (
              <button
                key={s.symbol}
                onClick={() => handleSearch(s.symbol)}
                className="rounded-sm border border-hairline px-2.5 py-1 text-xs text-muted transition hover:border-gold hover:text-goldsoft"
              >
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
            <p className="mt-2 text-sm text-muted">
              Price stats, a historical buy/sell timing pattern, AI-read news sentiment, and a call — all in one
              view.
            </p>
          </div>
        )}

        {loading && (
          <div className="rounded-sm border border-hairline bg-panel p-10 text-center text-sm text-muted">
            Pulling price history, scanning headlines, and asking the model for a read…
          </div>
        )}

        {error && (
          <div className="rounded-sm border border-loss/40 bg-loss/10 p-6 text-sm text-loss">
            {error}. Double-check the NSE symbol (e.g. RELIANCE, not Reliance Industries) and try again.
          </div>
        )}

        {data && !loading && (
          <div className="flex flex-col gap-6">
            <VerdictPanel data={data} />
            <StatsRow stats={data.stats} />
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <PriceChart series={data.price_series} />
              </div>
              <TechnicalCard technical={data.technical} />
            </div>
            <TickerRhythm timing={data.timing} />
            <NewsFeed news={data.news} sentiment={data.sentiment} />
          </div>
        )}

        <Disclaimer />
      </main>
    </div>
  )
}
