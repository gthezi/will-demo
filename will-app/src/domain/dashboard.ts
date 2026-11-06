import dayjs from 'dayjs'
import { allScheduleItems, type ItemKind, type ScheduleData } from './schedule.ts'
import type { ProjectId } from './projects.ts'
import { DEFAULT_UPCOMING_DAYS, isUpcomingDays } from './dashboardPreferences.ts'
import { isOverdue } from './itemStatus.ts'

export { isOverdue } from './itemStatus.ts'

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

export function deadlineView(data: ScheduleData, now: Date, days = DEFAULT_UPCOMING_DAYS) {
  const range = isUpcomingDays(days) ? days : DEFAULT_UPCOMING_DAYS
  const today = dayjs(now).format('YYYY-MM-DD')
  const lastDay = dayjs(now).add(range - 1, 'day').format('YYYY-MM-DD')
  const pending = allScheduleItems(data).filter(item => item.kind === 'task' && !item.done && !!item.date)
  // Cutoffs use local wall time; the window uses inclusive local calendar dates.
  const overdue = pending.filter(item => isOverdue(item, now))
  const overdueIds = new Set(overdue.map(item => item.id))
  return {
    overdue,
    upcoming: pending.filter(item => !overdueIds.has(item.id) && item.date >= today && item.date <= lastDay),
  }
}

export function dashboardView(data: ScheduleData, filters: DashboardFilters, now: Date) {
  const items = allScheduleItems(data)
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
