import { useState, useEffect } from 'react'
import { Star, Trash2, TrendingUp, TrendingDown, Plus } from 'lucide-react'

const LS_KEY = 'disha-watchlist'

export default function WatchlistPage({ onAnalyze }) {
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') }
    catch { return ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN'] }
  })
  const [input, setInput] = useState('')

  function save(list) {
    setWatchlist(list)
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  }

  function add() {
    const sym = input.trim().toUpperCase()
    if (sym && !watchlist.includes(sym)) save([...watchlist, sym])
    setInput('')
  }

  function remove(sym) { save(watchlist.filter(s => s !== sym)) }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <Star size={20} color="var(--gold)" />
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>My Watchlist</h2>
      </div>

      {/* Add stock */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Add NSE symbol  e.g. WIPRO"
          style={{ flex: 1, padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, color: 'var(--text-1)', outline: 'none' }}
        />
        <button onClick={add} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={14} /> Add
        </button>
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {watchlist.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>
            Your watchlist is empty — add a stock above.
          </div>
        )}
        {watchlist.map(sym => (
          <div key={sym} className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{sym}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>NSE</div>
            </div>
            <button onClick={() => onAnalyze(sym)}
              style={{ padding: '6px 14px', background: 'var(--accent-bg)', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              Analyze
            </button>
            <button onClick={() => remove(sym)}
              style={{ padding: 6, background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer' }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
