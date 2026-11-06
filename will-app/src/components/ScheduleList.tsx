import { CalendarOutlined } from '@ant-design/icons'
import { Checkbox, Empty, Tag, Tooltip } from 'antd'
import type { DisplayItem } from '../domain/schedule'
import { projectName, type Project } from '../domain/projects'
import { itemStatusTags, itemStatusLabels } from '../domain/itemStatus'
import { useLocalNow } from '../hooks/useLocalNow'

type ScheduleListProps = {
  items: DisplayItem[]
  onToggleTask: (id: string, done: boolean) => void
  onEdit: (id: string) => void
  emptyText?: string
  projects: Project[]
  onOpenProject?: (id: string) => void
  hideProject?: boolean
}

export function ScheduleList({ items, onToggleTask, onEdit, projects, onOpenProject, hideProject = false, emptyText = '还没有安排' }: ScheduleListProps) {
  const now = useLocalNow()
  if (!items.length) return <Empty className="will-empty" image={false} description={emptyText} />
  return (
    <ul className="will-schedule-list">
      {items.map(item => (
        <li key={item.id} className={`will-schedule-row${item.done ? ' is-done' : ''}`}>
          <div className="will-schedule-title">
            {item.kind === 'task' && (
              <Checkbox checked={item.done} aria-label={`${item.done ? '恢复' : '完成'}待办：${item.title}`} onChange={event => onToggleTask(item.id, event.target.checked)} />
            )}
            <Tooltip title="编辑事项">
              <button type="button" className="will-item-edit" aria-label={`编辑事项：${item.title}`} onClick={() => onEdit(item.id)}>
                {item.kind === 'event' && <CalendarOutlined />}
                <span>{item.title}</span>
              </button>
            </Tooltip>
            <span className="will-schedule-states">{itemStatusTags(item, now).map(status => <Tag key={status} className="will-item-status" data-status={status}>
              {itemStatusLabels[status]}
            </Tag>)}</span>
          </div>
          <div className="will-schedule-meta">
            <time dateTime={item.time ? `${item.date}T${item.time}` : item.date || undefined}>{item.date ? `${item.date} ${item.time || '日期截止'}` : '无截止日期'}</time>
            {!hideProject && (onOpenProject ? <button className="will-inline-link" onClick={() => onOpenProject(item.projectId)}>{projectName(projects, item.projectId)}</button> : <span>{projectName(projects, item.projectId)}</span>)}
            {item.kind === 'event' && <span>{item.duration} 分钟</span>}
            {!!item.remind && <span>提前 {item.remind} 分钟提醒（仅偏好）</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
