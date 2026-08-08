import { createContext, useContext, useEffect, useState } from 'react'

const Ctx = createContext({})

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('disha-theme') || 'dark')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'light') root.classList.add('light')
    else root.classList.remove('light')
    localStorage.setItem('disha-theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  return <Ctx.Provider value={{ theme, toggle }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
