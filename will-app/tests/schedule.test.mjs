import assert from 'node:assert/strict'
import { test } from 'node:test'
import dayjs from 'dayjs'
import {
  addDrafts, decodeSchedule, deleteArrangement, emptySchedule, getArrangementDraft,
  scheduleItems, updateArrangement, validDate, validTime,
} from '../src/domain/schedule.ts'
import { fromArrangementForm, toArrangementForm } from '../src/domain/arrangementForm.ts'
import { extractDrafts, MockScheduleService } from '../src/services/draftService.ts'

const now = dayjs('2026-11-04T10:00:00')
const extract = text => extractDrafts(text, now)
const draft = (overrides = {}) => ({
  id: 'draft-1', kind: 'event', title: '组会', date: '2026-11-06',
  time: '15:00', projectId: 'will', duration: 60, remind: 30, ...overrides,
})

test('meeting and submission yield two correctly timed drafts', () => {
  const result = extract('11月6日下午三点开项目组会，五点前提交汇报文档')
  assert.equal(result.drafts.length, 2)
  assert.deepEqual(result.drafts.map(({ kind, title, date, time }) => ({ kind, title, date, time })), [
    { kind: 'event', title: '项目组会', date: '2026-11-06', time: '15:00' },
    { kind: 'task', title: '提交汇报文档', date: '2026-11-06', time: '17:00' },
  ])
  assert.equal(new Set(result.drafts.map(item => item.id)).size, 2)
  assert.match(result.notes.join(), /2026/)
})

test('reminder-only clause belongs to event without an extra task', () => {
  const { drafts } = extract('明天下午三点有组会，提前一小时提醒我')
  assert.equal(drafts.length, 1)
  assert.equal(drafts[0].date, '2026-11-05')
  assert.equal(drafts[0].remind, 60)
  assert.equal(drafts[0].time, '15:00')
})

test('lecture and sign-up use the same date and inherited afternoon', () => {
  const { drafts } = extract('11月6日下午三点有校园讲座，五点前提交报名表')
  assert.equal(drafts[0].title, '参加讲座')
  assert.equal(drafts[1].title, '提交报名表')
  assert.equal(drafts[1].time, '17:00')
})

test('explicit dates and periods stay associated with each clause', () => {
  const { drafts } = extract('明天下午三点组会，后天上午九点面试')
  assert.deepEqual(drafts.map(({ date, time }) => [date, time]), [
    ['2026-11-05', '15:00'], ['2026-11-06', '09:00'],
  ])
})

test('next Monday means the next calendar week', () => {
  assert.equal(extract('下周一下午三点开会').drafts[0].date, '2026-11-09')
  assert.equal(extractDrafts('下周五下午三点开会', dayjs('2026-11-02')).drafts[0].date, '2026-11-13')
})

test('explicit year, 24-hour colon time and half-hour time work', () => {
  assert.equal(extract('2027年1月6日15:30开会').drafts[0].date, '2027-01-06')
  assert.equal(extract('2026-11-06 15:30开会').drafts[0].time, '15:30')
  assert.equal(extract('明天下午三点半上课').drafts[0].time, '15:30')
  assert.equal(extract('明天下午三点半上课').drafts[0].projectId, 'course')
})

test('tasks may omit a deadline, while an orphan time still requires a date', () => {
  const { drafts, notes } = extract('三点整理资料')
  assert.equal(drafts[0].date, '')
  assert.equal(drafts[0].time, '')
  assert.match(notes.join(), /无截止日期/)
  assert.equal(addDrafts(emptySchedule(), drafts).tasks[0].due, undefined)
  assert.throws(() => addDrafts(emptySchedule(), [{ ...drafts[0], date: '', time: '15:00' }]), /检查草案/)
})

test('unknown text is preserved as an editable task rather than lost', () => {
  const { drafts } = extract('买一盏台灯')
  assert.equal(drafts[0].title, '买一盏台灯')
  assert.equal(drafts[0].kind, 'task')
  assert.equal(drafts[0].projectId, 'personal')
})

test('invalid calendar dates, invalid times and empty inputs are rejected', () => {
  assert.throws(() => extract('2月30日下午三点开会'), /日期不存在/)
  assert.throws(() => extract('明天25:00开会'), /时间无效/)
  assert.throws(() => extract('明天下午三点90分开会'), /时间无效/)
  assert.throws(() => extract('  '), /先输入/)
  assert.throws(() => extract('；，。'), /没有可整理/)
  assert.throws(() => extract('a'.repeat(2001)), /2000/)
})

test('date and time validation are strict', () => {
  assert.equal(validDate('2026-02-29'), false)
  assert.equal(validDate('2028-02-29'), true)
  assert.equal(validDate('2026-2-04'), false)
  assert.equal(validTime('24:00'), false)
  assert.equal(validTime('23:60'), false)
  assert.equal(validTime('00:00'), true)
})

