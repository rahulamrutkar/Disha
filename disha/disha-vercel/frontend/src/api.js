const API_BASE = ''

export async function fetchSymbols() {
  const res = await fetch(`${API_BASE}/api/symbols`)
  if (!res.ok) throw new Error('Could not load symbols')
  return res.json()
}

export async function fetchAnalysis(symbol) {
  const res = await fetch(`${API_BASE}/api/analyze/${encodeURIComponent(symbol)}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `Could not analyze ${symbol}`)
  }
  return res.json()
}

export async function fetchIntraday(symbol, interval = '5m') {
  const res = await fetch(`${API_BASE}/api/intraday/${encodeURIComponent(symbol)}?interval=${interval}`)
  if (!res.ok) return null
  return res.json()
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error('Backend not reachable')
  return res.json()
}
