import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

function initializeTheme() {
  try {
    const stored = localStorage.getItem('harvi-theme-preference')
    const mode = (stored === 'light' || stored === 'dark' || stored === 'auto') ? stored : 'auto'
    
    let isDark = false
    
    if (mode === 'dark') {
      isDark = true
    } else if (mode === 'light') {
      isDark = false
    } else {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    
    document.documentElement.classList.toggle('dark', isDark)
  } catch {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  }
  
  document.documentElement.classList.add('theme-loaded')
}

initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)