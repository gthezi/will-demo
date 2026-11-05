import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deadlineView } from '../src/domain/dashboard.ts'
import { decodeUpcomingDays } from '../src/domain/dashboardPreferences.ts'
import { addDrafts, emptySchedule } from '../src/domain/schedule.ts'

const now = new Date(2026, 10, 5, 14, 0)
const draft = (id, date, time = '23:00', kind = 'task') => ({
  id, title: id, date, time, kind, projectId: 'will', duration: 60, remind: 0,
})
const ids = items => items.map(item => item.id)

test('three inclusive local dates exclude the fourth date and expired tasks', () => {
  const data = addDrafts(emptySchedule(), [
    draft('expired', '2026-11-05', '09:00'),
    draft('today', '2026-11-05'),
    draft('tomorrow', '2026-11-06'),
    draft('last', '2026-11-07'),
    draft('outside', '2026-11-08'),
    draft('event', '2026-11-05', '16:00', 'event'),
    draft('completed', '2026-11-06'),
  ])
  data.tasks.find(item => item.id === 'completed').done = true
  const snapshot = JSON.stringify(data)
  assert.deepEqual(ids(deadlineView(data, now, 3).upcoming), ['today', 'tomorrow', 'last'])
  assert.deepEqual(ids(deadlineView(data, now, 3).overdue), ['expired'])
  assert.deepEqual(ids(deadlineView(data, now, 7).upcoming), ['today', 'tomorrow', 'last', 'outside'])
  assert.equal(JSON.stringify(data), snapshot)
})

test('a cutoff equal to now remains upcoming, strictly earlier wall time is overdue', () => {
  const data = addDrafts(emptySchedule(), [draft('boundary', '2026-11-05', '14:00')])
  assert.deepEqual(ids(deadlineView(data, now, 3).upcoming), ['boundary'])
  assert.deepEqual(ids(deadlineView(data, new Date(2026, 10, 5, 14, 0, 1), 3).overdue), ['boundary'])
})

test('all range choices use calendar dates across month and year boundaries', () => {
  for (const days of [3, 7, 14, 30]) {
    const start = new Date(2026, 11, 30, 23, 30)
    const last = new Date(2026, 11, 30 + days - 1)
    const outside = new Date(2026, 11, 30 + days)
    const format = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    const data = addDrafts(emptySchedule(), [
      draft('last', format(last), '00:00'), draft('outside', format(outside), '00:00'),
    ])
    assert.deepEqual(ids(deadlineView(data, start, days).upcoming), ['last'])
  }
  const leap = addDrafts(emptySchedule(), [
    draft('leap', '2028-02-29'), draft('march', '2028-03-01'), draft('outside', '2028-03-02'),
  ])
  assert.deepEqual(ids(deadlineView(leap, new Date(2028, 1, 28, 10), 3).upcoming), ['leap', 'march'])
})

test('empty, completed-only and events-only schedules have no pending deadlines', () => {
  assert.deepEqual(deadlineView(emptySchedule(), now, 3), { overdue: [], upcoming: [] })
  const data = addDrafts(emptySchedule(), [
    draft('task', '2026-11-05'), draft('event', '2026-11-06', '10:00', 'event'),
  ])
  data.tasks[0].done = true
  assert.deepEqual(deadlineView(data, now, 30), { overdue: [], upcoming: [] })
})

test('the deadline collection retains every match beyond four and updates on completion', () => {
  const data = addDrafts(emptySchedule(), Array.from({ length: 6 }, (_, index) =>
    draft(`task-${index}`, '2026-11-06', `${10 + index}:00`)))
  assert.equal(deadlineView(data, now, 3).upcoming.length, 6)
  data.tasks[0].done = true
  assert.equal(deadlineView(data, now, 3).upcoming.length, 5)
  data.tasks[0].done = false
  assert.equal(deadlineView(data, now, 3).upcoming.length, 6)
})

test('overdue-only schedules remain accessible regardless of selected range', () => {
  const data = addDrafts(emptySchedule(), [draft('old', '2026-11-04')])
  for (const days of [3, 7, 14, 30]) {
    assert.deepEqual(ids(deadlineView(data, now, days).overdue), ['old'])
    assert.deepEqual(deadlineView(data, now, days).upcoming, [])
  }
})

test('preferences accept only supported numeric values and safely default invalid storage', () => {
  for (const days of [3, 7, 14, 30]) assert.equal(decodeUpcomingDays(String(days)), days)
  for (const invalid of [null, '', '{broken', 'null', '"7"', 'true', '[]', '{}', '0', '-7', '3.5', '8']) {
    assert.equal(decodeUpcomingDays(invalid), 3)
  }
  const data = addDrafts(emptySchedule(), [draft('outside', '2026-11-08')])
  assert.deepEqual(deadlineView(data, now, 999).upcoming, [])
})
