import { useState, useEffect, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, LineChart, Line
} from 'recharts'
import {
  TrendingUp, TrendingDown, Search, RefreshCw,
  Newspaper, ShieldAlert, Sparkles, BarChart2
} from 'lucide-react'

// ── helpers ───────────────────────────────────────────────────────────────────
const S = (obj) => obj                                 // plain style pass-through
const c = (color) => `var(${color})`                  // shorthand

const QUICK = ['RELIANCE','TCS','HDFCBANK','INFY','SBIN','MARUTI','ICICIBANK','TITAN','WIPRO','BAJFINANCE']
const INDICES = ['NIFTY 50','SENSEX','BANK NIFTY','INDIA VIX']

// ── Market strip ──────────────────────────────────────────────────────────────
function IndexCard({ item }) {
  const vix  = item.name === 'INDIA VIX'
  const up   = (item.change_pct ?? 0) >= 0
  const good = vix ? !up : up                     // VIX falling = good
  const clr  = item.price == null ? c('--text-3')
              : good ? c('--gain') : c('--loss')
  const spark = (item.sparkline || []).map(v => ({ v }))

  return (
    <div className="card fade-up" style={{ padding: '14px 16px', minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: c('--text-3'), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {item.name}
      </div>
      {item.price == null ? (
        <div style={{ height: 48, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '80%', height: 10, borderRadius: 5, background: c('--bg-hover'), animation: 'pulse 1.5s infinite' }} />
        </div>
      ) : (
        <>
          <div style={{ fontSize: 20, fontWeight: 700, color: c('--text-1'), fontVariantNumeric: 'tabular-nums' }}>
            {item.price.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: clr, display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {up && item.change_pct > 0 ? '+' : ''}{item.change_pct?.toFixed(2)}%
          </div>
          {spark.length > 2 && (
            <div style={{ height: 32, marginTop: 6 }}>
              <ResponsiveContainer width="100%" height={32}>
                <LineChart data={spark}>
                  <Line type="monotone" dataKey="v" stroke={clr} strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MarketStrip() {
  const [indices, setIndices] = useState(
    INDICES.map(name => ({ name, price: null, change_pct: null, sparkline: [] }))
  )
  useEffect(() => {
    fetch('/api/indices')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d) && d.length) setIndices(d) })
      .catch(() => {})
  }, [])
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {indices.map(item => <IndexCard key={item.name} item={item} />)}
    </div>
  )
}

// ── Price chart ───────────────────────────────────────────────────────────────
function PriceChart({ series, quote, company }) {
  const [tf, setTf] = useState('1M')
  const n   = { '1W':5, '1M':22, '3M':66, '6M':132 }[tf] ?? 22
  const data = (series || []).slice(-n).map(d => ({ ...d, label: (d.date || '').slice(5) }))
  const isUp = (quote?.change_pct ?? 0) >= 0

  return (
    <div className="card" style={{ padding: '20px', flex: 1, minWidth: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 12, color: c('--text-3'), marginBottom: 4 }}>{company} · NSE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: c('--text-1'), fontVariantNumeric: 'tabular-nums' }}>
              ₹{quote?.price?.toLocaleString('en-IN', { minimumFractionDigits: 2 }) ?? '—'}
            </span>
            {quote?.change_pct != null && (
              <span style={{ fontSize: 13, fontWeight: 600, color: isUp ? c('--gain') : c('--loss'), display: 'flex', alignItems: 'center', gap: 3 }}>
                {isUp ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}
                {isUp ? '+' : ''}{quote.change_pct}%
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['1W','1M','3M','6M'].map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: '5px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
              background: tf===t ? c('--accent-bg') : 'transparent',
              color:      tf===t ? c('--accent')    : c('--text-3'),
            }}>{t}</button>
          ))}
        </div>
      </div>
      {/* Chart */}
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 0, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={isUp ? c('--gain') : c('--loss')} stopOpacity={0.25}/>
                <stop offset="95%" stopColor={isUp ? c('--gain') : c('--loss')} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid stroke={c('--border')} vertical={false} strokeDasharray="3 3" />
            <XAxis dataKey="label" tick={{ fill: c('--text-3'), fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={25}/>
            <YAxis tick={{ fill: c('--text-3'), fontSize: 10 }} axisLine={false} tickLine={false} domain={['auto','auto']} width={55} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`}/>
            <Tooltip
              contentStyle={{ background: c('--bg-card'), border: `1px solid ${c('--border')}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: c('--text-3') }}
              formatter={v => [`₹${v?.toLocaleString('en-IN')}`, 'Close']}
            />
            <Area type="monotone" dataKey="close" stroke={isUp ? c('--gain') : c('--loss')} strokeWidth={2} fill="url(#cg)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── AI Insights panel ─────────────────────────────────────────────────────────
const CALL_COLOR = { BUY: '--gain', SELL: '--loss', HOLD: '--gold' }

function AIPanel({ data }) {
  const call = data?.call
  const tech = data?.technical
  const clr  = c(CALL_COLOR[call?.call] || '--text-3')

  return (
    <div className="card" style={{ padding: 20, width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: c('--text-1'), display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={15} color={c('--accent')} /> AI Insights
      </div>

      {/* Verdict */}
      {call && (
        <div style={{ textAlign: 'center', padding: '16px 0', borderRadius: 8, background: c('--bg-hover'), border: `1px solid ${c('--border')}` }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: clr, letterSpacing: '-1px' }}>{call.call}</div>
          <div style={{ fontSize: 11, color: c('--text-3'), marginTop: 4 }}>{call.confidence}% confidence</div>
        </div>
      )}

      {/* Stats row */}
      {tech && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {[
            ['RSI', tech.rsi_14, tech.rsi_14 > 70 ? '--loss' : tech.rsi_14 < 30 ? '--gain' : '--text-1'],
            ['SMA5',  tech.sma_5,  '--text-1'],
            ['SMA20', tech.sma_20, '--text-1'],
          ].map(([l, v, cv]) => (
            <div key={l} style={{ background: c('--bg-hover'), borderRadius: 6, padding: '8px 6px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c(cv), fontVariantNumeric: 'tabular-nums' }}>{v ?? '—'}</div>
              <div style={{ fontSize: 9, color: c('--text-3'), marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rationale */}
      {call?.rationale && (
        <div style={{ fontSize: 12, color: c('--text-2'), lineHeight: 1.6 }}>
          {call.rationale}
        </div>
      )}

      {/* Key risks */}
      {call?.key_risks?.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {call.key_risks.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: c('--text-3') }}>
              <ShieldAlert size={11} style={{ flexShrink: 0, marginTop: 2 }} color={c('--loss')} /> {r}
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      {call?.disclaimer && (
        <div style={{ fontSize: 10, color: c('--text-3'), lineHeight: 1.5, borderTop: `1px solid ${c('--border')}`, paddingTop: 10 }}>
          {call.disclaimer}
        </div>
      )}
    </div>
  )
}

// ── Stats row ─────────────────────────────────────────────────────────────────
function StatsRow({ stats }) {
  const items = [
    { label: '30D Min',  value: `₹${stats?.min}`,              ok: null },
    { label: '30D Max',  value: `₹${stats?.max}`,              ok: null },
    { label: '30D Avg',  value: `₹${stats?.average}`,          ok: null },
    { label: 'Std Dev',  value: `₹${stats?.std_dev}`,          ok: null },
    { label: 'Change',   value: `${stats?.period_change_pct}%`, ok: (stats?.period_change_pct ?? 0) >= 0 },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
      {items.map(item => (
        <div key={item.label} className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 10, color: c('--text-3'), textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>{item.label}</div>
          <div style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
            color: item.ok === null ? c('--text-1') : item.ok ? c('--gain') : c('--loss') }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── News feed ─────────────────────────────────────────────────────────────────
const SENT_COLOR = { positive:'--gain', negative:'--loss', neutral:'--text-3', mixed:'--gold', unknown:'--text-3' }

function NewsRow({ item }) {
  const clr = c(SENT_COLOR[item.sentiment] || '--text-3')
  return (
    <a href={item.link} target="_blank" rel="noopener noreferrer"
      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0',
        borderBottom: `1px solid ${c('--border')}`, textDecoration: 'none' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: c('--text-1'), marginBottom: 3, lineHeight: 1.4 }}>{item.title}</div>
        <div style={{ fontSize: 11, color: c('--text-3') }}>{item.source}{item.reason ? ` · ${item.reason}` : ''}</div>
      </div>
      <span style={{ flexShrink: 0, fontSize: 10, fontWeight: 700, color: clr, textTransform: 'uppercase',
        background: `${clr.replace('var(','').replace(')','-bg')}`, padding: '2px 8px', borderRadius: 20,
        border: `1px solid ${clr}` }}>
        {item.sentiment}
      </span>
    </a>
  )
}

function NewsSentiment({ news, sentiment }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: c('--text-1'), display: 'flex', alignItems: 'center', gap: 6 }}>
          <Newspaper size={14} color={c('--accent')} /> News & Sentiment
        </div>
        {sentiment?.overall_sentiment && (
          <span style={{ fontSize: 11, fontWeight: 700, color: c(SENT_COLOR[sentiment.overall_sentiment] || '--text-3'),
            textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {sentiment.overall_sentiment}
          </span>
        )}
      </div>
      {sentiment?.summary && (
        <div style={{ fontSize: 13, color: c('--text-2'), lineHeight: 1.6, marginBottom: 14,
          padding: 12, background: c('--bg-hover'), borderRadius: 6 }}>
          {sentiment.summary}
        </div>
      )}
      <div>
        {(news || []).slice(0, 6).map((item, i) => <NewsRow key={i} item={item} />)}
        {(!news || news.length === 0) && (
          <div style={{ textAlign: 'center', padding: 24, color: c('--text-3'), fontSize: 13 }}>No recent news found.</div>
        )}
      </div>
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function Dashboard({ data, loading, error, onSearch }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* 1. Market Indices */}
      <MarketStrip />

      {/* 2. Error (above empty state) */}
      {error && (
        <div style={{ padding: '12px 18px', background: c('--loss-bg'), border: `1px solid ${c('--loss')}`,
          borderRadius: 8, color: c('--loss'), fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* 3. Loading */}
      {loading && (
        <div className="card" style={{ padding: '36px 24px', textAlign: 'center', color: c('--text-3'), fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} />
          Pulling price data, news and asking AI for a read…
        </div>
      )}

      {/* 4. Empty state (always shown when no data, even after error) */}
      {!data && !loading && (
        <div className="card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <BarChart2 size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} color={c('--accent')} />
          <div style={{ fontSize: 18, fontWeight: 700, color: c('--text-1'), marginBottom: 8 }}>
            Search for any NSE stock to begin
          </div>
          <div style={{ fontSize: 13, color: c('--text-3'), marginBottom: 24 }}>
            Price analysis · AI buy/sell call · News sentiment · 30-day stats
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {QUICK.map(sym => (
              <button key={sym} onClick={() => onSearch(sym)} style={{
                padding: '7px 16px', background: c('--bg-hover'),
                border: `1px solid ${c('--border')}`, borderRadius: 20,
                fontSize: 12, fontWeight: 600, color: c('--text-2'),
                cursor: 'pointer', fontFamily: 'monospace',
              }}>{sym}</button>
            ))}
          </div>
        </div>
      )}

      {/* 5. Stock data */}
      {data && !loading && (
        <>
          {/* Chart + AI side by side */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 320 }}>
              <PriceChart series={data.price_series} quote={data.quote} company={data.company_name} />
            </div>
            <AIPanel data={data} />
          </div>

          {/* 30-day stats */}
          <StatsRow stats={data.stats} />

          {/* News */}
          <NewsSentiment news={data.news} sentiment={data.sentiment} />
        </>
      )}
    </div>
  )
}
