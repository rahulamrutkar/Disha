import { useEffect, useState } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

function Sparkline({ data, color }) {
  if (!data?.length) return <div style={{ height: 40 }} />
  const pts = data.map((v, i) => ({ v }))
  return (
    <ResponsiveContainer width="100%" height={44}>
      <LineChart data={pts}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export default function MarketCards() {
  const [indices, setIndices] = useState([])

  useEffect(() => {
    fetch('/api/market')
      .then(r => r.json())
      .then(d => setIndices(d.indices || []))
      .catch(() => {})
  }, [])

  const placeholders = indices.length ? indices : [
    { name: 'NIFTY 50', price: null, change_pct: null, sparkline: [] },
    { name: 'SENSEX', price: null, change_pct: null, sparkline: [] },
    { name: 'BANK NIFTY', price: null, change_pct: null, sparkline: [] },
    { name: 'INDIA VIX', price: null, change_pct: null, sparkline: [] },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      {placeholders.map((idx, i) => {
        const up = (idx.change_pct ?? 0) >= 0
        const color = up ? 'var(--gain)' : 'var(--loss)'
        return (
          <div key={i} className="card" style={{ padding: '14px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>{idx.name}</div>
            {idx.price ? (
              <>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                  {idx.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 2 }}>
                  {up ? '+' : ''}{idx.change?.toFixed(2)} ({up ? '+' : ''}{idx.change_pct?.toFixed(2)}%)
                </div>
                <Sparkline data={idx.sparkline} color={color} />
              </>
            ) : (
              <>
                <div style={{ height: 24, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 6, width: '60%' }} />
                <div style={{ height: 14, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 8, width: '40%' }} />
                <div style={{ height: 44 }} />
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
