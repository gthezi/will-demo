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
    bg: '#171816',
    surface: '#1f211e',
    elevated: '#292c27',
    sidebar: '#1b1d19',
    text: '#ecece4',
    muted: '#b0b3a8',
    primary: '#91bfaa',
    border: '#454940',
    divider: '#34382f',
    'summary-border': '#566357',
    'orbit-border': '#91bfaa38',
    'panel-shadow': 'none',
    success: '#91bfaa',
    warning: '#ddba7c',
    error: '#ee937d',
    soft: '#2a3930',
    'soft-subtle': '#1b1d19',
    'error-soft': '#442a25',
  },
  light: {
    bg: '#f6f3ec',
    surface: '#fbfaf6',
    elevated: '#ffffff',
    sidebar: '#eeeee6',
    text: '#222720',
    muted: '#62685b',
    primary: '#2f5d50',
    border: '#c9cdc0',
    divider: '#dde0d5',
    'summary-border': '#acb9a7',
    'orbit-border': '#2f5d502b',
    'panel-shadow': 'none',
    success: '#2f6950',
    warning: '#88601e',
    error: '#b4442c',
    soft: '#e5ecdf',
    'soft-subtle': '#f0f1e9',
    'error-soft': '#f7e6df',
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
      colorPrimary: colors.primary,
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
      borderRadius: 4,
      borderRadiusLG: 8,
      controlHeight: 36,
      fontSize: 14,
      fontFamily: '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif',
      boxShadow: isNight ? '0 8px 24px #00000040' : '0 8px 24px #26322114',
      boxShadowSecondary: isNight ? '0 12px 36px #00000050' : '0 12px 36px #2632211f',
    },
    components: {
      Layout: {
        bodyBg: colors.bg,
        siderBg: colors.sidebar,
        headerBg: colors.bg,
      },
      Menu: {
        itemBorderRadius: 4,
        itemHeight: 40,
        itemMarginBlock: 3,
      },
      Button: {
        colorPrimary: colors.primary,
        colorPrimaryHover: isNight ? '#aed0bf' : '#3c705f',
        colorPrimaryActive: isNight ? '#7fa993' : '#234a3e',
        primaryColor: isNight ? '#18271f' : '#ffffff',
        primaryShadow: 'none',
        defaultShadow: 'none',
        fontWeight: 500,
      },
      Tag: { defaultBg: colors['soft-subtle'], defaultColor: colors.muted },
      Segmented: { trackBg: colors['soft-subtle'], itemSelectedBg: colors.surface },
      Drawer: { colorBgElevated: colors.surface, paddingLG: 20 },
      Modal: { contentBg: colors.surface, headerBg: colors.surface },
      Input: { activeShadow: `0 0 0 2px ${isNight ? '#91bfaa33' : '#2f5d5026'}` },
      Select: { optionSelectedBg: colors.soft, optionSelectedColor: colors.text },
      Progress: { defaultColor: colors.primary, remainingColor: colors.divider },
    },
  }
}
