const SESSIONS = ['Morning (9:15-11:00)','Midday (11:00-13:00)','Afternoon (13:00-15:30)']
const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday']
function cellColor(val, maxAbs) {
  if (maxAbs === 0) return 'rgba(138,147,166,0.15)'
  const t = Math.min(Math.abs(val)/maxAbs,1)
  return val < 0 ? `rgba(63,182,139,${0.12+t*0.55})` : `rgba(212,165,55,${0.12+t*0.55})`
}
export default function TickerRhythm({ timing }) {
  if (!timing.available) return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <p className="text-xs uppercase tracking-wider text-muted">Ticker Rhythm</p>
      <p className="mt-3 text-sm text-muted">Not enough intraday history to find a day/time pattern.</p>
    </div>
  )
  const maxAbs = Math.max(...timing.grid.map(g => Math.abs(g.avg_rel_pct)), 0.01)
  const lookup = {}
  timing.grid.forEach(g => { lookup[`${g.weekday}|${g.session}`] = g })
  return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wider text-muted">Ticker Rhythm · last {timing.lookback_days} trading days</p>
        <div className="flex gap-3 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gain"/>cheaper</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold"/>pricier</span>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead><tr>
            <th className="p-1 text-left text-[10px] font-normal text-muted"> </th>
            {SESSIONS.map(s => <th key={s} className="p-1 text-left text-[10px] font-normal uppercase text-muted">{s.split(' ')[0]}</th>)}
          </tr></thead>
          <tbody>{WEEKDAYS.map(wd => (
            <tr key={wd}><td className="p-1 pr-3 text-xs text-ink/80">{wd.slice(0,3)}</td>
              {SESSIONS.map(s => {
                const cell = lookup[`${wd}|${s}`]
                const isBuy = timing.best_buy?.weekday===wd && timing.best_buy?.session===s
                const isSell = timing.best_sell?.weekday===wd && timing.best_sell?.session===s
                return (
                  <td key={s} className="p-1">
                    <div className={`tabular flex h-12 flex-col items-center justify-center rounded-sm text-[11px] ${isBuy||isSell?'ring-1 ring-ink/40':''}`}
                      style={{background: cell ? cellColor(cell.avg_rel_pct,maxAbs) : 'rgba(138,147,166,0.06)'}}>
                      {cell ? (<>
                        <span className="text-ink/90">{cell.avg_rel_pct>0?'+':''}{cell.avg_rel_pct}%</span>
                        {isBuy && <span className="text-[9px] text-gain">buy zone</span>}
                        {isSell && <span className="text-[9px] text-gold">sell zone</span>}
                      </>) : <span className="text-muted">–</span>}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-muted">Backward-looking pattern over a short window — not a forecast. Use as one input, not a schedule.</p>
    </div>
  )
}
