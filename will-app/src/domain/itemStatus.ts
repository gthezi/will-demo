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

export type DeadlineUrgency = 'none' | 'upcoming' | 'today' | 'overdue'

export function isOverdue(item: DisplayItem, now: Date) {
  return item.kind === 'task' && !item.done
    && !!item.date && (item.time ? dayjs(`${item.date}T${item.time}`).isBefore(now) : item.date < dayjs(now).format('YYYY-MM-DD'))
}

export function deadlineUrgency(item: DisplayItem, now: Date): DeadlineUrgency {
  if (item.kind !== 'task' || item.done || !item.date) return 'none'
  if (isOverdue(item, now)) return 'overdue'
  return item.date === dayjs(now).format('YYYY-MM-DD') ? 'today' : 'upcoming'
}

export function itemStatus(item: DisplayItem, now: Date): ItemStatus {
  if (item.kind === 'event') return 'event'
  if (item.done) return 'done'
  if (isOverdue(item, now)) return 'overdue'
  if (item.taskStatus === 'in_progress') return 'in_progress'
  return item.date === dayjs(now).format('YYYY-MM-DD') ? 'today' : 'task'
}

export function itemStatusTags(item: DisplayItem, now: Date): ItemStatus[] {
  const primary = itemStatus(item, now)
  const statuses = [primary]
  if (item.kind === 'task' && !item.done && item.taskStatus === 'in_progress' && primary !== 'in_progress') statuses.push('in_progress')
  if (deadlineUrgency(item, now) === 'today' && primary !== 'today') statuses.push('today')
  return statuses
}
