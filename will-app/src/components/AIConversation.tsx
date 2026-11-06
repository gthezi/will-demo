import { CalendarOutlined, CheckSquareOutlined, FileTextOutlined, PartitionOutlined, SendOutlined, StopOutlined, SaveOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, Select, Spin, Tag } from 'antd'
import type { AIWorkspace } from '../hooks/useAIWorkspace'
import type { ScheduleData } from '../domain/schedule'
import { shortcutPrompts } from '../services/aiService'
import { AIDraftReview } from './AIDraftReview'
import './AIWorkspace.css'

type Props = { ai: AIWorkspace; data: ScheduleData; compact?: boolean; onViewProject: (id: string) => void; onViewCalendar: (date: string) => void }
export function AIConversation({ ai, data, compact = false, onViewProject, onViewCalendar }: Props) {
  const c = ai.active
  const pending = c?.batches.filter(b => ['pending', 'staged', 'confirming'].includes(b.status)) ?? []
  const processing = !!ai.processingId
  const project = data.projects.find(p => p.id === c?.contextProjectId)
  return <div className={`ai-conversation${compact ? ' is-compact' : ''}${pending.length ? ' has-review' : ''}`}>
    <div className="ai-conversation-main">
      <div className="ai-context">
        <Tag color="gold">本地规则模拟</Tag>
        <Select aria-label="会话参考范围" value={c?.contextProjectId ?? ''} disabled={processing}
          options={[{ value: '', label: '全局 · 未关联项目' }, ...data.projects.map(p => ({ value: p.id, label: `参考：${p.name}${p.archived ? '（已归档）' : ''}`, disabled: p.archived }))]}
          onChange={id => {
            if (!c) ai.create(id || undefined)
            else ai.setContext(id || undefined)
          }} />
      </div>
      {project && <details className="ai-context-details"><summary>参考：{project.name}相关任务与日程</summary>
        <p>{data.tasks.filter(t => t.projectId === project.id).length} 项任务 · {data.events.filter(e => e.projectId === project.id).length} 项日程 · 仅本地记录</p>
        <p>范围更改用于后续消息；已有草案的目标项目保持原样。</p>
        <ul>{[...data.tasks, ...data.events].filter(t => t.projectId === project.id).slice(0, 8).map(t => <li key={t.id}>{t.title}</li>)}</ul>
      </details>}
      {ai.warning && <Alert type="warning" showIcon title={ai.warning} role="alert"
        action={<Button size="small" icon={<SaveOutlined />} onClick={ai.retrySave}>重试暂存</Button>} />}
      {ai.error && <Alert type="error" showIcon title={ai.error} role="alert" />}
      {ai.notice && <p role="status" className="ai-notice">{ai.notice}</p>}
      <div className="ai-messages" aria-label="对话消息" aria-live="polite">
        {!c?.messages.length && <div className="ai-empty">
          <h2>从一条通知，或一个目标开始</h2>
          <p>本地规则整理与固定步骤建议，确认后才会写入项目。</p>
          {!compact && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={false} />}
        </div>}
        {c?.messages.map(m => <article className={`ai-message is-${m.role}`} key={m.id}>
          <div className="ai-message-role">{m.role === 'user' ? '你' : 'Will · 本地模拟'}</div><p>{m.text}</p>
        </article>)}
        {c?.batches.filter(b => b.status === 'confirmed').map(b => <section className="ai-confirmed" key={b.id} data-batch-id={b.id}>
          <h3>已添加 {b.proposals.length} 项安排</h3><Tag color="green">已确认</Tag><p>同一批次不会重复添加。原始输入保留在会话中。</p>
          <div className="ai-confirmed-links">
            {[...new Set(b.proposals.map(p => p.projectId))].map(id => <Button key={id} icon={<CheckSquareOutlined />} aria-label={`查看项目：${data.projects.find(p => p.id === id)?.name || id}`} onClick={() => onViewProject(id)}>查看项目：{data.projects.find(p => p.id === id)?.name || id}</Button>)}
            {b.proposals.find(p => p.date) && <Button icon={<CalendarOutlined />} aria-label="查看日历" onClick={() => onViewCalendar(b.proposals.find(p => p.date)!.date)}>查看日历</Button>}
          </div>
        </section>)}
        {c?.batches.some(b => b.status === 'discarded') && <p className="ai-muted">已取消的草案保留原始对话，未写入安排。</p>}
      </div>
      <div className="ai-composer">
        <div className="ai-shortcuts">
          <Button icon={<FileTextOutlined />} aria-label="整理通知" disabled={processing} onClick={() => ai.setInput(shortcutPrompts.notice)}>整理通知</Button>
          <Button icon={<PartitionOutlined />} aria-label="拆解任务" disabled={processing} onClick={() => ai.setInput(shortcutPrompts.breakdown)}>拆解任务</Button>
        </div>
        <Input.TextArea aria-label="输入安排" placeholder="输入目标、粘贴通知，或继续提问…"
          value={c?.input ?? ''} onChange={e => ai.setInput(e.target.value)} maxLength={2000}
          autoSize={{ minRows: 3, maxRows: 8 }} disabled={processing}
          onKeyDown={e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); void ai.send() }
          }} />
        <div className="ai-composer-actions">
          <span>{ai.warning ? '尚未保存到本机' : '会话与编辑自动暂存到本机'}</span>
          {processing ? <Button icon={<StopOutlined />} aria-label="停止生成" onClick={ai.cancel}>停止生成</Button>
            : <Button type="primary" icon={<SendOutlined />} aria-label="生成草案" disabled={!c?.input.trim()} onClick={() => void ai.send()}>发送</Button>}
        </div>
        {processing && <div role="status" className="assistant-loading"><Spin size="small" />正在整理…</div>}
      </div>
    </div>
    {pending.length > 0 && <aside className="ai-review" aria-label="结果审阅">
      {pending.map(b => <AIDraftReview key={b.id} batch={b} projects={data.projects} ai={ai} />)}
    </aside>}
  </div>
}
