import MarketBar    from './MarketBar.jsx'
import StockChart   from './StockChart.jsx'
import AIInsights   from './AIInsights.jsx'
import NewsFeed     from './NewsFeed.jsx'
import VerdictPanel from './VerdictPanel.jsx'
import TickerRhythm from './TickerRhythm.jsx'
import { BarChart2, RefreshCw } from 'lucide-react'

const QUICK = ['RELIANCE','TCS','HDFCBANK','INFY','SBIN','MARUTI','BAJFINANCE','ICICIBANK','TITAN','WIPRO']

export default function Dashboard({ data, loading, error, onSearch }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* Market Indices — always visible */}
      <MarketBar />

      {/* Error — shown above quick buttons */}
      {error && (
        <div style={{ padding:'12px 18px', background:'var(--loss-bg)', border:'1px solid var(--loss)', borderRadius:8, color:'var(--loss)', fontSize:13 }}>
          {error} — check the NSE symbol and try again.
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding:'32px 24px', textAlign:'center', color:'var(--text-3)', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          <RefreshCw size={15} />
          Fetching price data, news, and running AI analysis…
        </div>
      )}

      {/* Empty state — always shown when no data and not loading */}
      {!data && !loading && (
        <div className="card" style={{ padding:'40px 24px', textAlign:'center' }}>
          <BarChart2 size={36} style={{ margin:'0 auto 10px', display:'block', opacity:0.25 }} color="var(--accent)" />
          <div style={{ fontSize:17, fontWeight:700, color:'var(--text-1)', marginBottom:6 }}>
            Search for any NSE stock
          </div>
          <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:22 }}>
            AI analysis · Candlestick chart · News sentiment · Buy/Sell call
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
            {QUICK.map(sym => (
              <button key={sym} onClick={() => onSearch(sym)}
                style={{ padding:'7px 16px', background:'var(--bg-hover)', border:'1px solid var(--border)', borderRadius:20, fontSize:12, fontWeight:600, color:'var(--text-2)', cursor:'pointer', fontFamily:'monospace' }}>
                {sym}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Data loaded */}
      {data && !loading && (
        <>
          <div style={{ display:'grid', gap:16, gridTemplateColumns:'minmax(0,1fr) 300px' }}>
            <StockChart data={data.price_series} company={data.company_name} quote={data.quote} />
            <AIInsights data={data} />
          </div>
          <VerdictPanel data={data} />
          <TickerRhythm timing={data.timing} />
          <NewsFeed news={data.news} sentiment={data.sentiment} />
        </>
      )}
    </div>
  )
}
