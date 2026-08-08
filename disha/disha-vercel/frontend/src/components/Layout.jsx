import { useState } from 'react'
import { Compass, LayoutDashboard, BarChart2, SlidersHorizontal, Newspaper, Moon, Sun, Menu, X, ChevronRight } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext.jsx'

const NAV = [
  { id: 'dashboard', label: 'Dashboard',      icon: LayoutDashboard },
  { id: 'analyze',   label: 'Analyze Stock',  icon: BarChart2 },
  { id: 'screener',  label: 'Stock Screener', icon: SlidersHorizontal },
  { id: 'news',      label: 'News & Sentiment',icon: Newspaper },
]

export default function Layout({ page, setPage, children }) {
  const { theme, toggle } = useTheme()
  const [open, setOpen] = useState(false)

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
        transform: open ? 'translateX(0)' : undefined,
        transition: 'transform 0.2s',
      }}
      className={`hidden md:flex`}
      >
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Compass size={20} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.3px' }}>Disha</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>AI Share Analysis</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = page === id
            return (
              <button key={id} onClick={() => setPage(id)} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 8, marginBottom: 2, border: 'none', cursor: 'pointer',
                background: active ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: active ? 'var(--blue)' : 'var(--muted)',
                fontWeight: active ? 600 : 400, fontSize: 14, textAlign: 'left',
                transition: 'all 0.15s',
              }}>
                <Icon size={17} />
                {label}
                {active && <ChevronRight size={14} style={{ marginLeft: 'auto' }} />}
              </button>
            )
          })}
        </nav>

        {/* Theme toggle + footer */}
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <button onClick={toggle} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%',
            padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--surface2)', color: 'var(--text)', fontSize: 13,
            cursor: 'pointer', fontWeight: 500,
          }}>
            {theme === 'dark' ? <Sun size={16} color="var(--gold)" /> : <Moon size={16} color="var(--blue)" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60,
        background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Compass size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>Disha</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={toggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden" style={{
          position: 'fixed', inset: 0, zIndex: 55, background: 'rgba(0,0,0,0.5)',
        }} onClick={() => setOpen(false)}>
          <div style={{ width: 240, height: '100%', background: 'var(--surface)', borderRight: '1px solid var(--border)', padding: '60px 10px 20px' }} onClick={e => e.stopPropagation()}>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setPage(id); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '12px 14px', borderRadius: 8, marginBottom: 4, border: 'none',
                background: page === id ? 'rgba(59,130,246,0.12)' : 'transparent',
                color: page === id ? 'var(--blue)' : 'var(--muted)',
                fontSize: 14, cursor: 'pointer', textAlign: 'left',
              }}>
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={{ marginLeft: 220, flex: 1, minHeight: '100vh', background: 'var(--bg)' }}
            className="md:ml-[220px] ml-0 pt-[52px] md:pt-0">
        {children}
      </main>
    </div>
  )
}