test('only confirmation converts drafts to stored events and tasks', () => {
  const initial = emptySchedule()
  const { drafts } = extract('11月6日下午三点开项目组会，五点前提交汇报文档')
  assert.deepEqual(initial, emptySchedule())
  const result = addDrafts(initial, drafts)
  assert.equal(initial.events.length, 0)
  assert.equal(initial.tasks.length, 0)
  assert.equal(result.events.length, 1)
  assert.equal(result.tasks.length, 1)
  assert.equal(result.tasks[0].due, '2026-11-06')
  assert.equal(result.tasks[0].done, false)
  assert.equal(result.events[0].duration, 60)
  assert.equal(result.events[0].date, '2026-11-06')
})

test('edited title, type, dates, project, duration and reminder survive confirmation', () => {
  const result = addDrafts(emptySchedule(), [
    draft({ title: '  修订组会  ', duration: 90, remind: 60, projectId: 'course' }),
    draft({ id: 'draft-2', kind: 'task', title: '新待办', date: '2026-11-08', time: '17:30', projectId: 'personal' }),
  ])
  assert.equal(result.events[0].title, '修订组会')
  assert.equal(result.events[0].duration, 90)
  assert.equal(result.events[0].remind, 60)
  assert.equal(result.events[0].projectId, 'course')
  assert.equal(result.tasks[0].due, '2026-11-08')
  assert.equal(result.tasks[0].time, '17:30')
  assert.equal(result.tasks[0].projectId, 'personal')
})

test('one invalid item rejects the whole batch and preserves existing data', () => {
  const initial = addDrafts(emptySchedule(), [draft()])
  const snapshot = JSON.stringify(initial)
  for (const patch of [
    { title: '  ' }, { title: 'a'.repeat(81) }, { date: '2026-02-30' }, { time: '29:00' },
    { projectId: 'missing' }, { duration: 0 }, { duration: 60.5 }, { remind: 999 }, { kind: 'other' },
  ]) {
    assert.throws(() => addDrafts(initial, [draft({ id: 'draft-ok' }), draft({ ...patch, id: 'draft-bad' })]))
    assert.equal(JSON.stringify(initial), snapshot)
  }
})

test('retrying a confirmation does not create duplicates', () => {
  const drafts = [draft(), draft({ id: 'draft-2', kind: 'task' })]
  const first = addDrafts(emptySchedule(), drafts)
  assert.deepEqual(addDrafts(first, drafts), first)
  assert.throws(() => addDrafts(emptySchedule(), [draft(), draft()]), /检查草案/)
  assert.throws(() => addDrafts(emptySchedule(), []), /生成草案/)
})

test('stored data round-trips and malformed data is rejected', () => {
  const data = addDrafts(emptySchedule(), [draft(), draft({ id: 'task', kind: 'task' })])
  assert.deepEqual(decodeSchedule(JSON.stringify(data)), data)
  for (const invalid of [
    '{', 'null', '{}', JSON.stringify({ ...data, version: 99 }),
    JSON.stringify({ ...data, events: [{ ...data.events[0], date: '2026-02-30' }] }),
    JSON.stringify({ ...data, tasks: [{ ...data.tasks[0], done: 'yes' }] }),
    JSON.stringify({ ...data, tasks: [{ ...data.tasks[0], id: data.events[0].id }] }),
  ]) {
    assert.throws(() => decodeSchedule(invalid))
  }
})

test('schedule projection sorts chronologically with completed tasks last', () => {
  const data = addDrafts(emptySchedule(), [
    draft({ id: 'event', time: '15:00' }),
    draft({ id: 'later', kind: 'task', time: '17:00' }),
    draft({ id: 'done', kind: 'task', time: '09:00' }),
  ])
  data.tasks.find(task => task.id === 'done').done = true
  assert.deepEqual(scheduleItems(data).map(item => item.id), ['event', 'later', 'done'])
})

test('closing while extraction is pending aborts the request', async () => {
  const service = new MockScheduleService()
  const controller = new AbortController()
  const promise = service.extract('明天下午三点有组会', controller.signal)
  controller.abort()
  await assert.rejects(promise, { name: 'AbortError' })
})

test('stored items become independent editable drafts with task date normalization', () => {
  const initial = addDrafts(emptySchedule(), [draft(), draft({ id: 'task', kind: 'task' })])
  const eventDraft = getArrangementDraft(initial, 'draft-1')
  const taskDraft = getArrangementDraft(initial, 'task')
  assert.equal(taskDraft.date, initial.tasks[0].due)
  assert.equal(taskDraft.kind, 'task')
  assert.equal(taskDraft.remind, 0)
  assert.equal(taskDraft.duration, 60)
  eventDraft.title = '未保存的修改'
  taskDraft.time = '10:00'
  assert.equal(initial.events[0].title, '组会')
  assert.equal(initial.tasks[0].time, '15:00')
})

