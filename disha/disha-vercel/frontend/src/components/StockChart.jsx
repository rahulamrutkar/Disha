import { useState } from 'react'
import {
  ComposedChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

const TIMEFRAMES = ['1W', '1M', '3M', '6M', '1Y']

function CandleTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const up = d.close >= d.open
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12 }}>
      <div style={{ color: 'var(--muted)', marginBottom: 6 }}>{d.date}</div>
      {[['Open','open'],['High','high'],['Low','low'],['Close','close']].map(([l,k]) => (
        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2, fontFamily: 'JetBrains Mono, monospace' }}>
          <span style={{ color: 'var(--muted)' }}>{l}</span>
          <span style={{ color: up ? 'var(--gain)' : 'var(--loss)', fontWeight: 600 }}>₹{d[k]?.toLocaleString('en-IN')}</span>
        </div>
      ))}
    </div>
  )
}

// Custom candlestick bar
function Candle(props) {
  const { x, y, width, height, payload } = props
  if (!payload) return null
  const { open, high, low, close } = payload
  const up = close >= open
  const color = up ? 'var(--gain)' : 'var(--loss)'
  const bodyTop = Math.min(open, close)
  const bodyBot = Math.max(open, close)
  // We'll use the recharts coordinates — y is top of bar, height is bar height
  // Actually let's just draw SVG candles manually
  return null
}

export default function StockChart({ data, company, quote }) {
  const [tf, setTf] = useState('1M')
  if (!data?.length) return (
    <div className="card" style={{ flex: 1, minHeight: 340, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
      Search for a stock to see its chart
    </div>
  )

  const sliced = (() => {
    const n = { '1W': 5, '1M': 22, '3M': 66, '6M': 132, '1Y': 252 }[tf] || 22
    return data.slice(-n)
  })()

  const chartData = sliced.map(d => ({
    ...d,
    barColor: d.close >= (d.open || d.close) ? 'var(--gain)' : 'var(--loss)',
    shadow: [d.low, d.high],
    body: [Math.min(d.open || d.close, d.close), Math.max(d.open || d.close, d.close)],
  }))

  const isUp = (quote?.change_pct ?? 0) >= 0

  return (
    <div className="card" style={{ padding: '20px 20px 16px', flex: 1 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>{company || '—'} · NSE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-1px' }}>
              ₹{quote?.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '—'}
            </span>
            {quote?.change_pct != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14, fontWeight: 600, color: isUp ? 'var(--gain)' : 'var(--loss)' }}>
                {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {isUp ? '+' : ''}{quote.change_pct}%
              </span>
            )}
          </div>
        </div>

        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', borderRadius: 8, padding: 3 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: tf === t ? 'var(--border)' : 'transparent',
              color: tf === t ? 'var(--text)' : 'var(--muted)',
              transition: 'all 0.15s',
            }}>{t}</button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -10 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false} tickLine={false} minTickGap={30}
              tickFormatter={d => d?.slice(5)} />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'JetBrains Mono' }}
              axisLine={false} tickLine={false} domain={['auto','auto']} width={55}
              tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
            <Tooltip content={<CandleTooltip />} />
            {/* Shadow (high-low) */}
            <Bar dataKey="shadow" barSize={1} fill="var(--muted)" />
            {/* Close price area as colored bars */}
            <Bar dataKey="close" barSize={Math.max(2, Math.min(8, Math.floor(800 / chartData.length)))} radius={[2,2,0,0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.close >= (entry.open || entry.close) ? 'var(--gain)' : 'var(--loss)'} fillOpacity={0.85} />
              ))}
            </Bar>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
