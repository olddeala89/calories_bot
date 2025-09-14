import { useEffect, useState } from 'react'
import type { ThemeMode, ThemeState } from '../types/theme'

const THEME_STORAGE_KEY = 'harvi-theme-preference'

function getStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'auto'
  
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored
    }
  } catch (error) {
    console.warn('Failed to read theme preference from localStorage:', error)
  }
  return 'auto'
}

function getSystemPreference(): boolean {
  if (typeof window === 'undefined') return false
  
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
  } catch (error) {
    console.warn('Failed to read system color scheme preference:', error)
    return false
  }
}

function calculateIsDark(mode: ThemeMode): boolean {
  switch (mode) {
    case 'light':
      return false
    case 'dark':
      return true
    case 'auto':
      return getSystemPreference()
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (error) {
    console.warn('Failed to save theme preference to localStorage:', error)
  }
}

export function useTheme(): ThemeState & { setTheme: (mode: ThemeMode) => void } {
  const [mode, setMode] = useState<ThemeMode>(() => {
    const storedMode = getStoredTheme()
    const isDark = calculateIsDark(storedMode)
    
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark)
    }
    
    return storedMode
  })

  const [isDark, setIsDark] = useState(() => calculateIsDark(mode))

  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaQuery) return
    
    const handleSystemChange = () => {
      if (mode === 'auto') {
        const newIsDark = getSystemPreference()
        setIsDark(newIsDark)
        document.documentElement.classList.toggle('dark', newIsDark)
      }
    }
    
    try {
      mediaQuery.addEventListener('change', handleSystemChange)
      return () => mediaQuery.removeEventListener('change', handleSystemChange)
    } catch (error) {
      console.warn('Failed to set up system theme change listener:', error)
    }
  }, [mode])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', isDark)
    }
  }, [isDark])

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode)
    
    const newIsDark = calculateIsDark(newMode)
    setIsDark(newIsDark)
    
    safeSetLocalStorage(THEME_STORAGE_KEY, newMode)
  }

  return {
    mode,
    isDark,
    setTheme
  }
}