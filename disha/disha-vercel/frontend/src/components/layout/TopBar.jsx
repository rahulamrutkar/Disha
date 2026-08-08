import { useState } from 'react'
import { Search, Sun, Moon, Bell } from 'lucide-react'
import { useTheme } from '../../contexts/ThemeContext.jsx'

const POPULAR = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN', 'MARUTI', 'WIPRO', 'TITAN', 'BAJFINANCE']

export default function TopBar({ onSearch, marketOpen }) {
  const { theme, toggle } = useTheme()
  const [q, setQ] = useState('')
  const [focused, setFocused] = useState(false)

  function submit(sym) {
    if (!sym.trim()) return
    onSearch(sym.trim().toUpperCase())
    setQ('')
    setFocused(false)
  }

  return (
    <header style={{
      height: 56, display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-panel)',
      position: 'sticky', top: 0, zIndex: 30,
    }}>
      {/* Search */}
      <div style={{ flex: 1, maxWidth: 480, position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; setFocused(true) }}
            onBlur={e => { e.target.style.borderColor = 'var(--border)'; setTimeout(() => setFocused(false), 150) }}
            onKeyDown={e => e.key === 'Enter' && submit(q)}
            placeholder="Search stocks, companies, indices…"
            style={{
              width: '100%', paddingLeft: 36, paddingRight: 40, paddingTop: 8, paddingBottom: 8,
              background: 'var(--bg-hover)', border: '1px solid var(--border)',
              borderRadius: 8, fontSize: 13, color: 'var(--text-1)', outline: 'none',
            }}
          />
          <kbd style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>↵</kbd>
        </div>
        {focused && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: 'var(--shadow)', overflow: 'hidden', zIndex: 50 }}>
            <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>Popular stocks</div>
            {POPULAR.map(sym => (
              <button key={sym} onMouseDown={() => submit(sym)}
                style={{ width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, color: 'var(--text-1)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{sym}</span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>NSE</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />

      {/* Market status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: marketOpen ? 'var(--gain)' : 'var(--loss)', boxShadow: marketOpen ? '0 0 6px var(--gain)' : 'none', display: 'inline-block' }} />
        <span style={{ color: marketOpen ? 'var(--gain)' : 'var(--text-3)', fontWeight: 600 }}>{marketOpen ? 'Market Open' : 'Market Closed'}</span>
        <span style={{ color: 'var(--text-3)' }}>IST</span>
      </div>

      {/* Notifications */}
      <button style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-2)', padding: 6 }}>
        <Bell size={18} />
        <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, background: 'var(--loss)', borderRadius: '50%', border: '1.5px solid var(--bg-panel)' }} />
      </button>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        {theme === 'dark' ? 'Light' : 'Dark'}
      </button>
    </header>
  )
}
