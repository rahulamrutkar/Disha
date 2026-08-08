import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Bot } from 'lucide-react'

const SUGGESTIONS = [
  'What is the outlook for Indian IT stocks?',
  'Explain what RSI means for a stock',
  'How do I read a P/E ratio?',
  'What is Bank Nifty?',
]

export default function CopilotPage({ currentSymbol, data }) {
  const [messages, setMessages] = useState([{
    role: 'bot',
    text: "Hi! I'm Disha AI, your Indian stock market assistant. Ask me anything about stocks, markets, or investing.",
  }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function send(text) {
    const msg = text || input.trim()
    if (!msg) return
    setInput('')
    setMessages(m => [...m, { role: 'user', text: msg }])
    setLoading(true)
    try {
      const context = currentSymbol ? `${currentSymbol} — ${data?.company_name || ''}` : ''
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, context }),
      })
      const d = await res.json()
      setMessages(m => [...m, { role: 'bot', text: d.response, disclaimer: d.disclaimer }])
    } catch {
      setMessages(m => [...m, { role: 'bot', text: 'Sorry, I ran into an error. Please try again.' }])
    } finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, background: 'var(--accent-bg)', border: '1px solid var(--accent)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={18} color="var(--accent)" />
        </div>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>AI Copilot</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Powered by Gemini · Indian markets specialist</div>
        </div>
      </div>

      {/* Messages */}
      <div className="card" style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: m.role === 'user' ? 'row-reverse' : 'row' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: m.role === 'user' ? '#fff' : 'var(--accent)' }}>
              {m.role === 'user' ? 'U' : <Bot size={15} />}
            </div>
            <div style={{ maxWidth: '80%' }}>
              <div style={{ padding: '10px 14px', background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-hover)', borderRadius: m.role === 'user' ? '12px 4px 12px 12px' : '4px 12px 12px 12px', fontSize: 13, color: m.role === 'user' ? '#fff' : 'var(--text-1)', lineHeight: 1.6 }}>
                {m.text}
              </div>
              {m.disclaimer && <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4, paddingLeft: 4 }}>{m.disclaimer}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Bot size={15} color="var(--accent)" /></div>
            <div style={{ padding: '10px 14px', background: 'var(--bg-hover)', borderRadius: '4px 12px 12px 12px', fontSize: 13, color: 'var(--text-3)' }}>Thinking…</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        {SUGGESTIONS.map(s => (
          <button key={s} onClick={() => send(s)}
            style={{ padding: '5px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {s}
          </button>
        ))}
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !loading && send()}
          placeholder="Ask me anything about Indian stocks and markets…"
          style={{ flex: 1, padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, color: 'var(--text-1)', outline: 'none' }}
        />
        <button onClick={() => send()} disabled={loading || !input.trim()}
          style={{ padding: '12px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13, opacity: (loading || !input.trim()) ? 0.5 : 1 }}>
          <Send size={15} /> Send
        </button>
      </div>
    </div>
  )
}
