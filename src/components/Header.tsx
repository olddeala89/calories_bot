import React from 'react'
import { Code } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import type { ThemeMode } from '../types/theme'

interface HeaderProps {
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
}

export function Header({ themeMode, onThemeChange }: HeaderProps) {
  return (
    <header className="w-full px-3 sm:px-4 pt-4 sm:pt-6 pb-4 sm:pb-6">
      <div className="container mx-auto rounded-full bg-slate-100/80 dark:bg-neutral-900/80 backdrop-blur-sm border border-slate-200/60 dark:border-neutral-700/60 shadow-sm">
        <nav className="px-4 sm:px-8 h-12 sm:h-16 flex items-center justify-between" role="navigation" aria-label="Основная навигация">
          <div className="flex items-center gap-2 sm:gap-3">
            <Code size={16} className="sm:w-5 sm:h-5 text-slate-600 dark:text-neutral-300" aria-hidden="true" />
            <span className="font-medium text-base sm:text-lg text-slate-900 dark:text-white">Шаблон UI</span>
          </div>
          
          <ThemeToggle currentMode={themeMode} onThemeChange={onThemeChange} />
        </nav>
      </div>
    </header>
  )
}
