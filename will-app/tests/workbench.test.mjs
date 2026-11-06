import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addProjectFromTemplate, defaultProjects, setProjectViews } from '../src/domain/projects.ts'
import { addDrafts, decodeSchedule, emptySchedule, scheduleItems, setTaskStatus, taskStatus } from '../src/domain/schedule.ts'
import { loadSchedule, persistSchedule, recoverSchedule, LEGACY_PROTOTYPE_KEY } from '../src/domain/scheduleStorage.ts'
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

test('v1 and v2 migration preserve project, task, event IDs and legacy fields', () => {
  const v1 = {
    version: 1,
    tasks: [{ id: 'v1-task', title: '旧待办', due: '2026-11-08', time: '09:30', projectId: 'course', done: false }],
    events: [{ id: 'v1-event', title: '旧日程', date: '2026-11-09', time: '15:00', projectId: 'will', duration: 90, remind: 30 }],
  }
  const upgradedV1 = decodeSchedule(JSON.stringify(v1))
  assert.deepEqual(upgradedV1.projects.map(project => project.id), ['will', 'course', 'personal'])
  assert.deepEqual(upgradedV1.tasks[0], { ...v1.tasks[0], status: 'todo' })
  assert.deepEqual(upgradedV1.events[0], v1.events[0])

  const v2 = {
    version: 2, projects: defaultProjects(),
    tasks: [{ id: 'v2-task', title: '旧完成项', due: '2026-11-10', time: '17:45', projectId: 'course', done: true }],
    events: [{ id: 'v2-event', title: '旧会面', date: '2026-11-11', time: '10:00', projectId: 'personal', duration: 60, remind: 10 }],
  }
  const upgradedV2 = decodeSchedule(JSON.stringify(v2))
  assert.deepEqual(upgradedV2.projects, v2.projects)
  assert.deepEqual(upgradedV2.tasks[0], { ...v2.tasks[0], status: 'done' })
  assert.deepEqual(upgradedV2.events[0], v2.events[0])
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

test('storage prefers the new key and preserves a valid legacy snapshot on load', () => {
  const legacy = { ...emptySchedule(), version: 2, tasks: [{ id: 'old', title: '旧数据', projectId: 'course', done: false }] }
  const values = new Map([[LEGACY_PROTOTYPE_KEY, JSON.stringify(legacy)]])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const loaded = loadSchedule(storage)
  assert.equal(loaded.sourceKey, LEGACY_PROTOTYPE_KEY)
  assert.equal(loaded.data.tasks[0].id, 'old')
  persistSchedule(storage, loaded.data)
  assert.equal(values.has(LEGACY_PROTOTYPE_KEY), true)
  assert.equal(values.has('will-workbench-schedule-v03'), true)
})

test('corrupt primary plus valid old data requires explicit backed-up recovery', () => {
  const legacy = { version: 2, projects: defaultProjects(), tasks: [{ id: 'saved-task', title: '旧任务', due: '2026-11-10', time: '17:00', projectId: 'course', done: true }], events: [] }
  const corrupt = '{broken-primary-json'
  const values = new Map([
    ['will-workbench-schedule-v03', corrupt],
    [LEGACY_PROTOTYPE_KEY, JSON.stringify(legacy)],
  ])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const loaded = loadSchedule(storage)
  assert.equal(loaded.readFailed, true)
  assert.equal(loaded.recoveryAvailable, true)
  assert.equal(values.get('will-workbench-schedule-v03'), corrupt)

  const recovered = recoverSchedule(storage, 1234)
  assert.equal(recovered.sourceKey, LEGACY_PROTOTYPE_KEY)
  assert.equal(values.get(recovered.backupKey), corrupt)
  assert.deepEqual(JSON.parse(values.get('will-workbench-schedule-v03')), recovered.data)
  assert.equal(values.get(LEGACY_PROTOTYPE_KEY), JSON.stringify(legacy))
  assert.equal(loadSchedule(storage).readFailed, false)
  assert.equal(loadSchedule(storage).data.tasks[0].id, 'saved-task')
})

test('recovery leaves original corrupt and legacy values untouched when writes fail', () => {
  const corrupt = '{broken'
  const legacy = JSON.stringify({ ...emptySchedule(), version: 2 })
  const values = new Map([['will-workbench-schedule-v03', corrupt], [LEGACY_PROTOTYPE_KEY, legacy]])
  const storage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { if (key === 'will-workbench-schedule-v03') throw new Error('quota'); values.set(key, value) },
  }
  assert.throws(() => recoverSchedule(storage, 55), /quota/)
  assert.equal(values.get('will-workbench-schedule-v03'), corrupt)
  assert.equal(values.get(LEGACY_PROTOTYPE_KEY), legacy)
  assert.equal(values.get('will-workbench-schedule-v03.corrupt-55'), corrupt)
})

test('storage access failure is reported without offering a misleading recovery', () => {
  const loaded = loadSchedule({ getItem() { throw new Error('blocked') } })
  assert.equal(loaded.readFailed, true)
  assert.equal(loaded.recoveryAvailable, false)
  assert.equal(loaded.corruptKey, null)
})

test('recovery stops before replacing data when backup storage is unavailable', () => {
  const values = new Map([
    ['will-workbench-schedule-v03', '{bad'],
    [LEGACY_PROTOTYPE_KEY, JSON.stringify(emptySchedule())],
  ])
  const before = [...values]
  const storage = { getItem: key => values.get(key) ?? null, setItem() { throw new Error('backup failed') } }
  assert.throws(() => recoverSchedule(storage), /backup failed/)
  assert.deepEqual([...values], before)
})

test('recovery keeps existing backup keys and refuses to reset without a valid legacy snapshot', () => {
  const values = new Map([
    ['will-workbench-schedule-v03', '{bad'],
    ['will-workbench-schedule-v03.corrupt-1', 'existing-backup'],
    [LEGACY_PROTOTYPE_KEY, JSON.stringify(emptySchedule())],
  ])
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  assert.equal(recoverSchedule(storage, 1).backupKey, 'will-workbench-schedule-v03.corrupt-1-1')
  assert.equal(values.get('will-workbench-schedule-v03.corrupt-1'), 'existing-backup')
  values.set('will-workbench-schedule-v03', '{bad')
  values.set(LEGACY_PROTOTYPE_KEY, '{bad-old')
  assert.equal(loadSchedule(storage).recoveryAvailable, false)
  assert.throws(() => recoverSchedule(storage), /没有找到有效的旧版安排/)
  assert.equal(values.get('will-workbench-schedule-v03'), '{bad')
})

test('hash navigation round-trips project ID and tab for Electron local routes', () => {
  const route = { page: 'projects', projectId: 'course project', tab: 'tasks' }
  assert.deepEqual(parseRoute(routeHash(route)), route)
  assert.deepEqual(parseRoute('#/calendar?date=2026-11-08'), { page: 'calendar', date: '2026-11-08' })
})
