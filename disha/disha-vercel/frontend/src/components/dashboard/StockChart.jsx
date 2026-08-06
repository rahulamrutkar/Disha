import { useState, useEffect } from 'react'
import { ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, Rectangle, Bar, Line, ReferenceLine } from 'recharts'

const INTERVALS = ['1D', '1W', '1M', '3M', '6M', '1Y']

function CandlestickBar(props) {
  const { x, y, width, payload } = props
  if (!payload) return null
  const { open, close, high, low } = payload
  const isUp = close >= open
  const color = isUp ? '#2ea043' : '#f85149'
  const barW = Math.max(width - 2, 2)
  const xMid = x + width / 2

  // Price range for the chart
  const priceRange = props.yMax - props.yMin
  if (!priceRange) return null
  const chartHeight = props.chartHeight || 280

  const toY = (price) => props.yOffset + (props.yMax - price) / priceRange * chartHeight

  const bodyTop    = Math.min(toY(open), toY(close))
  const bodyBottom = Math.max(toY(open), toY(close))
  const bodyH      = Math.max(bodyBottom - bodyTop, 1)
  const highY      = toY(high)
  const lowY       = toY(low)

  return (
    <g>
      {/* wick */}
      <line x1={xMid} y1={highY} x2={xMid} y2={lowY} stroke={color} strokeWidth={1} />
      {/* body */}
      <rect x={xMid - barW / 2} y={bodyTop} width={barW} height={bodyH} fill={color} fillOpacity={0.9} />
    </g>
  )
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const up = d.close >= d.open
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ color: 'var(--text-3)', marginBottom: 6 }}>{d.time}</div>
      {['O','H','L','C'].map(k => {
        const val = { O: d.open, H: d.high, L: d.low, C: d.close }[k]
        return <div key={k} style={{ display: 'flex', gap: 12, justifyContent: 'space-between', color: k === 'C' ? (up ? 'var(--gain)' : 'var(--loss)') : 'var(--text-1)' }}>
          <span style={{ color: 'var(--text-3)' }}>{k}</span>
          <span>₹{val?.toLocaleString('en-IN')}</span>
        </div>
      })}
    </div>
  )
}

export default function StockChart({ symbol, data, priceSeries }) {
  const [interval, setInterval] = useState('1D')
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(false)

  // Intraday for 1D, else daily close series
  useEffect(() => {
    if (!symbol) return
    if (interval === '1D') {
      setLoading(true)
      fetch(`/api/intraday/${symbol}`)
        .then(r => r.json())
        .then(d => setCandles(d.candles || []))
        .catch(() => setCandles([]))
        .finally(() => setLoading(false))
    } else {
      // Use daily series filtered by interval
      const days = { '1W': 7, '1M': 30, '3M': 90, '6M': 180, '1Y': 365 }[interval] || 30
      const filtered = (priceSeries || []).slice(-days)
      setCandles(filtered.map(d => ({
        time: d.date?.slice(5),
        open: d.close,
        high: d.high || d.close,
        low: d.low || d.close,
        close: d.close,
      })))
    }
  }, [symbol, interval, priceSeries])

  const prices = candles.map(c => [c.high, c.low]).flat().filter(Boolean)
  const yMin = prices.length ? Math.min(...prices) * 0.9985 : 0
  const yMax = prices.length ? Math.max(...prices) * 1.0015 : 100
  const latestPrice = candles[candles.length - 1]?.close
  const firstPrice  = candles[0]?.close
  const isUp = latestPrice >= firstPrice

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
          {latestPrice && (
            <>
              <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-1)', fontVariantNumeric: 'tabular-nums' }}>
                ₹{latestPrice.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </span>
              {firstPrice && (
                <span style={{ fontSize: 13, fontWeight: 600, color: isUp ? 'var(--gain)' : 'var(--loss)' }}>
                  {isUp ? '+' : ''}{((latestPrice - firstPrice) / firstPrice * 100).toFixed(2)}%
                </span>
              )}
            </>
          )}
        </div>
        {/* Interval selector */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-hover)', borderRadius: 6, padding: 3 }}>
          {INTERVALS.map(iv => (
            <button key={iv} onClick={() => setInterval(iv)}
              style={{ padding: '4px 10px', borderRadius: 4, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: interval === iv ? 'var(--accent)' : 'transparent',
                color: interval === iv ? '#fff' : 'var(--text-2)',
              }}>
              {iv}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 300, padding: '8px 0 0 0', position: 'relative' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Loading chart…
          </div>
        )}
        {!loading && candles.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={candles} margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={[yMin, yMax]} tick={{ fontSize: 10, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} width={60}
                tickFormatter={v => `₹${v >= 1000 ? (v/1000).toFixed(1)+'k' : v.toFixed(0)}`} />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-mid)', strokeWidth: 1, strokeDasharray: '3 3' }} />
              {latestPrice && <ReferenceLine y={latestPrice} stroke={isUp ? 'var(--gain)' : 'var(--loss)'} strokeDasharray="4 4" strokeWidth={1} />}
              <Bar dataKey="high"
                shape={(props) => {
                  const d = props.payload
                  const isUp = d.close >= d.open
                  const barW = Math.max((props.width || 6) - 2, 2)
                  const xMid = props.x + (props.width || 6) / 2
                  const yScale = v => props.background?.y + props.background?.height - (v - yMin) / (yMax - yMin) * props.background?.height
                  return (
                    <g key={props.index}>
                      <line x1={xMid} y1={yScale(d.high)} x2={xMid} y2={yScale(d.low)} stroke={isUp ? '#2ea043' : '#f85149'} strokeWidth={1} />
                      <rect x={xMid - barW / 2} y={Math.min(yScale(d.open), yScale(d.close))}
                        width={barW} height={Math.max(Math.abs(yScale(d.open) - yScale(d.close)), 1)}
                        fill={isUp ? '#2ea043' : '#f85149'} fillOpacity={0.9} />
                    </g>
                  )
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
        {!loading && candles.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-3)', fontSize: 13 }}>
            Select a stock to view chart
          </div>
        )}
      </div>
    </div>
  )
}
