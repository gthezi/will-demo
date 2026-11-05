import assert from 'node:assert/strict'
import { test } from 'node:test'
import { itemStatus, isOverdue } from '../src/domain/itemStatus.ts'
import { dashboardView, deadlineView, defaultDashboardFilters } from '../src/domain/dashboard.ts'
import { emptySchedule, scheduleItems } from '../src/domain/schedule.ts'

const task = { id: 'task', kind: 'task', title: 'Cutoff', date: '2026-11-05', time: '14:00', projectId: 'will', done: false }
const at = (hour, minute = 0, second = 0) => new Date(2026, 10, 5, hour, minute, second)

test('status respects kind, completion and exact deadline precedence', () => {
  assert.equal(itemStatus(task, at(13)), 'today')
  assert.equal(itemStatus(task, at(14)), 'today')
  assert.equal(itemStatus(task, at(14, 0, 1)), 'overdue')
  assert.equal(itemStatus({ ...task, done: true }, at(15)), 'done')
  assert.equal(itemStatus({ ...task, kind: 'event' }, at(15)), 'event')
  assert.equal(itemStatus({ ...task, date: '2026-11-06' }, at(15)), 'task')
})

test('all lists and cutoff collections agree at equality, one second later, completion and restore', () => {
  const data = emptySchedule()
  data.tasks.push({ id: task.id, title: task.title, due: task.date, time: task.time, projectId: task.projectId, done: false })
  for (const now of [at(13, 59, 59), at(14), at(14, 0, 1), at(14, 1)]) {
    for (const done of [false, true, false]) {
      data.tasks[0].done = done
      const overdue = isOverdue(scheduleItems(data)[0], now)
      assert.equal(deadlineView(data, now).overdue.length, Number(overdue))
      assert.equal(dashboardView(data, defaultDashboardFilters, now).groups.overdue.length, Number(overdue))
      assert.equal(itemStatus(scheduleItems(data)[0], now) === 'overdue', overdue)
      assert.equal(deadlineView(data, now).upcoming.length, Number(!done && !overdue))
    }
  }
})

test('local midnight and month/year boundaries update status without marking events overdue', () => {
  for (const [date, now] of [
    ['2026-11-30', new Date(2026, 11, 1, 0, 0)],
    ['2026-12-31', new Date(2027, 0, 1, 0, 0)],
    ['2028-02-29', new Date(2028, 2, 1, 0, 0)],
  ]) {
    assert.equal(itemStatus({ ...task, date, time: '23:59' }, now), 'overdue')
    assert.equal(itemStatus({ ...task, date, time: '23:59', kind: 'event' }, now), 'event')
  }
})
