import React, { useRef, useEffect, useState } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import type { ThemeMode } from '../types/theme'

interface ThemeToggleProps {
  currentMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
}

const themes: Array<{
  mode: ThemeMode
  icon: React.ComponentType<{ size?: number; className?: string }>
  label: string
}> = [
  { mode: 'auto', icon: Monitor, label: 'Авто' },
  { mode: 'light', icon: Sun, label: 'Светлая' },
  { mode: 'dark', icon: Moon, label: 'Тёмная' }
]
 
export function ThemeToggle({ currentMode, onThemeChange }: ThemeToggleProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = useState({ width: 0, left: 0 })
  
  const updateIndicator = () => {
    if (!containerRef.current) return
    
    const currentIndex = themes.findIndex(theme => theme.mode === currentMode)
    const buttons = containerRef.current.querySelectorAll('button')
    const activeButton = buttons[currentIndex]
    
    if (activeButton) {
      setIndicatorStyle({
        width: activeButton.offsetWidth,
        left: activeButton.offsetLeft
      })
    } 
  }
  
  useEffect(() => {
    const frame = requestAnimationFrame(updateIndicator)
    
    const handleResize = () => {
      requestAnimationFrame(updateIndicator)
    }
    
    window.addEventListener('resize', handleResize)
    
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', handleResize)
    }
  }, [currentMode])
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const currentIndex = themes.findIndex(theme => theme.mode === currentMode)
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      const nextIndex = (currentIndex + direction + themes.length) % themes.length
      onThemeChange(themes[nextIndex].mode)
    }
  }
  
  return (
    <div 
      ref={containerRef}
      className="relative flex items-center dark:bg-neutral-900/80 dark:backdrop-blur-sm dark:border dark:border-neutral-700/30 rounded-full p-1 dark:shadow-sm"
      role="radiogroup"
      aria-label="Выбор темы оформления"
      onKeyDown={handleKeyDown}
    >
      <div 
        className="absolute bg-white dark:bg-neutral-700 rounded-full shadow-sm border border-slate-300/40 dark:border-transparent transition-all duration-300 ease-out"
        style={{
          width: `${indicatorStyle.width}px`,
          height: '32px',
          left: `${indicatorStyle.left}px`
        }}
        aria-hidden="true"
      />
      
      {themes.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => onThemeChange(mode)}
          className="
            relative z-10 px-3 py-2 rounded-full text-xs font-medium transition-colors duration-200
            flex items-center gap-1.5 justify-center whitespace-nowrap min-w-0
            text-slate-700 dark:text-neutral-400
            data-[active=true]:text-slate-900 data-[active=true]:dark:text-white
            data-[active=false]:hover:text-slate-900 data-[active=false]:dark:hover:text-white
            disabled:opacity-50 disabled:cursor-not-allowed
          "
          data-active={currentMode === mode}
          aria-label={`Переключить на ${label.toLowerCase()} тему`}
          aria-pressed={currentMode === mode}
          role="radio"
          aria-checked={currentMode === mode}
          type="button"
        >
          <Icon size={14} aria-hidden="true" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}