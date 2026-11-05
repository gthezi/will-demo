import {
  CalendarOutlined, CheckSquareOutlined, EditOutlined, HomeOutlined,
  MoonOutlined, PlusOutlined, ReloadOutlined, SettingOutlined,
  SunOutlined, DesktopOutlined, ThunderboltOutlined, UserOutlined,
} from '@ant-design/icons'
import { Button, Dropdown, Tag, Tooltip } from 'antd'
import type { ReactNode } from 'react'
import { themeLabels, type ThemeMode } from '../theme'

const pageTitles = {
  home: '我的工作台', calendar: '日历安排', projects: '项目与待办', settings: '个人设置',
}
export type PageKey = keyof typeof pageTitles

type WillShellProps = {
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  activePage: PageKey
  onNavigate: (page: PageKey) => void
  onOpenAssistant: () => void
  onManualAdd: () => void
  onLoadDemo: () => void
  manualDisabled: boolean
  username: string
  hasDemo: boolean
  children: ReactNode
}

const navigation = [
  { key: 'home', icon: <HomeOutlined />, label: '首页' },
  { key: 'calendar', icon: <CalendarOutlined />, label: '日历' },
  { key: 'projects', icon: <CheckSquareOutlined />, label: '项目' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' },
] as const
const themeIcons = { light: <SunOutlined />, night: <MoonOutlined />, system: <DesktopOutlined /> }
const nextTheme: Record<ThemeMode, ThemeMode> = { night: 'system', system: 'light', light: 'night' }

export function WillShell({
  themeMode, onThemeChange, activePage, onNavigate, onOpenAssistant,
  onManualAdd, onLoadDemo, manualDisabled, username, hasDemo, children,
}: WillShellProps) {
  const storageLocation = navigator.userAgent.includes('Electron/') ? '当前客户端' : '当前浏览器'
  return (
    <div className="will-shell">
      <aside className="will-rail">
        <button className="will-brand-mark" aria-label="Will 首页" onClick={() => onNavigate('home')}>W.</button>
        <div className="will-rail-separator" />
        <nav aria-label="主导航">
          {navigation.map(item => (
            <button key={item.key} type="button" className={`will-nav-button${activePage === item.key ? ' is-active' : ''}`}
              aria-label={item.label} aria-current={activePage === item.key ? 'page' : undefined}
              onClick={() => onNavigate(item.key)}>
              {item.icon}<span>{item.label}</span>
            </button>
          ))}
        </nav>
        <Tooltip title="载入示例数据" placement="right">
          <button className="will-nav-button will-rail-bottom" aria-label="载入示例数据" onClick={onLoadDemo}>
            <ReloadOutlined /><span>示例</span>
          </button>
        </Tooltip>
      </aside>
      <div className="will-workspace">
        <header className="will-header">
          <div className="will-header-title">
            <span className="will-wordmark">WILL</span>
            <h1>{pageTitles[activePage]}</h1>
          </div>
          <div className="will-header-actions">
            {hasDemo && <Tag className="will-demo-tag" color="green">含示例数据</Tag>}
            <Button className="will-profile-button" icon={<UserOutlined />} onClick={() => onNavigate('settings')}>
              {username}
            </Button>
            <Dropdown trigger={['click']} placement="bottomRight"
              menu={{
                items: [
                  { key: 'assistant', icon: <ThunderboltOutlined />, label: 'AI 输入 / 文本解析' },
                  { key: 'manual', icon: <EditOutlined />, label: '手动添加日程或待办', disabled: manualDisabled },
                ],
                onClick: ({ key }) => key === 'manual' ? onManualAdd() : onOpenAssistant(),
              }}>
              <Button className="will-quick-add" type="primary" icon={<PlusOutlined />} aria-label="快速添加" title="快速添加">快速添加</Button>
            </Dropdown>
            <Tooltip title={`当前${themeLabels[themeMode]}，切换为${themeLabels[nextTheme[themeMode]]}`}>
              <Button className="will-theme-button" icon={themeIcons[themeMode]}
                aria-label={`切换主题，当前${themeLabels[themeMode]}`}
                onClick={() => onThemeChange(nextTheme[themeMode])}>
                <span>{themeLabels[themeMode]}</span>
              </Button>
            </Tooltip>
            <Button className="will-assistant-button" type="primary" icon={<ThunderboltOutlined />}
              aria-label="AI 助手" onClick={onOpenAssistant}><span>AI 助手</span></Button>
          </div>
        </header>
        <main className="will-content" id="main-content" key={activePage}>{children}</main>
        <footer className="will-statusbar"><span>Will · 个人安排助手</span><span>本地模拟 · 数据仅保存在{storageLocation}</span></footer>
      </div>
    </div>
  )
}
