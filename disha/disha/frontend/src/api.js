const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function fetchSymbols() {
  const res = await fetch(`${API_BASE}/api/symbols`)
  if (!res.ok) throw new Error('Could not load symbol list')
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

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`)
  if (!res.ok) throw new Error('Backend not reachable')
  return res.json()
}
