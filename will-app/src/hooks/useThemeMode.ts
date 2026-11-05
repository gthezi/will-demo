import { useEffect, useLayoutEffect, useState } from 'react'
import {
  applyDocumentTheme,
  getInitialThemeMode,
  getSystemTheme,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
} from '../theme'

export function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)
  const resolvedTheme: ResolvedTheme = themeMode === 'system' ? systemTheme : themeMode

  useEffect(() => {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, themeMode)
    } catch {
      // Keep the preference in memory when localStorage is unavailable.
    }
  }, [themeMode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => setSystemTheme(getSystemTheme())
    media.addEventListener('change', handleChange)
    return () => media.removeEventListener('change', handleChange)
  }, [])

  useLayoutEffect(() => {
    applyDocumentTheme(resolvedTheme)
  }, [resolvedTheme])

  return { themeMode, resolvedTheme, setThemeMode }
}
