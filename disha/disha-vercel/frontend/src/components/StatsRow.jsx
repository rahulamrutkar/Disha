export default function StatsRow({ stats }) {
  const items = [
    { label:'30-Day Min', value:`₹${stats.min}` },
    { label:'30-Day Max', value:`₹${stats.max}` },
    { label:'30-Day Avg', value:`₹${stats.average}` },
    { label:'Volatility (σ)', value:`₹${stats.std_dev}` },
    { label:'Period Change', value:`${stats.period_change_pct}%`, isPct:true },
  ]
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-hairline bg-hairline sm:grid-cols-5">
      {items.map(it => (
        <div key={it.label} className="bg-panel px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted">{it.label}</p>
          <p className={`tabular mt-1 text-xl ${it.isPct ? (stats.period_change_pct>=0?'text-gain':'text-loss') : 'text-ink'}`}>{it.value}</p>
        </div>
      ))}
    </div>
  )
}
