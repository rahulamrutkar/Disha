import { useState } from 'react'
import { LayoutDashboard, TrendingUp, Star, Briefcase, Brain, SlidersHorizontal, Newspaper, MessageSquare, Bell, Settings, ChevronLeft, ChevronRight, Compass } from 'lucide-react'

const NAV = [
  { id: 'dashboard',  label: 'Dashboard',       icon: LayoutDashboard },
  { id: 'market',     label: 'Market Overview',  icon: TrendingUp },
  { id: 'watchlist',  label: 'Watchlist',        icon: Star },
  { id: 'screener',   label: 'Stock Screener',   icon: SlidersHorizontal },
  { id: 'news',       label: 'News & Sentiment', icon: Newspaper },
  { id: 'copilot',    label: 'AI Copilot',       icon: MessageSquare, badge: 'AI' },
  { id: 'alerts',     label: 'Alerts',           icon: Bell },
  { id: 'settings',   label: 'Settings',         icon: Settings },
]

export default function Sidebar({ active, onNav }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      style={{
        width: collapsed ? 64 : 220,
        background: 'var(--bg-panel)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
        zIndex: 40, overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: collapsed ? '20px 0' : '20px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, background: 'var(--accent)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: collapsed ? '0 auto' : 0 }}>
          <Compass size={18} color="#fff" />
        </div>
        {!collapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)', lineHeight: 1 }}>Disha</div>
            <div style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>AI Share Analysis</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 8px', overflowY: 'auto' }}>
        {NAV.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNav(item.id)}
              title={collapsed ? item.label : undefined}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 6, border: 'none', cursor: 'pointer',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: isActive ? 'var(--accent-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-2)',
                marginBottom: 2, transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-1)' }}
              onMouseLeave={e => { e.currentTarget.style.background = isActive ? 'var(--accent-bg)' : 'transparent'; e.currentTarget.style.color = isActive ? 'var(--accent)' : 'var(--text-2)' }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>
                  {item.label}
                </span>
              )}
              {!collapsed && item.badge && (
                <span style={{ fontSize: 9, background: 'var(--accent)', color: '#fff', borderRadius: 4, padding: '1px 5px', fontWeight: 700, letterSpacing: '0.05em' }}>
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        style={{
          margin: 8, padding: '8px', border: '1px solid var(--border)', borderRadius: 6,
          background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        {!collapsed && <span style={{ fontSize: 12, marginLeft: 6, color: 'var(--text-3)' }}>Collapse</span>}
      </button>
    </aside>
  )
}
