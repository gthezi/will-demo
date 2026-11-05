import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createDemoSchedule, PROTOTYPE_STORAGE_KEY } from '../src/domain/demo.ts'
import { decodeSchedule, SCHEDULE_STORAGE_KEY } from '../src/domain/schedule.ts'

test('demo data has valid project assignments, completion and relative dates across year end', () => {
  const data = createDemoSchedule(new Date(2026, 11, 31, 10))
  assert.deepEqual(decodeSchedule(JSON.stringify(data)), data)
  assert.equal(data.tasks.length, 5)
  assert.equal(data.events.length, 2)
  assert.equal(data.tasks.filter(task => task.done).length, 1)
  assert.equal(data.tasks[0].due, '2026-12-30')
  assert.equal(data.events[0].date, '2027-01-01')
  assert.equal(data.tasks.at(-1).due, '2027-01-05')
  assert.ok([...data.tasks, ...data.events].every(item => item.id.startsWith('demo-')))
})

test('demo resets are independent and the preview uses a separate storage key', () => {
  const first = createDemoSchedule()
  first.tasks[0].done = false
  first.projects[0].name = 'changed'
  const second = createDemoSchedule()
  assert.equal(second.tasks[0].done, true)
  assert.equal(second.projects[0].name, 'Will 客户端')
  assert.notEqual(PROTOTYPE_STORAGE_KEY, SCHEDULE_STORAGE_KEY)
})