test('editing a stored event changes all fields and keeps its ID without touching other items', () => {
  const initial = addDrafts(emptySchedule(), [draft(), draft({ id: 'other', kind: 'task' })])
  const before = JSON.stringify(initial)
  const edited = {
    ...getArrangementDraft(initial, 'draft-1'), title: '  新组会  ', date: '2026-12-07',
    time: '16:30', projectId: 'course', duration: 90, remind: 60,
  }
  const next = updateArrangement(initial, edited)
  assert.equal(JSON.stringify(initial), before)
  assert.deepEqual(next.tasks, initial.tasks)
  assert.deepEqual(next.events, [{
    id: 'draft-1', title: '新组会', date: '2026-12-07', time: '16:30',
    projectId: 'course', duration: 90, remind: 60,
  }])
  assert.deepEqual(updateArrangement(next, edited), next)
})

test('editing a completed task preserves its completed state and moves it to its new date/project', () => {
  const initial = addDrafts(emptySchedule(), [draft({ kind: 'task' })])
  initial.tasks[0].done = true
  const next = updateArrangement(initial, {
    ...getArrangementDraft(initial, 'draft-1'), date: '2026-11-08', projectId: 'personal',
  })
  assert.equal(next.tasks[0].done, true)
  assert.equal(next.tasks[0].due, '2026-11-08')
  assert.equal(next.tasks[0].projectId, 'personal')
  assert.equal(scheduleItems(next).filter(item => item.date === '2026-11-06').length, 0)
  assert.equal(scheduleItems(next).filter(item => item.date === '2026-11-08').length, 1)
})

test('changing a task to an event and back leaves one item with the same ID and new task state', () => {
  const initial = addDrafts(emptySchedule(), [draft({ kind: 'task' })])
  initial.tasks[0].done = true
  const eventData = updateArrangement(initial, {
    ...getArrangementDraft(initial, 'draft-1'), kind: 'event', duration: 120, remind: 10,
  })
  assert.equal(eventData.tasks.length, 0)
  assert.equal(eventData.events.length, 1)
  assert.equal(eventData.events[0].id, 'draft-1')
  assert.equal(eventData.events[0].duration, 120)
  const taskData = updateArrangement(eventData, { ...getArrangementDraft(eventData, 'draft-1'), kind: 'task' })
  assert.equal(taskData.events.length, 0)
  assert.equal(taskData.tasks.length, 1)
  assert.equal(taskData.tasks[0].id, 'draft-1')
  assert.equal(taskData.tasks[0].done, false)
  assert.equal('remind' in taskData.tasks[0], false)
  assert.equal('duration' in taskData.tasks[0], false)
})

test('invalid updates are rejected without changing the original stored item', () => {
  const initial = addDrafts(emptySchedule(), [draft()])
  const before = JSON.stringify(initial)
  for (const patch of [
    { title: ' ' }, { date: '2026-02-30' }, { time: '24:00' }, { projectId: 'unknown' },
    { duration: 14 }, { remind: 999 }, { kind: 'other' },
  ]) {
    assert.throws(() => updateArrangement(initial, { ...getArrangementDraft(initial, 'draft-1'), ...patch }))
    assert.equal(JSON.stringify(initial), before)
  }
})

test('deleting either kind only removes its own ID and leaves the input unchanged', () => {
  const initial = addDrafts(emptySchedule(), [draft(), draft({ id: 'task', kind: 'task' })])
  const before = JSON.stringify(initial)
  const withoutEvent = deleteArrangement(initial, 'draft-1')
  assert.equal(withoutEvent.events.length, 0)
  assert.deepEqual(withoutEvent.tasks, initial.tasks)
  const withoutTask = deleteArrangement(initial, 'task')
  assert.equal(withoutTask.tasks.length, 0)
  assert.deepEqual(withoutTask.events, initial.events)
  assert.equal(JSON.stringify(initial), before)
  assert.deepEqual(decodeSchedule(JSON.stringify(deleteArrangement(withoutEvent, 'task'))), emptySchedule())
})

test('stale IDs cannot create new items through the edit or delete paths', () => {
  const initial = emptySchedule()
  assert.throws(() => getArrangementDraft(initial, 'missing'), /不存在/)
  assert.throws(() => updateArrangement(initial, draft()), /不存在/)
  assert.throws(() => deleteArrangement(initial, 'missing'), /不存在/)
  assert.deepEqual(initial, emptySchedule())
})

test('shared form conversion keeps local dates, midnight and event preferences intact', () => {
  const value = draft({ time: '00:00', date: '2027-01-01', duration: 90, remind: 60 })
  assert.deepEqual(fromArrangementForm(toArrangementForm(value)), value)
  const missing = toArrangementForm(draft({ date: '', time: '' }))
  assert.equal(missing.date, null)
  assert.equal(missing.time, null)
  assert.throws(() => fromArrangementForm(missing), /有效的日期和时间/)
  assert.throws(() => fromArrangementForm({ ...missing, date: dayjs('not-a-date'), time: dayjs() }))
})
