import dayjs from 'dayjs'
import { scheduleItems, type DisplayItem, type ItemKind, type ScheduleData } from './schedule.ts'
import type { ProjectId } from './projects.ts'

export type DashboardFilters = {
  query: string
  projectId: ProjectId | null
  kind: ItemKind | 'all'
  status: 'all' | 'pending' | 'completed'
}

export const defaultDashboardFilters: DashboardFilters = {
  query: '', projectId: null, kind: 'all', status: 'all',
}

export function hasDashboardFilters(filters: DashboardFilters) {
  return !!filters.query.trim() || filters.projectId !== null || filters.kind !== 'all' || filters.status !== 'all'
}

export function isOverdue(item: DisplayItem, now: Date) {
  return item.kind === 'task' && !item.done
    && `${item.date} ${item.time}` < dayjs(now).format('YYYY-MM-DD HH:mm')
}

export function dashboardView(data: ScheduleData, filters: DashboardFilters, now: Date) {
  const items = scheduleItems(data)
  const today = dayjs(now).format('YYYY-MM-DD')
  const lastDay = dayjs(now).add(7, 'day').format('YYYY-MM-DD')
  const query = filters.query.trim().toLocaleLowerCase()
  return {
    hasFilters: hasDashboardFilters(filters),
    results: items.filter(item => (!query || item.title.toLocaleLowerCase().includes(query))
      && (filters.projectId === null || item.projectId === filters.projectId)
      && (filters.kind === 'all' || item.kind === filters.kind)
      && (filters.status === 'all' || (item.kind === 'task'
        && (filters.status === 'completed' ? !!item.done : !item.done)))),
    groups: {
      overdue: items.filter(item => isOverdue(item, now)),
      today: items.filter(item => item.date === today && !isOverdue(item, now)),
      upcoming: items.filter(item => item.kind === 'task' && !item.done && item.date > today && item.date <= lastDay),
    },
  }
}
