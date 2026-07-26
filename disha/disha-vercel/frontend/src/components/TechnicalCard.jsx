const L = { bullish:'text-gain', bearish:'text-loss', neutral:'text-gold' }
export default function TechnicalCard({ technical }) {
  return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted">Technical Read</p>
        <span className={`text-xs uppercase tracking-wide ${L[technical.label]||'text-muted'}`}>{technical.label}</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[['SMA-5',technical.sma_5],['SMA-20',technical.sma_20],['RSI-14',technical.rsi_14]].map(([l,v]) => (
          <div key={l}>
            <p className="tabular text-lg text-ink">{v ?? '—'}</p>
            <p className="text-[10px] uppercase text-muted">{l}</p>
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-1.5 text-xs text-muted">{technical.reasons.map((r,i) => <li key={i}>· {r}</li>)}</ul>
    </div>
  )
}
