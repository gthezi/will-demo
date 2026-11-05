import { DesktopOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Segmented, Tooltip } from 'antd'
import { isThemeMode, themeLabels, type ThemeMode } from '../theme'

type ThemeSwitcherProps = {
  value: ThemeMode
  onChange: (mode: ThemeMode) => void
  compact?: boolean
}

const themeIcons = {
  light: <SunOutlined />,
  night: <MoonOutlined />,
  system: <DesktopOutlined />,
}

export function ThemeSwitcher({ value, onChange, compact = false }: ThemeSwitcherProps) {
  return (
    <Segmented
      aria-label="显示主题"
      value={value}
      options={(['light', 'night', 'system'] as const).map((mode) => ({
        value: mode,
        label: (
          <Tooltip title={compact ? themeLabels[mode] : undefined}>
            <span className="theme-option" aria-label={themeLabels[mode]}>
              {themeIcons[mode]}
              {!compact && themeLabels[mode]}
            </span>
          </Tooltip>
        ),
      }))}
      onChange={(mode) => {
        if (isThemeMode(mode)) onChange(mode)
      }}
    />
  )
}
