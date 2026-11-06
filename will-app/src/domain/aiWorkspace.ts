import { addDrafts, type ArrangementDraft, type ScheduleData } from './schedule.ts'

export const AI_STORAGE_KEY = 'will-ai-workspace-v01'
export type Message = { id: string; role: 'user' | 'assistant'; text: string; createdAt: string }
export type DraftBatch = {
  id: string; messageId: string; source: string; createdAt: string
  status: 'pending' | 'staged' | 'confirming' | 'confirmed' | 'discarded'
  proposals: ArrangementDraft[]; notes: string[]
}
export type Conversation = {
  id: string; title: string; contextProjectId?: string; input: string
  messages: Message[]; batches: DraftBatch[]; updatedAt: string
}
export type AIWorkspaceData = { version: 1; activeId?: string; conversations: Conversation[] }
export const emptyAIWorkspace = (): AIWorkspaceData => ({ version: 1, conversations: [] })
export function newConversation(contextProjectId?: string): Conversation {
  return { id: crypto.randomUUID(), title: '新会话', contextProjectId, input: '', messages: [], batches: [], updatedAt: new Date().toISOString() }
}

// Incomplete proposals are valid saved drafts; business validation happens only at confirmation.
export function decodeAIWorkspace(text: string): AIWorkspaceData {
  const data = JSON.parse(text)
  const str = (value: unknown) => typeof value === 'string'
  const ids = new Set<string>()
  const unique = (id: unknown) => {
    if (!str(id) || !id || ids.has(id as string)) return false
    ids.add(id as string)
    return true
  }
  if (data?.version !== 1 || !Array.isArray(data.conversations) || !data.conversations.every((c: Conversation) =>
    c && unique(c.id) && str(c.title) && str(c.input) && str(c.updatedAt)
    && (c.contextProjectId === undefined || str(c.contextProjectId))
    && Array.isArray(c.messages) && c.messages.every(m => m && unique(m.id) && ['user', 'assistant'].includes(m.role) && str(m.text) && str(m.createdAt))
    && Array.isArray(c.batches) && c.batches.every(b => b && unique(b.id) && str(b.source) && str(b.createdAt)
      && c.messages.some(m => m.id === b.messageId && m.role === 'user')
      && ['pending', 'staged', 'confirming', 'confirmed', 'discarded'].includes(b.status)
      && Array.isArray(b.notes) && b.notes.every(str) && Array.isArray(b.proposals)
      && b.proposals.every(p => p && unique(p.id) && ['task', 'event'].includes(p.kind)
        && ['title', 'date', 'time', 'projectId'].every(key => str(p[key as keyof ArrangementDraft]))
        && typeof p.duration === 'number' && typeof p.remind === 'number'
        && (p.status === undefined || ['todo', 'in_progress', 'done'].includes(p.status))
        && (p.description === undefined || str(p.description))
        && (!p.source || (p.source.conversationId === c.id && p.source.batchId === b.id
          && p.source.messageId === b.messageId && p.source.input === b.source))))))
    throw new Error('本地 AI 会话格式无效；原始内容已保留，当前修改仅在本次页面有效。')
  if (data.activeId !== undefined && (!str(data.activeId) || !data.conversations.some((c: Conversation) => c.id === data.activeId)))
    throw new Error('本地 AI 会话索引无效；原始内容已保留。')
  return data
}
export function loadAIWorkspace(storage: Pick<Storage, 'getItem'>) {
  try {
    const raw = storage.getItem(AI_STORAGE_KEY)
    return { data: raw === null ? emptyAIWorkspace() : decodeAIWorkspace(raw), blocked: false, warning: '' }
  } catch {
    return { data: emptyAIWorkspace(), blocked: true, warning: '无法读取本地 AI 会话；原始内容已保留，当前会话仅在本次页面有效。' }
  }
}
export function persistAIWorkspace(storage: Pick<Storage, 'setItem'>, data: AIWorkspaceData) {
  storage.setItem(AI_STORAGE_KEY, JSON.stringify(data))
}
export function withSource(conversation: Conversation, batch: DraftBatch): ArrangementDraft[] {
  return batch.proposals.map(p => ({
    ...p, source: { conversationId: conversation.id, batchId: batch.id, messageId: batch.messageId, input: batch.source },
  }))
}
export function batchIsSaved(data: ScheduleData, conversation: Conversation, batch: DraftBatch) {
  const items = [...data.tasks, ...data.events]
  return batch.proposals.length > 0 && batch.proposals.every(p => items.some(item => item.id === p.id
    && item.source?.conversationId === conversation.id && item.source?.batchId === batch.id))
}
export function reconcileAIWorkspace(state: AIWorkspaceData, schedule: ScheduleData): AIWorkspaceData {
  return { ...state, conversations: state.conversations.map(c => ({
    ...c, batches: c.batches.map(b => ['pending', 'staged', 'confirming'].includes(b.status) && batchIsSaved(schedule, c, b)
      ? { ...b, status: 'confirmed' as const } : b),
  })) }
}
export function confirmationDrafts(schedule: ScheduleData, conversation: Conversation, batch: DraftBatch) {
  if (batch.status === 'confirmed') return []
  if (batch.status === 'discarded' || !batch.proposals.length) throw new Error('没有待确认的建议项。')
  const proposals = withSource(conversation, batch)
  for (const p of proposals) {
    const existing = [...schedule.tasks, ...schedule.events].find(item => item.id === p.id)
    if (existing && (existing.source?.batchId !== batch.id || existing.source?.conversationId !== conversation.id))
      throw new Error('建议项编号与其他安排冲突，请重新生成。')
  }
  addDrafts(schedule, proposals)
  return proposals
}

export function confirmAIBatch(
  schedule: ScheduleData, conversation: Conversation, batch: DraftBatch,
  checkpoint: (status: 'confirming' | 'confirmed') => boolean,
  writeSchedule: (drafts: ArrangementDraft[]) => boolean,
) {
  const drafts = confirmationDrafts(schedule, conversation, batch)
  if (!drafts.length) return { count: 0, receiptSaved: true }
  if (!checkpoint('confirming')) throw new Error('草案未能安全保存到本机，尚未写入安排；请解决存储问题后重试。')
  if (!writeSchedule(drafts)) throw new Error('安排尚未保存到本机，仅在本次页面有效；草案已保留，请重试确认。')
  return { count: drafts.length, receiptSaved: checkpoint('confirmed') }
}
