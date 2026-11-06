import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addProjectFromTemplate, defaultProjects, setProjectViews } from '../src/domain/projects.ts'
import { addDrafts, decodeSchedule, emptySchedule, scheduleItems, setTaskStatus, taskStatus } from '../src/domain/schedule.ts'
import { loadSchedule, persistSchedule, LEGACY_PROTOTYPE_KEY } from '../src/domain/scheduleStorage.ts'
import { parseRoute, routeHash } from '../src/domain/navigation.ts'

const draft = (patch = {}) => ({ id: 'task', kind: 'task', title: '检查迁移', date: '', time: '', projectId: 'course', duration: 60, remind: 0, ...patch })

test('v2 task migration preserves IDs and maps done to the three-state model', () => {
  const old = { version: 2, projects: defaultProjects(), tasks: [{ id: 'legacy', title: '旧任务', due: '2026-11-08', time: '17:00', projectId: 'course', done: true }], events: [] }
  const next = decodeSchedule(JSON.stringify(old))
  assert.equal(next.version, 3)
  assert.equal(next.tasks[0].id, 'legacy')
  assert.equal(taskStatus(next.tasks[0]), 'done')
  assert.equal(next.tasks[0].due, old.tasks[0].due)
})

test('undated tasks remain in project data but never project into calendar items', () => {
  let data = addDrafts(emptySchedule(), [draft()])
  assert.equal(data.tasks.length, 1)
  assert.equal(scheduleItems(data).some(item => item.id === 'task'), false)
  data = setTaskStatus(data, 'task', 'in_progress')
  assert.equal(taskStatus(data.tasks[0]), 'in_progress')
  assert.equal(data.tasks[0].done, false)
  data = setTaskStatus(data, 'task', 'done')
  assert.equal(taskStatus(data.tasks[0]), 'done')
})

test('template views can be enabled and hidden without modifying task records', () => {
  let projects = addProjectFromTemplate(defaultProjects(), 'paper', '课程论文', 'paper', '研究期末论文')
  assert.deepEqual(projects.at(-1).enabledViews, ['paper'])
  const tasks = [{ id: 'task', title: '提纲', projectId: 'paper' }]
  projects = setProjectViews(projects, 'paper', ['workflow'])
  assert.deepEqual(projects.at(-1).enabledViews, ['workflow'])
  assert.equal(tasks[0].id, 'task')
})

test('storage prefers the new key, preserves legacy keys, and rejects corrupt primary data', () => {
  const values = new Map([[LEGACY_PROTOTYPE_KEY, JSON.stringify({ ...emptySchedule(), version: 2 })]])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const loaded = loadSchedule(storage)
  assert.equal(loaded.sourceKey, LEGACY_PROTOTYPE_KEY)
  persistSchedule(storage, loaded.data)
  assert.equal(values.has(LEGACY_PROTOTYPE_KEY), true)
  assert.equal(values.has('will-workbench-schedule-v03'), true)
  values.set('will-workbench-schedule-v03', '{')
  assert.equal(loadSchedule(storage).readFailed, true)
})

test('hash navigation round-trips project ID and tab for Electron local routes', () => {
  const route = { page: 'projects', projectId: 'course project', tab: 'tasks' }
  assert.deepEqual(parseRoute(routeHash(route)), route)
  assert.deepEqual(parseRoute('#/calendar?date=2026-11-08'), { page: 'calendar', date: '2026-11-08' })
})
