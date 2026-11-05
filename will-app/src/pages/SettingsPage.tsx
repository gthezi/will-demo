import { DeleteOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons'
import { App, Button, Form, Input } from 'antd'
import type { ThemeMode } from '../theme'
import { ThemeSwitcher } from '../components/ThemeSwitcher'

type SettingsPageProps = {
  username: string
  onSaveName: (name: string) => boolean
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  onLoadDemo: () => void
  onClear: () => void
}

export function SettingsPage({ username, onSaveName, themeMode, onThemeChange, onLoadDemo, onClear }: SettingsPageProps) {
  const { message } = App.useApp()
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
        <ThemeSwitcher value={themeMode} onChange={onThemeChange} />
      </section>
      <section className="will-settings-section">
        <h2>本地数据</h2>
        <p>安排保存在当前浏览器，不会同步到其他设备。示例数据会替换当前安排与项目。</p>
        <div className="will-settings-actions">
          <Button icon={<ReloadOutlined />} aria-label="载入示例数据" onClick={onLoadDemo}>载入示例数据</Button>
          <Button danger icon={<DeleteOutlined />} aria-label="清空安排" onClick={onClear}>清空安排</Button>
        </div>
      </section>
    </div>
  )
}
