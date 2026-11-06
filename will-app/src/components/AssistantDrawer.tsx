import { ArrowsAltOutlined } from '@ant-design/icons'
import { Button, Drawer } from 'antd'
import type { AIWorkspace } from '../hooks/useAIWorkspace'
import type { ScheduleData } from '../domain/schedule'
import { AIConversation } from './AIConversation'

type Props = {
  open: boolean; onClose: () => void; ai: AIWorkspace; data: ScheduleData
  onExpand: () => void; onViewCalendar: (date: string) => void; onViewProject: (id: string) => void
}
export function AssistantDrawer({ open, onClose, ai, data, onExpand, onViewCalendar, onViewProject }: Props) {
  return <Drawer title="AI 助手" open={open} onClose={() => { ai.cancel(); onClose() }}
    size={560} className="assistant-drawer" styles={{ wrapper: { maxWidth: '100vw' } }}
    extra={<Button icon={<ArrowsAltOutlined />} aria-label="在工作区展开" onClick={onExpand}>在工作区展开</Button>}>
    {open && <AIConversation ai={ai} data={data} compact onViewCalendar={onViewCalendar} onViewProject={onViewProject} />}
  </Drawer>
}
