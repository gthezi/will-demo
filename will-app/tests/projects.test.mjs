import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addProject, defaultProjectId, defaultProjects, projectName, renameProject, setProjectArchived, validProjects,
} from '../src/domain/projects.ts'
import {
  addDrafts, decodeSchedule, emptySchedule, getArrangementDraft, updateArrangement,
} from '../src/domain/schedule.ts'

const draft = (overrides = {}) => ({
  id: 'task', kind: 'task', title: '论文整理', date: '2026-11-04',
  time: '17:00', projectId: 'will', duration: 60, remind: 0, ...overrides,
})

test('original version 1 data upgrades without changing IDs, preferences, or completion', () => {
  const original = {
    version: 1,
    tasks: [{ id: 'old-task', title: '已完成事项', due: '2026-11-04', time: '10:00', projectId: 'course', done: true }],
    events: [{ id: 'old-event', title: '组会', date: '2026-11-05', time: '15:00', projectId: 'will', duration: 90, remind: 60 }],
  }
  const text = JSON.stringify(original)
  const upgraded = decodeSchedule(text)
  assert.deepEqual(upgraded, { ...original, version: 2, projects: defaultProjects() })
  assert.deepEqual(decodeSchedule(JSON.stringify(upgraded)), upgraded)
  assert.equal(JSON.stringify(original), text)
  assert.throws(() => decodeSchedule(JSON.stringify({
    ...original, tasks: [{ ...original.tasks[0], projectId: 'unknown' }],
  })), /归属无效/)
})

test('new and renamed projects trim names, preserve IDs and reject duplicates including archives', () => {
  const original = defaultProjects()
  const snapshot = JSON.stringify(original)
  const created = addProject(original, 'custom', '  Research  ')
  assert.equal(projectName(created, 'custom'), 'Research')
  const archived = setProjectArchived(created, 'custom', true)
  assert.throws(() => addProject(archived, 'another', 'research'), /已存在/)
  assert.throws(() => renameProject(created, 'will', 'Research'), /已存在/)
  assert.throws(() => addProject(created, 'custom', 'new'), /编号/)
  assert.throws(() => addProject(created, '', 'new'), /编号/)
  assert.throws(() => renameProject(created, 'missing', 'new'), /不存在/)
  for (const name of ['  ', 'a'.repeat(41)]) {
    assert.throws(() => addProject(created, 'invalid', name), /1–40/)
  }
  const renamed = renameProject(created, 'custom', '  文献阅读  ')
  assert.deepEqual(renamed.at(-1), { id: 'custom', name: '文献阅读', archived: false })
  assert.deepEqual(renameProject(renamed, 'custom', '文献阅读'), renamed)
  assert.equal(JSON.stringify(original), snapshot)
})

test('archiving and restoring preserve all arrangements, progress, and custom project persistence', () => {
  const initial = emptySchedule()
  initial.projects = addProject(initial.projects, 'research', '毕业论文')
  const data = addDrafts(initial, [draft({ projectId: 'research' })])
  data.tasks[0].done = true
  const snapshot = JSON.stringify(data)
  const archived = { ...data, projects: setProjectArchived(data.projects, 'research', true) }
  assert.deepEqual(archived.tasks, data.tasks)
  assert.equal(archived.tasks[0].done, true)
  assert.deepEqual(decodeSchedule(JSON.stringify(archived)), archived)
  const restored = { ...archived, projects: setProjectArchived(archived.projects, 'research', false) }
  assert.deepEqual(restored, data)
  assert.equal(JSON.stringify(data), snapshot)
  assert.throws(() => setProjectArchived(data.projects, 'missing', true), /不存在/)
})

test('new assignments cannot use archived or missing projects; editing can retain its archived project', () => {
  let data = addDrafts(emptySchedule(), [draft()])
  data.tasks[0].done = true
  data = { ...data, projects: setProjectArchived(data.projects, 'will', true) }
  const snapshot = JSON.stringify(data)
  assert.throws(() => addDrafts(data, [draft({ id: 'new' })]), /归档/)
  assert.throws(() => addDrafts(data, [draft({ id: 'new', projectId: 'missing' })]), /项目/)
  const edited = updateArrangement(data, { ...getArrangementDraft(data, 'task'), title: '修改保留归档关联' })
  assert.equal(edited.tasks[0].projectId, 'will')
  assert.equal(edited.tasks[0].done, true)
  const moved = updateArrangement(edited, { ...getArrangementDraft(edited, 'task'), projectId: 'course' })
  assert.equal(moved.tasks[0].projectId, 'course')
  assert.throws(() => updateArrangement(moved, { ...getArrangementDraft(moved, 'task'), projectId: 'will' }), /归档/)
  assert.equal(JSON.stringify(data), snapshot)
})

test('renaming a project changes labels without touching arrangement IDs or membership', () => {
  const data = addDrafts(emptySchedule(), [draft()])
  const renamed = { ...data, projects: renameProject(data.projects, 'will', '研究工作') }
  assert.deepEqual(renamed.tasks, data.tasks)
  assert.equal(projectName(renamed.projects, renamed.tasks[0].projectId), '研究工作')
  assert.deepEqual(decodeSchedule(JSON.stringify(renamed)), renamed)
})

test('all projects can be archived; defaults choose active projects and never reset the catalog', () => {
  const original = defaultProjects()
  assert.equal(defaultProjectId(original), 'personal')
  const withoutPersonal = setProjectArchived(original, 'personal', true)
  assert.equal(defaultProjectId(withoutPersonal), 'will')
  const allArchived = original.map(project => ({ ...project, archived: true }))
  assert.equal(defaultProjectId(allArchived), '')
  assert.deepEqual(decodeSchedule(JSON.stringify({ ...emptySchedule(), projects: allArchived })).projects, allArchived)
  assert.deepEqual(decodeSchedule(JSON.stringify({ ...emptySchedule(), projects: [] })).projects, [])
  assert.equal(defaultProjectId([{ id: 'custom', name: '唯一项目', archived: false }]), 'custom')
})

test('damaged project catalogs, orphan assignments, and unsupported schemas are rejected', () => {
  const data = addDrafts(emptySchedule(), [draft()])
  for (const projects of [
    undefined, null, {}, [null], [{ id: 'x', name: '', archived: false }],
    [{ id: 'x', name: 'a'.repeat(41), archived: false }],
    [{ id: '', name: 'test', archived: false }],
    [{ id: 'x', name: 'test', archived: 'false' }],
    [...data.projects, data.projects[0]],
    [...data.projects, { id: 'other', name: '  will 客户端 ', archived: false }],
    data.projects.filter(project => project.id !== 'will'),
  ]) {
    assert.throws(() => decodeSchedule(JSON.stringify({ ...data, projects })))
  }
  assert.throws(() => decodeSchedule(JSON.stringify({ ...data, version: '2' })))
  assert.equal(validProjects(defaultProjects()), true)
})
