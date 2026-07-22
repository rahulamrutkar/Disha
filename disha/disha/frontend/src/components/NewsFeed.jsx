import { ExternalLink } from 'lucide-react'

const SENTIMENT_STYLE = {
  positive: 'text-gain border-gain/40 bg-gain/10',
  negative: 'text-loss border-loss/40 bg-loss/10',
  neutral: 'text-muted border-hairline bg-white/5',
  mixed: 'text-gold border-gold/40 bg-gold/10',
  unknown: 'text-muted border-hairline bg-white/5',
}

export default function NewsFeed({ news, sentiment }) {
  return (
    <div className="rounded-sm border border-hairline bg-panel p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-muted">Latest News & Sentiment</p>
        {sentiment.overall_sentiment && (
          <span
            className={`rounded-sm border px-2 py-0.5 text-[11px] uppercase tracking-wide ${
              SENTIMENT_STYLE[sentiment.overall_sentiment] || SENTIMENT_STYLE.unknown
            }`}
          >
            {sentiment.overall_sentiment}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink/90">{sentiment.summary}</p>

      {sentiment.key_events?.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {sentiment.key_events.map((e, i) => (
            <li key={i} className="rounded-sm border border-hairline bg-panel2 px-2 py-1 text-xs text-goldsoft">
              {e}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 divide-y divide-hairline border-t border-hairline">
        {news.length === 0 && <p className="py-4 text-sm text-muted">No recent headlines found.</p>}
        {news.map((item, i) => (
          <a
            key={i}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start justify-between gap-3 py-3 hover:bg-white/[0.02]"
          >
            <div className="min-w-0">
              <p className="text-sm text-ink/90 group-hover:text-ink">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {item.source}
                {item.reason ? ` · ${item.reason}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-[10px] uppercase ${
                  SENTIMENT_STYLE[item.sentiment] || SENTIMENT_STYLE.unknown
                }`}
              >
                {item.sentiment}
              </span>
              <ExternalLink size={12} className="text-muted opacity-0 transition group-hover:opacity-100" />
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
