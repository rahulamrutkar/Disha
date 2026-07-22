import { useState } from 'react'
import { Search } from 'lucide-react'

export default function SearchBar({ symbols, onSearch, loading }) {
  const [value, setValue] = useState('')

  function submit(e) {
    e.preventDefault()
    const sym = value.trim().toUpperCase()
    if (sym) onSearch(sym)
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xl gap-2">
      <div className="relative flex-1">
        <input
          list="symbol-suggestions"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter NSE symbol — e.g. RELIANCE, TCS, INFY"
          className="w-full rounded-sm border border-hairline bg-panel px-4 py-3 font-mono text-sm text-ink placeholder:text-muted focus:border-gold focus:outline-none"
        />
        <datalist id="symbol-suggestions">
          {symbols.map((s) => (
            <option key={s.symbol} value={s.symbol}>
              {s.name}
            </option>
          ))}
        </datalist>
      </div>
      <button
        type="submit"
        disabled={loading}
        className="flex items-center gap-2 rounded-sm bg-gold px-5 py-3 text-sm font-medium text-base transition hover:bg-goldsoft disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Search size={16} />
        {loading ? 'Reading the tape…' : 'Analyze'}
      </button>
    </form>
  )
}
