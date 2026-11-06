import { HistoryOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons'
import { Button, Drawer, Input, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { AIConversation } from '../components/AIConversation'
import type { AIWorkspace } from '../hooks/useAIWorkspace'
import type { ScheduleData } from '../domain/schedule'

type Props = { ai: AIWorkspace; data: ScheduleData; onSelect: (id: string) => void; onViewProject: (id: string) => void; onViewCalendar: (date: string) => void }
export function AIWorkspacePage({ ai, data, onSelect, onViewProject, onViewCalendar }: Props) {
  const [history, setHistory] = useState(false)
  return <div className="ai-workspace">
    <div className="ai-workspace-heading">
      <div className="ai-workspace-tools">
        <Tooltip title="历史会话"><Button icon={<HistoryOutlined />} aria-label="历史会话" onClick={() => setHistory(true)} /></Tooltip>
        <h2>{ai.active?.title || '新会话'}</h2>
      </div>
      <Button icon={<PlusOutlined />} aria-label="新会话" onClick={() => onSelect(ai.create())}>新会话</Button>
    </div>
    <AIConversation ai={ai} data={data} onViewProject={onViewProject} onViewCalendar={onViewCalendar} />
    <Drawer title="历史会话" placement="left" size={300} open={history} onClose={() => setHistory(false)} closeIcon={<CloseOutlined />}>
      {ai.active && <label className="ai-history-title">会话标题<Input aria-label="会话标题" defaultValue={ai.active.title} key={ai.active.id}
        onBlur={e => ai.rename(e.target.value)} onPressEnter={e => e.currentTarget.blur()} /></label>}
      <div className="ai-history">
        {!ai.state.conversations.length && <p>还没有历史会话</p>}
        {ai.state.conversations.map(c => <button className={c.id === ai.active?.id ? 'is-active' : ''} key={c.id} onClick={() => { onSelect(c.id); setHistory(false) }}>
          <strong>{c.title}</strong><span>{data.projects.find(p => p.id === c.contextProjectId)?.name || '全局会话'}</span>
          <span>{new Date(c.updatedAt).toLocaleString('zh-CN')}</span>
          {c.batches.some(b => ['pending', 'staged', 'confirming'].includes(b.status)) && <Tag>有待确认草案</Tag>}
        </button>)}
      </div>
    </Drawer>
  </div>
}
