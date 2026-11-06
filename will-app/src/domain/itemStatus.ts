import dayjs from 'dayjs'
import type { DisplayItem } from './schedule.ts'

export const itemStatusLabels = {
  event: '日程',
  task: '待办',
  today: '今天截止',
  overdue: '逾期',
  done: '已完成',
  in_progress: '进行中',
} as const

export type ItemStatus = keyof typeof itemStatusLabels

export function isOverdue(item: DisplayItem, now: Date) {
  return item.kind === 'task' && !item.done
    && !!item.date && (item.time ? dayjs(`${item.date}T${item.time}`).isBefore(now) : item.date < dayjs(now).format('YYYY-MM-DD'))
}

export function itemStatus(item: DisplayItem, now: Date): ItemStatus {
  if (item.kind === 'event') return 'event'
  if (item.done) return 'done'
  if (isOverdue(item, now)) return 'overdue'
  if (item.taskStatus === 'in_progress') return 'in_progress'
  return item.date === dayjs(now).format('YYYY-MM-DD') ? 'today' : 'task'
}
