import { Sparkles, ShieldAlert, Target, TrendingUp } from 'lucide-react'

function ScoreRing({ score, size = 80 }) {
  const r = 30
  const circ = 2 * Math.PI * r
  const pct  = Math.min(Math.max(score, 0), 100) / 100
  const dash  = pct * circ
  const color = score >= 65 ? 'var(--gain)' : score >= 40 ? 'var(--gold)' : 'var(--loss)'

  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx="40" cy="40" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 40 40)" />
      <text x="40" y="44" textAnchor="middle" fill={color} fontSize="16" fontWeight="700" fontFamily="JetBrains Mono, monospace">{score}</text>
    </svg>
  )
}

function MiniScore({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 700, color, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

export default function AIInsights({ data }) {
  if (!data) return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 300 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>AI Insights</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Analyze a stock to see AI insights
      </div>
    </div>
  )

  const { call, technical, sentiment } = data
  const callLabel = call?.call || 'HOLD'
  const conf = call?.confidence || 50
  const techLabel = technical?.label || 'neutral'
  const sentScore = Math.round(((sentiment?.sentiment_score || 0) + 1) / 2 * 100)
  const rsi = technical?.rsi_14

  const callColor = callLabel === 'BUY' ? 'var(--gain)' : callLabel === 'SELL' ? 'var(--loss)' : 'var(--gold)'
  const techColor = techLabel === 'bullish' ? 'var(--gain)' : techLabel === 'bearish' ? 'var(--loss)' : 'var(--gold)'
  const sentColor = sentScore >= 60 ? 'var(--gain)' : sentScore >= 40 ? 'var(--gold)' : 'var(--loss)'

  return (
    <div className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Sparkles size={15} color="var(--gold)" />
          AI Insights
        </div>
      </div>

      {/* Score ring + call */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ScoreRing score={conf} size={80} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: callColor, letterSpacing: '-0.5px' }}>{callLabel}</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>AI Recommendation</div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{conf}% confidence</div>
        </div>
      </div>

      {/* Sub scores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, background: 'var(--surface2)', borderRadius: 8, padding: '12px 8px' }}>
        <MiniScore label="Sentiment" value={`${sentScore}/100`} color={sentColor} />
        <MiniScore label="Technical" value={rsi != null ? rsi : '—'} color={techColor} />
        <MiniScore label="Signal" value={techLabel.charAt(0).toUpperCase() + techLabel.slice(1)} color={techColor} />
      </div>

      {/* Rationale */}
      {call?.rationale && (
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, background: 'var(--surface2)', borderRadius: 8, padding: '10px 12px' }}>
          {call.rationale}
        </div>
      )}

      {/* Key risks */}
      {call?.key_risks?.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--loss)', marginBottom: 6, fontWeight: 600 }}>
            <ShieldAlert size={12} /> Key Risks
          </div>
          {call.key_risks.map((r, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--muted)', padding: '2px 0' }}>· {r}</div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <div style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.7, lineHeight: 1.5 }}>
        Educational demo only. Not financial advice.
      </div>
    </div>
  )
}
