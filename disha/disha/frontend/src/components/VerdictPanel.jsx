import { ArrowUpRight, ArrowDownRight, ShieldAlert, Sparkles } from 'lucide-react'

const CALL_STYLES = {
  BUY: { bg: 'bg-gain/15', text: 'text-gain', border: 'border-gain/40', label: 'BUY' },
  SELL: { bg: 'bg-loss/15', text: 'text-loss', border: 'border-loss/40', label: 'SELL' },
  HOLD: { bg: 'bg-gold/15', text: 'text-gold', border: 'border-gold/40', label: 'HOLD' },
}

export default function VerdictPanel({ data }) {
  const { company_name, symbol, quote, call } = data
  const style = CALL_STYLES[call.call] || CALL_STYLES.HOLD
  const isUp = (quote.change ?? 0) >= 0

  return (
    <div className="rounded-sm border border-hairline bg-panel p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">{symbol}.NS · NSE</p>
          <h2 className="mt-1 font-display text-3xl text-ink">{company_name}</h2>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="tabular text-3xl text-ink">
              ₹{quote.price != null ? quote.price.toLocaleString('en-IN') : '—'}
            </span>
            {quote.change != null && (
              <span
                className={`tabular flex items-center gap-1 text-sm ${
                  isUp ? 'text-gain' : 'text-loss'
                }`}
              >
                {isUp ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                {Math.abs(quote.change)} ({Math.abs(quote.change_pct)}%)
              </span>
            )}
          </div>
        </div>

        <div className={`flex flex-col items-center justify-center rounded-sm border ${style.border} ${style.bg} px-8 py-4 text-center`}>
          <span className={`font-display text-4xl tracking-wide ${style.text}`}>{style.label}</span>
          <span className="mt-1 text-xs uppercase tracking-widest text-muted">
            {call.confidence}% confidence
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-hairline pt-5">
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="mt-0.5 shrink-0 text-gold" />
          <p className="text-sm leading-relaxed text-ink/90">{call.rationale}</p>
        </div>

        {call.key_risks?.length > 0 && (
          <div className="mt-4 flex items-start gap-2">
            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-loss" />
            <ul className="space-y-1 text-sm text-muted">
              {call.key_risks.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {!call.ai_available && (
          <p className="mt-3 text-xs text-muted">
            AI narrative unavailable — add a free <code className="text-goldsoft">GEMINI_API_KEY</code> to the backend to enable it.
          </p>
        )}

        <p className="mt-4 text-xs leading-relaxed text-muted/80">{call.disclaimer}</p>
      </div>
    </div>
  )
}
