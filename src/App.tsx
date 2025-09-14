import React from 'react'
import { Header } from './components/Header'
import { MainContent } from './components/MainContent'
import { useTheme } from './hooks/useTheme'

function App() {
  const { mode, isDark, setTheme } = useTheme()

  return (
    <div className="min-h-screen bg-white dark:bg-black transition-colors duration-300">
      <Header themeMode={mode} onThemeChange={setTheme} />
      <MainContent />
    </div>
  )
}

export default App