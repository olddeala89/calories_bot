export type ThemeMode = 'auto' | 'light' | 'dark'

export interface ThemeState {
  mode: ThemeMode
  isDark: boolean
}