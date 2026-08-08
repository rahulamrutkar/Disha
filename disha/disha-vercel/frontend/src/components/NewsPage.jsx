import NewsFeed from './NewsFeed.jsx'
import { Newspaper } from 'lucide-react'

export default function NewsPage({ data }) {
  if (!data) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-3)' }}>
      <Newspaper size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>No stock selected</div>
      <div style={{ fontSize: 13 }}>Search for a stock from the top bar to see news and sentiment analysis.</div>
    </div>
  )
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16 }}>
        News & Sentiment — {data.company_name}
      </h2>
      <NewsFeed news={data.news} sentiment={data.sentiment} />
    </div>
  )
}
