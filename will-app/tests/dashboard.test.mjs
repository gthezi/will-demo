import assert from 'node:assert/strict'
import { test } from 'node:test'
import { dashboardView, defaultDashboardFilters, hasDashboardFilters, isOverdue } from '../src/domain/dashboard.ts'
import { addDrafts, emptySchedule, scheduleItems } from '../src/domain/schedule.ts'
import { setProjectArchived } from '../src/domain/projects.ts'

const now = new Date(2026, 10, 4, 10, 0)
const draft = (id, overrides = {}) => ({
  id, kind: 'task', title: id, date: '2026-11-04', time: '17:00',
  projectId: 'will', duration: 60, remind: 0, ...overrides,
})
const data = () => {
  const result = addDrafts(emptySchedule(), [
    draft('old', { date: '2026-11-02' }),
    draft('elapsed', { time: '09:59' }),
    draft('minute', { time: '10:00' }),
    draft('later'),
    draft('done-today'),
    draft('done-past', { date: '2026-11-02' }),
    draft('event-past-time', { kind: 'event', time: '09:00' }),
    draft('old-event', { kind: 'event', date: '2026-11-03' }),
    draft('tomorrow', { date: '2026-11-05', time: '00:00', projectId: 'course' }),
    draft('seventh', { date: '2026-11-11', time: '23:59' }),
    draft('eighth', { date: '2026-11-12', time: '00:00' }),
    draft('done-future', { date: '2026-11-05' }),
    draft('future-event', { date: '2026-11-05', kind: 'event' }),
  ])
  result.tasks.filter(item => item.id.startsWith('done-')).forEach(item => { item.done = true })
  return result
}
const ids = items => items.map(item => item.id)

test('overdue means unfinished tasks strictly before the current instant, including the same minute', () => {
  const view = dashboardView(data(), defaultDashboardFilters, now)
  assert.deepEqual(ids(view.groups.overdue), ['old', 'elapsed'])
  const minute = scheduleItems(data()).find(item => item.id === 'minute')
  assert.equal(isOverdue(minute, new Date(2026, 10, 4, 10, 0)), false)
  assert.equal(isOverdue(minute, new Date(2026, 10, 4, 10, 0, 1)), true)
  assert.equal(isOverdue(minute, new Date(2026, 10, 4, 10, 0, 59)), true)
  assert.equal(isOverdue(minute, new Date(2026, 10, 4, 10, 1)), true)
})

test('today retains past-time events and completed tasks, without duplicating overdue tasks', () => {
  const { groups } = dashboardView(data(), defaultDashboardFilters, now)
  assert.deepEqual(ids(groups.today), ['event-past-time', 'minute', 'later', 'done-today'])
  const all = Object.values(groups).flat()
  assert.equal(new Set(ids(all)).size, all.length)
})

test('upcoming includes tomorrow through the seventh whole calendar day, excluding completed tasks and events', () => {
  const { groups } = dashboardView(data(), defaultDashboardFilters, now)
  assert.deepEqual(ids(groups.upcoming), ['tomorrow', 'seventh'])
})

test('the upcoming window crosses year end and leap day using calendar dates', () => {
  const yearEnd = addDrafts(emptySchedule(), [
    draft('last', { date: '2027-01-03', time: '23:59' }),
    draft('outside', { date: '2027-01-04', time: '00:00' }),
  ])
  assert.deepEqual(ids(dashboardView(yearEnd, defaultDashboardFilters, new Date(2026, 11, 27, 23, 59)).groups.upcoming), ['last'])
  const leap = addDrafts(emptySchedule(), [
    draft('leap', { date: '2028-02-29' }), draft('march', { date: '2028-03-06' }),
  ])
  assert.deepEqual(ids(dashboardView(leap, defaultDashboardFilters, new Date(2028, 1, 28, 10)).groups.upcoming), ['leap', 'march'])
})

test('title search ignores surrounding whitespace and case and covers every date', () => {
  const original = data()
  original.tasks.find(item => item.id === 'eighth').title = 'Reading React Notes'
  const view = dashboardView(original, { ...defaultDashboardFilters, query: '  REACT  ' }, now)
  assert.equal(view.hasFilters, true)
  assert.deepEqual(ids(view.results), ['eighth'])
  assert.equal(dashboardView(original, { ...defaultDashboardFilters, query: '不存在' }, now).results.length, 0)
})

test('project, kind, status and title filters combine rather than overriding each other', () => {
  const filters = { query: 'tom', projectId: 'course', kind: 'task', status: 'pending' }
  assert.deepEqual(ids(dashboardView(data(), filters, now).results), ['tomorrow'])
  assert.equal(dashboardView(data(), { ...filters, kind: 'event' }, now).results.length, 0)
  assert.equal(dashboardView(data(), { ...filters, status: 'completed' }, now).results.length, 0)
})

test('completion filters apply only to tasks and can retrieve past and far-future completed items', () => {
  const completed = dashboardView(data(), { ...defaultDashboardFilters, status: 'completed' }, now)
  assert.deepEqual(ids(completed.results), ['done-past', 'done-today', 'done-future'])
  const pending = dashboardView(data(), { ...defaultDashboardFilters, status: 'pending' }, now)
  assert.equal(pending.results.some(item => item.kind === 'event' || item.done), false)
  assert.equal(pending.results.some(item => item.id === 'eighth'), true)
})

test('archived project arrangements stay searchable and included in the daily overview', () => {
  const original = data()
  original.projects = setProjectArchived(original.projects, 'will', true)
  const view = dashboardView(original, { ...defaultDashboardFilters, projectId: 'will' }, now)
  assert.deepEqual(ids(view.groups.overdue), ['old', 'elapsed'])
  assert.equal(view.results.some(item => item.id === 'eighth'), true)
  assert.equal(view.results.some(item => item.projectId === 'course'), false)
})

test('filtering and grouping never mutate stored data or defaults, and blank input is not an active filter', () => {
  const original = data()
  const snapshot = JSON.stringify(original)
  const defaults = JSON.stringify(defaultDashboardFilters)
  dashboardView(original, { ...defaultDashboardFilters, query: 'notes', kind: 'task' }, now)
  assert.equal(JSON.stringify(original), snapshot)
  assert.equal(JSON.stringify(defaultDashboardFilters), defaults)
  assert.equal(hasDashboardFilters({ ...defaultDashboardFilters, query: '   ' }), false)
  assert.equal(hasDashboardFilters({ ...defaultDashboardFilters, projectId: 'course' }), true)
  assert.deepEqual(dashboardView(emptySchedule(), defaultDashboardFilters, now).groups, { overdue: [], today: [], upcoming: [] })
})

test('clock changes and saved edits recompute groups rather than caching an old day or membership', () => {
  const original = addDrafts(emptySchedule(), [draft('midnight', { time: '23:59' })])
  assert.deepEqual(ids(dashboardView(original, defaultDashboardFilters, new Date(2026, 10, 4, 23, 59)).groups.today), ['midnight'])
  assert.deepEqual(ids(dashboardView(original, defaultDashboardFilters, new Date(2026, 10, 5, 0, 0)).groups.overdue), ['midnight'])
  original.tasks[0].done = true
  assert.equal(dashboardView(original, defaultDashboardFilters, new Date(2026, 10, 5, 0, 0)).groups.overdue.length, 0)
  original.tasks[0].done = false
  original.tasks[0].due = '2026-11-06'
  assert.deepEqual(ids(dashboardView(original, defaultDashboardFilters, new Date(2026, 10, 5, 0, 0)).groups.upcoming), ['midnight'])
})
