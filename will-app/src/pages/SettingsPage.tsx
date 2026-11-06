import { DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { App, Button, Form, Input, Segmented } from 'antd'
import { UPCOMING_RANGE_OPTIONS, type UpcomingDays } from '../domain/dashboardPreferences'
import type { ThemeMode } from '../theme'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

type SettingsPageProps = {
  username: string
  onSaveName: (name: string) => boolean
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  upcomingDays: UpcomingDays
  onUpcomingDaysChange: (days: UpcomingDays) => void
  onLoadDemo: () => void
  onClear: () => void
}

export function SettingsPage({
  username, onSaveName, themeMode, onThemeChange, upcomingDays, onUpcomingDaysChange, onLoadDemo, onClear,
}: SettingsPageProps) {
  const { message } = App.useApp()
  const storageLocation = navigator.userAgent.includes('Electron/') ? '当前客户端' : '当前浏览器'
  return (
    <div className="will-settings">
      <section className="will-settings-section">
        <h2>基本信息</h2>
        <Form layout="vertical" initialValues={{ username }} onFinish={({ username: name }) => {
          const persisted = onSaveName(name.trim())
          if (persisted) void message.success('称呼已保存')
          else void message.warning('称呼仅在本次页面中保留')
        }}>
          <Form.Item name="username" label="显示名称" rules={[{ required: true, whitespace: true, message: '请输入显示名称' }, { max: 24, message: '显示名称最多 24 字' }]}>
            <Input maxLength={24} />
          </Form.Item>
          <Button type="primary" icon={<SaveOutlined />} htmlType="submit" aria-label="保存设置">保存设置</Button>
        </Form>
      </section>
      <section className="will-settings-section">
        <h2>显示主题</h2>
        <p>选择日间、夜间或跟随系统。更改后立即生效。</p>
        <ThemeSwitcher value={themeMode} onChange={onThemeChange} />
      </section>
      <section className="will-settings-section">
        <h2>近期截止范围</h2>
        <p>包含今天；逾期事项单独统计。修改后首页会立即更新。</p>
        <Segmented
          block
          aria-label="近期截止范围"
          value={upcomingDays}
          options={UPCOMING_RANGE_OPTIONS.map(days => ({ value: days, label: `${days} 天` }))}
          onChange={value => onUpcomingDaysChange(value as UpcomingDays)}
        />
      </section>
      <section className="will-settings-section">
        <h2>本地数据</h2>
        <p>安排与 AI 会话保存在{storageLocation}，不会同步到其他设备。</p>
        <p>示例数据会替换当前安排与项目。</p>
        <div className="will-settings-actions">
          <Button icon={<ReloadOutlined />} aria-label="载入示例数据" onClick={onLoadDemo}>载入示例数据</Button>
        </div>
        <div className="will-settings-danger">
          <h3>清空日程与待办</h3>
          <p>仅删除安排；项目、AI 会话与草案、显示名称和主题设置会保留。</p>
          <Button danger icon={<DeleteOutlined />} aria-label="清空安排" onClick={onClear}>清空安排</Button>
        </div>
      </section>
    </div>
  )
}
