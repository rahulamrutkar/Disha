const LABEL_STYLE = {
  bullish: 'text-gain',
  bearish: 'text-loss',
  neutral: 'text-gold',
}

export default function TechnicalCard({ technical }) {
  return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted">Technical Read</p>
        <span className={`text-xs uppercase tracking-wide ${LABEL_STYLE[technical.label] || 'text-muted'}`}>
          {technical.label}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="tabular text-lg text-ink">{technical.sma_5 ?? '—'}</p>
          <p className="text-[10px] uppercase text-muted">SMA-5</p>
        </div>
        <div>
          <p className="tabular text-lg text-ink">{technical.sma_20 ?? '—'}</p>
          <p className="text-[10px] uppercase text-muted">SMA-20</p>
        </div>
        <div>
          <p className="tabular text-lg text-ink">{technical.rsi_14 ?? '—'}</p>
          <p className="text-[10px] uppercase text-muted">RSI-14</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 text-xs text-muted">
        {technical.reasons.map((r, i) => (
          <li key={i}>· {r}</li>
        ))}
      </ul>
    </div>
  )
}
