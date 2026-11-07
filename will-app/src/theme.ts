import { theme as antdTheme } from 'antd'
import type { ThemeConfig } from 'antd'

export type ThemeMode = 'light' | 'night' | 'system'
export type ResolvedTheme = 'light' | 'night'

export const THEME_STORAGE_KEY = 'will-react-theme-v01'

export const themeLabels: Record<ThemeMode, string> = {
  light: '日间',
  night: '夜间',
  system: '跟随系统',
}

const palettes = {
  night: {
    bg: '#181818',
    surface: '#2a2a2a',
    elevated: '#363636',
    sidebar: '#191c1d',
    selected: '#2c2e2f',
    text: '#dfdfdf',
    muted: '#c1c2c2',
    primary: '#74b8f1',
    border: '#424242',
    divider: '#2d3437',
    'summary-border': '#424242',
    'orbit-border': '#2d3437',
    'panel-shadow': '0 3px 12px #0000000b',
    success: '#72d4ae',
    warning: '#e3bb73',
    error: '#ed827e',
    soft: '#2a2a2a',
    'soft-subtle': '#191c1d',
    'error-soft': '#533639',
  },
  light: {
    bg: '#ffffff',
    surface: '#ffffff',
    elevated: '#ffffff',
    sidebar: '#f8fcfd',
    selected: '#ebf0f1',
    text: '#1a1c1f',
    muted: '#3b3e40',
    primary: '#2476a8',
    border: '#dbe5e7',
    divider: '#dbe5e7',
    'summary-border': '#dbe5e7',
    'orbit-border': '#dbe5e7',
    'panel-shadow': '0 3px 12px #00000005',
    success: '#287d64',
    warning: '#986b1e',
    error: '#bc5b5b',
    soft: '#f3f3f4',
    'soft-subtle': '#f8fcfd',
    'error-soft': '#f5e0e0',
  },
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'night' || value === 'system'
}

export function getInitialThemeMode(): ThemeMode {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY)
    if (isThemeMode(saved)) return saved
  } catch {
    // localStorage may be unavailable in a restricted browser context.
  }
  return 'night'
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'night' : 'light'
}

export function applyDocumentTheme(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement
  root.dataset.theme = resolvedTheme
  root.style.colorScheme = resolvedTheme === 'night' ? 'dark' : 'light'
  for (const [name, value] of Object.entries(palettes[resolvedTheme])) {
    root.style.setProperty(`--will-${name}`, value)
  }
}

export function getThemeConfig(resolvedTheme: ResolvedTheme): ThemeConfig {
  const isNight = resolvedTheme === 'night'
  const colors = palettes[resolvedTheme]

  return {
    algorithm: isNight ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: isNight ? '#358cd0' : colors.primary,
      colorInfo: colors.primary,
      colorBgLayout: colors.bg,
      colorBgContainer: colors.surface,
      colorBgElevated: colors.elevated,
      colorText: colors.text,
      colorTextSecondary: colors.muted,
      colorBorder: colors.border,
      colorBorderSecondary: colors.border,
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError: colors.error,
      borderRadius: 8,
      borderRadiusLG: 12,
      controlHeight: 38,
      fontFamily: 'Inter, "Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
    },
    components: {
      Input: {
        colorBgContainer: colors.elevated,
      },
      Layout: {
        bodyBg: colors.bg,
        siderBg: colors.sidebar,
        headerBg: colors.bg,
      },
      Menu: {
        itemBorderRadius: 6,
        itemHeight: 48,
        itemMarginBlock: 5,
      },
    },
  }
}
