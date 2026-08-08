import { useState } from 'react'
import Sidebar    from './components/layout/Sidebar.jsx'
import TopBar     from './components/layout/TopBar.jsx'
import Dashboard  from './components/Dashboard.jsx'
import Screener   from './components/Screener.jsx'
import NewsPage   from './components/NewsPage.jsx'
import WatchlistPage from './components/WatchlistPage.jsx'
import CopilotPage   from './components/CopilotPage.jsx'
import MarketPage    from './components/MarketPage.jsx'
import { fetchAnalysis } from './api.js'

export default function App() {
  const [page,    setPage]    = useState('dashboard')
  const [symbol,  setSymbol]  = useState(null)
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function handleSearch(sym) {
    setPage('dashboard')
    setLoading(true)
    setError(null)
    setSymbol(sym)
    try {
      const result = await fetchAnalysis(sym)
      setData(result)
    } catch(e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  function handleScreenerAnalyze(sym) {
    handleSearch(sym)
    setPage('dashboard')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-base)' }}>
      {/* ── Sidebar ── */}
      <Sidebar active={page} onNav={setPage} />

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar onSearch={handleSearch} currentSymbol={symbol} />

        <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {page === 'dashboard' && (
            <Dashboard
              data={data}
              loading={loading}
              error={error}
              onSearch={handleSearch}
            />
          )}

          {page === 'screener' && (
            <Screener onAnalyze={handleScreenerAnalyze} />
          )}

          {page === 'news' && (
            <NewsPage data={data} />
          )}

          {page === 'watchlist' && (
            <WatchlistPage onAnalyze={handleSearch} />
          )}

          {page === 'copilot' && (
            <CopilotPage currentSymbol={symbol} data={data} />
          )}

          {page === 'market' && (
            <MarketPage onAnalyze={handleSearch} />
          )}

          {['alerts','settings'].includes(page) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-3)', fontSize: 14 }}>
              {page.charAt(0).toUpperCase() + page.slice(1)} — coming soon
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
