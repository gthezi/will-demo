import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AI_STORAGE_KEY, newConversation, decodeAIWorkspace, emptyAIWorkspace, persistAIWorkspace, loadAIWorkspace, confirmAIBatch, confirmationDrafts, reconcileAIWorkspace } from '../src/domain/aiWorkspace.ts'
import { addDrafts, decodeSchedule, emptySchedule, getArrangementDraft, scheduleItems, updateArrangement } from '../src/domain/schedule.ts'
import { replyLocally } from '../src/services/aiService.ts'
import { parseRoute, routeHash } from '../src/domain/navigation.ts'

const fixture = () => {
  const c = newConversation('course')
  c.messages = [{ id: 'msg-1', role: 'user', text: '拆解任务：完成论文', createdAt: c.updatedAt }]
  c.batches = [{
    id: 'batch-1', messageId: 'msg-1', source: '拆解任务：完成论文', createdAt: c.updatedAt,
    status: 'staged', notes: [], proposals: [
      { id: 'proposal-1', title: '整理提纲', kind: 'task', date: '', time: '', projectId: 'course', duration: 60, remind: 0, status: 'in_progress' },
    ],
  }]
  return { c, b: c.batches[0], state: { ...emptyAIWorkspace(), activeId: c.id, conversations: [c] } }
}
test('AI sessions round-trip staged edits, pending incomplete events, input, titles and stable IDs', () => {
  const { c, state } = fixture()
  c.input = '继续提问'
  c.title = '论文步骤'
  c.batches[0].proposals.push({ ...c.batches[0].proposals[0], id: 'event-1', kind: 'event', title: '' })
  const values = new Map()
  persistAIWorkspace({ setItem: (k, v) => values.set(k, v) }, state)
  assert.equal(values.size, 1)
  assert.ok(values.has(AI_STORAGE_KEY))
  assert.deepEqual(loadAIWorkspace({ getItem: k => values.get(k) ?? null }).data, state)
})
test('invalid AI schemas and duplicate IDs are rejected without resetting stored text', () => {
  const { state } = fixture()
  for (const bad of ['{bad', JSON.stringify({ version: 2, conversations: [] }), JSON.stringify({ ...state, activeId: 'missing' })]) {
    const storage = { getItem: () => bad, setItem() { assert.fail('must not write') } }
    assert.equal(loadAIWorkspace(storage).blocked, true)
    assert.equal(storage.getItem(), bad)
  }
  state.conversations[0].batches[0].proposals[0].id = state.activeId
  assert.throws(() => decodeAIWorkspace(JSON.stringify(state)))
  assert.equal(loadAIWorkspace({ getItem() { throw Error('denied') } }).blocked, true)
})
test('AI persistence reports write failures instead of masking them', () => {
  assert.throws(() => persistAIWorkspace({ setItem() { throw Error('quota') } }, emptyAIWorkspace()), /quota/)
})
test('confirmation writes schedule only after a durable proposal checkpoint and is idempotent', () => {
  const { c, b } = fixture()
  let schedule = emptySchedule()
  const order = []
  const write = proposals => { order.push('schedule'); schedule = addDrafts(schedule, proposals); return true }
  const checkpoint = status => { order.push(status); return true }
  assert.deepEqual(confirmAIBatch(schedule, c, b, checkpoint, write), { count: 1, receiptSaved: true })
  assert.deepEqual(order, ['confirming', 'schedule', 'confirmed'])
  confirmAIBatch(schedule, c, b, checkpoint, write)
  assert.equal(schedule.tasks.length, 1)
  assert.equal(schedule.tasks[0].status, 'in_progress')
  assert.equal(schedule.tasks[0].source.input, b.source)
  assert.deepEqual(decodeSchedule(JSON.stringify(schedule)), schedule)
  const invalidSource = structuredClone(schedule)
  invalidSource.tasks[0].source = { conversationId: c.id }
  assert.throws(() => decodeSchedule(JSON.stringify(invalidSource)), /格式无效/)
  assert.equal(scheduleItems(schedule).length, 0)
})
test('proposal checkpoint failure prevents any schedule write', () => {
  const { c, b } = fixture()
  assert.throws(() => confirmAIBatch(emptySchedule(), c, b, () => false, () => assert.fail('must not write')), /尚未写入/)
})
test('schedule failure keeps stable pending IDs and never records a confirmed receipt', () => {
  const { c, b } = fixture()
  const statuses = []
  assert.throws(() => confirmAIBatch(emptySchedule(), c, b, s => { statuses.push(s); return true }, () => false), /尚未保存/)
  assert.deepEqual(statuses, ['confirming'])
  assert.equal(b.proposals[0].id, 'proposal-1')
})
test('schedule success and receipt failure reconcile on restart without a second business write', () => {
  const { c, b, state } = fixture()
  let schedule = emptySchedule()
  let savedAI
  const result = confirmAIBatch(schedule, c, b, status => {
    if (status === 'confirmed') return false
    savedAI = JSON.stringify({ ...state, conversations: [{ ...c, batches: [{ ...b, status }] }] })
    return true
  }, proposals => { schedule = addDrafts(schedule, proposals); return true })
  assert.equal(result.receiptSaved, false)
  const restored = reconcileAIWorkspace(decodeAIWorkspace(savedAI), decodeSchedule(JSON.stringify(schedule)))
  const restoredC = restored.conversations[0]
  assert.equal(restoredC.batches[0].status, 'confirmed')
  assert.equal(confirmAIBatch(schedule, restoredC, restoredC.batches[0], () => assert.fail(), () => assert.fail()).count, 0)
})
test('restoring a confirming checkpoint without a saved schedule permits a single retry', () => {
  const { c, b, state } = fixture()
  b.status = 'confirming'
  const restored = reconcileAIWorkspace(decodeAIWorkspace(JSON.stringify(state)), emptySchedule())
  assert.equal(restored.conversations[0].batches[0].status, 'confirming')
  let schedule = emptySchedule()
  confirmAIBatch(schedule, c, b, () => true, p => { schedule = addDrafts(schedule, p); return true })
  assert.equal(schedule.tasks.length, 1)
})
test('all proposals validate before a write: target, archived project, empty and invalid event/date', () => {
  const { c, b } = fixture()
  const schedule = emptySchedule()
  for (const patch of [{ projectId: '' }, { date: '2026-02-30' }, { time: '12:00' }, { kind: 'event' }, { status: 'unsupported' }]) {
    const altered = { ...b, proposals: [{ ...b.proposals[0], ...patch }] }
    assert.throws(() => confirmAIBatch(schedule, c, altered, () => assert.fail('invalid checkpoint'), () => assert.fail('invalid write')))
  }
  schedule.projects.find(p => p.id === 'course').archived = true
  assert.throws(() => confirmationDrafts(schedule, c, b), /归档/)
  assert.throws(() => confirmationDrafts(emptySchedule(), c, { ...b, proposals: [] }), /没有待确认/)
})
test('unrelated schedule ID collisions cannot be reported as successful AI writes', () => {
  const { c, b } = fixture()
  const schedule = addDrafts(emptySchedule(), b.proposals)
  assert.throws(() => confirmationDrafts(schedule, c, b), /冲突/)
})
test('W1 edits and event/task conversion preserve AI source links and original input', () => {
  const { c, b } = fixture()
  let schedule = addDrafts(emptySchedule(), confirmationDrafts(emptySchedule(), c, b))
  const draft = getArrangementDraft(schedule, 'proposal-1')
  schedule = updateArrangement(schedule, { ...draft, source: undefined, kind: 'event', date: '2026-11-10', time: '14:00' })
  assert.deepEqual(schedule.events[0].source, draft.source)
  assert.deepEqual(getArrangementDraft(schedule, 'proposal-1').source, draft.source)
})
test('Mock notification uses explicit project context and global ambiguity remains unassigned', async () => {
  const text = '整理通知：明天下午三点有组会，五点前提交汇报文档'
  const signal = new AbortController().signal
  const scoped = await replyLocally(text, emptySchedule(), 'course', signal)
  assert.equal(scoped.drafts.length, 2)
  assert.ok(scoped.drafts.every(p => p.projectId === 'course'))
  const global = await replyLocally(text, emptySchedule(), undefined, signal)
  assert.ok(global.drafts.every(p => p.projectId === ''))
})
test('Mock goal breakdown has editable undated tasks and contextual reads do not mutate schedule', async () => {
  const schedule = emptySchedule()
  const before = JSON.stringify(schedule)
  const reply = await replyLocally('拆解任务：课程论文', schedule, 'course', new AbortController().signal)
  assert.equal(reply.drafts.length, 3)
  assert.ok(reply.drafts.every(p => !p.date && !p.time && p.projectId === 'course'))
  const read = await replyLocally('当前任务', schedule, 'course', new AbortController().signal)
  assert.equal(read.drafts.length, 0)
  assert.match(read.text, /仅按项目 ID/)
  assert.equal(JSON.stringify(schedule), before)
})
test('cancel/retry preserves input and unsupported chat returns honest text without proposals', async () => {
  const controller = new AbortController()
  const text = '拆解任务：论文'
  const pending = replyLocally(text, emptySchedule(), undefined, controller.signal)
  controller.abort()
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal((await replyLocally(text, emptySchedule(), undefined, new AbortController().signal)).drafts.length, 3)
  const chat = await replyLocally('你好', emptySchedule(), undefined, new AbortController().signal)
  assert.match(chat.text, /不能提供通用大模型/)
  assert.equal(chat.drafts.length, 0)
})
test('AI conversation hash routes round-trip safely for local Electron loading', () => {
  assert.deepEqual(parseRoute(routeHash({ page: 'ai', conversationId: '会话/1' })), { page: 'ai', conversationId: '会话/1' })
  assert.deepEqual(parseRoute('#/ai/%xx'), { page: 'ai' })
})
