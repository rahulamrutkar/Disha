import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Cell,
} from 'recharts'
import {
  TrendingUp, TrendingDown, RefreshCw, Activity,
  ArrowUpRight, ArrowDownRight, Layers,
} from 'lucide-react'
import { fetchMarketOverview } from '../api.js'

const c = (v) => `var(${v})`

// ── Index card with sparkline ─────────────────────────────────────────────────
function IndexCard({ item, loading }) {
  const vix  = item.is_vix
  const up   = (item.change_pct ?? 0) >= 0
  const good = vix ? !up : up
  const clr  = item.price == null ? c('--text-3') : good ? c('--gain') : c('--loss')
  const spark = (item.sparkline || []).map(v => ({ v }))

  return (
    <div className="card" style={{ padding: '18px 20px', minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: c('--text-3'), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
        {item.name}
      </div>
      {loading || item.price == null ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ width: '70%', height: 24, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
          <div style={{ width: '40%', height: 14, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 44 }} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 22, fontWeight: 700, color: c('--text-1'), fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
            {item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: clr, display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, marginBottom: 6 }}>
            {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {item.change != null && `${item.change > 0 ? '+' : ''}${item.change.toLocaleString('en-IN', { maximumFractionDigits: 2 })}  `}
            ({up && item.change_pct > 0 ? '+' : ''}{item.change_pct?.toFixed(2)}%)
          </div>
          {spark.length > 2 && (
            <ResponsiveContainer width="100%" height={44}>
              <LineChart data={spark}>
                <Line type="monotone" dataKey="v" stroke={clr} strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </>
      )}
    </div>
  )
}

// ── Breadth bar ───────────────────────────────────────────────────────────────
function BreadthBar({ breadth, loading }) {
  if (loading || !breadth) {
    return (
      <div className="card" style={{ padding: '18px 20px' }}>
        <div style={{ width: '30%', height: 14, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite', marginBottom: 12 }} />
        <div style={{ height: 10, borderRadius: 6, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
      </div>
    )
  }
  const { advancing = 0, declining = 0, total = 1 } = breadth
  const advPct = Math.round((advancing / total) * 100)

  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: c('--text-1'), display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <Activity size={14} color={c('--accent')} /> Market Breadth
        <span style={{ fontSize: 11, fontWeight: 400, color: c('--text-3'), marginLeft: 'auto' }}>{total} stocks tracked</span>
      </div>
      <div style={{ display: 'flex', gap: 0, borderRadius: 6, overflow: 'hidden', height: 10, marginBottom: 12 }}>
        <div style={{ flex: advancing, background: c('--gain'), transition: 'flex 0.6s ease' }} />
        <div style={{ flex: declining, background: c('--loss'), transition: 'flex 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: c('--gain'), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowUpRight size={14} /> {advancing} advancing ({advPct}%)
        </span>
        <span style={{ fontSize: 12, color: c('--loss'), fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
          {declining} declining <ArrowDownRight size={14} />
        </span>
      </div>
    </div>
  )
}

// ── Movers table ──────────────────────────────────────────────────────────────
function MoversTable({ title, stocks, type, loading, onAnalyze }) {
  const isGain = type === 'gainers'
  const clr    = isGain ? c('--gain') : c('--loss')
  const Icon   = isGain ? ArrowUpRight : ArrowDownRight

  return (
    <div className="card" style={{ padding: '18px 20px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: c('--text-1'), display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <Icon size={15} color={clr} /> {title}
      </div>

      {/* Header row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, paddingBottom: 8,
        borderBottom: `1px solid ${c('--border')}`, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: c('--text-3'), textTransform: 'uppercase', letterSpacing: '0.06em' }}>Stock</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: c('--text-3'), textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Price</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: c('--text-3'), textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right', minWidth: 64 }}>Chg%</span>
      </div>

      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, padding: '10px 0', borderBottom: `1px solid ${c('--border')}` }}>
            <div style={{ flex: 1, height: 14, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: 60, height: 14, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
            <div style={{ width: 50, height: 14, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
          </div>
        ))
      ) : stocks.length === 0 ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: c('--text-3'), fontSize: 13 }}>No data</div>
      ) : (
        stocks.map((s, i) => (
          <button
            key={s.symbol}
            onClick={() => onAnalyze(s.symbol)}
            style={{ width: '100%', display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8,
              padding: '10px 0', borderBottom: i < stocks.length - 1 ? `1px solid ${c('--border')}` : 'none',
              background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', alignItems: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = c('--bg-hover')}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: c('--text-1'), fontFamily: 'monospace' }}>{s.symbol}</div>
              <div style={{ fontSize: 11, color: c('--text-3'), marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{s.name}</div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c('--text-2'), fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              ₹{s.price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) ?? '—'}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: clr, fontVariantNumeric: 'tabular-nums', textAlign: 'right', minWidth: 64 }}>
              {isGain ? '+' : ''}{s.change_pct?.toFixed(2)}%
            </div>
          </button>
        ))
      )}
    </div>
  )
}

// ── Sector heatmap ────────────────────────────────────────────────────────────
const SectorTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  return (
    <div style={{ background: c('--bg-card'), border: `1px solid ${c('--border')}`, borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: c('--text-1'), marginBottom: 4 }}>{d.name}</div>
      <div style={{ color: d.avg_chg >= 0 ? c('--gain') : c('--loss') }}>
        {d.avg_chg >= 0 ? '+' : ''}{d.avg_chg}% avg change
      </div>
      <div style={{ color: c('--text-3'), marginTop: 2 }}>
        ▲ {d.gainers} up · ▼ {d.losers} down
      </div>
    </div>
  )
}

function SectorChart({ sectors, loading }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: c('--text-1'), display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
        <Layers size={14} color={c('--accent')} /> Sector Performance
      </div>
      {loading || !sectors.length ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 28, borderRadius: 4, background: c('--bg-hover'), animation: 'pulse 1.5s infinite', opacity: 1 - i * 0.12 }} />
          ))}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(sectors.length * 38, 200)}>
          <BarChart data={sectors} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false}
              tickFormatter={v => `${v > 0 ? '+' : ''}${v}%`} domain={['auto', 'auto']} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-2)' }} axisLine={false}
              tickLine={false} width={140} />
            <Tooltip content={<SectorTooltip />} cursor={{ fill: 'var(--bg-hover)' }} />
            <Bar dataKey="avg_chg" radius={[0, 4, 4, 0]} maxBarSize={22}>
              {sectors.map((s, i) => (
                <Cell key={i} fill={s.avg_chg >= 0 ? 'var(--gain)' : 'var(--loss)'} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MarketPage({ onAnalyze }) {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [updatedAt, setUpdatedAt] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await fetchMarketOverview()
      setData(d)
      setUpdatedAt(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const indices = data?.indices ?? [
    { name: 'NIFTY 50',   price: null, change_pct: null, sparkline: [], is_vix: false },
    { name: 'SENSEX',     price: null, change_pct: null, sparkline: [], is_vix: false },
    { name: 'BANK NIFTY', price: null, change_pct: null, sparkline: [], is_vix: false },
    { name: 'INDIA VIX',  price: null, change_pct: null, sparkline: [], is_vix: true  },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: c('--text-1') }}>Market Overview</h1>
          {updatedAt && (
            <div style={{ fontSize: 11, color: c('--text-3'), marginTop: 3 }}>
              Updated {updatedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: c('--bg-hover'), border: `1px solid ${c('--border')}`,
            borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            color: c('--text-2'), fontSize: 12, fontWeight: 600 }}
        >
          <RefreshCw size={13} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: c('--loss-bg'), border: `1px solid ${c('--loss')}`,
          borderRadius: 8, color: c('--loss'), fontSize: 13 }}>
          {error} — make sure the backend is running.
        </div>
      )}

      {/* Index cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {indices.map(item => <IndexCard key={item.name} item={item} loading={loading && !data} />)}
      </div>

      {/* Breadth */}
      <BreadthBar breadth={data?.breadth} loading={loading && !data} />

      {/* Gainers + Losers */}
      <div style={{ display: 'flex', gap: 14 }}>
        <MoversTable title="Top Gainers" stocks={data?.gainers ?? []} type="gainers"
          loading={loading && !data} onAnalyze={onAnalyze} />
        <MoversTable title="Top Losers"  stocks={data?.losers  ?? []} type="losers"
          loading={loading && !data} onAnalyze={onAnalyze} />
      </div>

      {/* Sector chart */}
      <SectorChart sectors={data?.sectors ?? []} loading={loading && !data} />
    </div>
  )
}
