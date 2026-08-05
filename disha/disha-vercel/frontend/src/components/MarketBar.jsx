import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

const DEFAULTS = [
  { name:'NIFTY 50',   symbol:'^NSEI',     is_vix:false },
  { name:'SENSEX',     symbol:'^BSESN',    is_vix:false },
  { name:'BANK NIFTY', symbol:'^NSEBANK',  is_vix:false },
  { name:'INDIA VIX',  symbol:'^INDIAVIX', is_vix:true  },
]

function Skeleton() {
  return (
    <div style={{ height:14, borderRadius:6, background:'var(--bg-hover)', marginBottom:4, animation:'pulse 1.5s infinite' }} />
  )
}

export default function MarketBar() {
  const [indices, setIndices] = useState(DEFAULTS)
  const [loaded,  setLoaded]  = useState(false)

  useEffect(() => {
    fetch('/api/indices')
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => {
        if (Array.isArray(d) && d.length) {
          setIndices(d)
          setLoaded(true)
        }
      })
      .catch(() => setLoaded(true))   // show placeholders on failure
  }, [])

  return (
    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
      {indices.map((idx, i) => {
        const up    = (idx.change_pct ?? 0) >= 0
        // For VIX: green when falling (good for market), red when rising
        const color = idx.is_vix
          ? (up ? 'var(--loss)' : 'var(--gain)')
          : (up ? 'var(--gain)' : 'var(--loss)')
        const sparkData = (idx.sparkline || []).map(v => ({ v }))

        return (
          <div key={idx.name} className="card" style={{ padding:'14px 16px' }}>
            <div style={{ fontSize:10, fontWeight:600, color:'var(--text-3)', letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:6 }}>
              {idx.name}
            </div>

            {idx.price != null ? (
              <>
                <div style={{ fontSize:20, fontWeight:700, color:'var(--text-1)', fontFamily:'JetBrains Mono, monospace', letterSpacing:'-0.5px' }}>
                  {idx.price.toLocaleString('en-IN', { maximumFractionDigits:2 })}
                </div>
                <div style={{ fontSize:12, fontWeight:600, color, display:'flex', alignItems:'center', gap:3, marginTop:2 }}>
                  {up ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                  {up && idx.change > 0 ? '+' : ''}{idx.change?.toFixed(2)} ({up ? '+' : ''}{idx.change_pct?.toFixed(2)}%)
                </div>
                {sparkData.length > 1 && (
                  <div style={{ marginTop:6, height:36 }}>
                    <ResponsiveContainer width="100%" height={36}>
                      <LineChart data={sparkData}>
                        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ marginBottom:4 }}><Skeleton /></div>
                <div style={{ width:'60%' }}><Skeleton /></div>
                <div style={{ height:36, marginTop:6, background:'var(--bg-hover)', borderRadius:4, opacity:0.4 }} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
