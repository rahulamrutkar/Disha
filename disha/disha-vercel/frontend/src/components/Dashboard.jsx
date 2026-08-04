import MarketBar    from './MarketBar.jsx'
import StockChart   from './StockChart.jsx'
import AIInsights   from './AIInsights.jsx'
import NewsFeed     from './NewsFeed.jsx'
import VerdictPanel from './VerdictPanel.jsx'
import TickerRhythm from './TickerRhythm.jsx'
import { BarChart2 } from 'lucide-react'

const QUICK = ['RELIANCE','TCS','HDFCBANK','INFY','SBIN','MARUTI','BAJFINANCE','ICICIBANK','TITAN','WIPRO']

export default function Dashboard({ data, loading, error, onSearch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Market Indices */}
      <MarketBar />

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <BarChart2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} color="var(--accent)" />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
            Search for a stock to get started
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 24 }}>
            Get AI analysis, candlestick charts, news sentiment, and buy/sell calls
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {QUICK.map(sym => (
              <button key={sym} onClick={() => onSearch(sym)}
                style={{ padding: '6px 14px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'monospace' }}>
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14 }}>
          Fetching price data, news, and running AI analysis…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '16px 20px', background: 'var(--loss-bg)', border: '1px solid var(--loss)', borderRadius: 8, color: 'var(--loss)', fontSize: 14 }}>
          {error} — check the NSE symbol and try again.
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          {/* Top row: Chart + AI Insights */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16 }}>
            <StockChart data={data.price_series} company={data.company_name} quote={data.quote} />
            <AIInsights data={data} />
          </div>

          {/* Verdict + Ticker Rhythm */}
          <VerdictPanel data={data} />
          <TickerRhythm timing={data.timing} />

          {/* News */}
          <NewsFeed news={data.news} sentiment={data.sentiment} />
        </>
      )}
    </div>
  )
}
