import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { TrendingUp, TrendingDown } from 'lucide-react'

export default function MarketBar() {
  const [indices, setIndices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/indices')
      .then(r => r.json())
      .then(d => { setIndices(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, padding: '16px 24px' }}>
      {[1,2,3,4].map(i => (
        <div key={i} className="card" style={{ padding: '14px 16px', height: 80, background: 'var(--surface2)', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10, padding: '16px 20px' }}
         className="sm:grid-cols-4">
      {indices.map(idx => {
        const up   = (idx.change_pct ?? 0) >= 0
        const isVix = idx.is_vix
        const color = isVix
          ? (up ? 'var(--loss)' : 'var(--gain)')
          : (up ? 'var(--gain)' : 'var(--loss)')
        const sparkData = (idx.sparkline || []).map((v, i) => ({ v }))

        return (
          <div key={idx.name} className="card" style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{idx.name}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-0.5px' }}>
                {idx.price != null ? idx.price.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '—'}
              </div>
              {idx.change_pct != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, color, fontSize: 12, fontWeight: 600 }}>
                  {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {up ? '+' : ''}{idx.change_pct}%
                </div>
              )}
            </div>
            {sparkData.length > 2 && (
              <div style={{ width: 80, height: 40 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparkData}>
                    <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
