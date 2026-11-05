import { CalendarOutlined } from '@ant-design/icons'
import { Checkbox, Empty, Tag, Tooltip } from 'antd'
import type { DisplayItem } from '../domain/schedule'
import { projectName, type Project } from '../domain/projects'

type ScheduleListProps = {
  items: DisplayItem[]
  onToggleTask: (id: string, done: boolean) => void
  onEdit: (id: string) => void
  emptyText?: string
  projects: Project[]
  overdueIds?: ReadonlySet<string>
}

export function ScheduleList({ items, onToggleTask, onEdit, projects, emptyText = '还没有安排', overdueIds }: ScheduleListProps) {
  if (!items.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />
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
            <Tag color={item.kind === 'event' ? 'blue' : item.done ? 'success' : overdueIds?.has(item.id) ? 'error' : 'gold'}>
              {item.kind === 'event' ? '日程' : item.done ? '已完成' : overdueIds?.has(item.id) ? '逾期' : '待办'}
            </Tag>
          </div>
          <div className="will-schedule-meta">
            <time dateTime={`${item.date}T${item.time}`}>{item.date} {item.time}</time>
            <span>{projectName(projects, item.projectId)}</span>
            {item.kind === 'event' && <span>{item.duration} 分钟</span>}
            {!!item.remind && <span>提前 {item.remind} 分钟提醒（仅偏好）</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}
