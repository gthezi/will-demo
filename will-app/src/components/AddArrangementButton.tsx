import { EditOutlined, PlusOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'

type AddArrangementButtonProps = {
  onManual: () => void
  onAssistant: () => void
  manualDisabled?: boolean
}

export function AddArrangementButton({ onManual, onAssistant, manualDisabled = false }: AddArrangementButtonProps) {
  return (
    <Dropdown
      trigger={['click']}
      menu={{
        items: [
          { key: 'manual', icon: <EditOutlined />, label: '手动添加', disabled: manualDisabled },
          { key: 'assistant', icon: <ThunderboltOutlined />, label: 'AI 整理' },
        ],
        onClick: ({ key }) => {
          if (key === 'manual') onManual()
          if (key === 'assistant') onAssistant()
        },
      }}
    >
      <Button icon={<PlusOutlined />} aria-label="添加安排">添加安排</Button>
    </Dropdown>
  )
}
