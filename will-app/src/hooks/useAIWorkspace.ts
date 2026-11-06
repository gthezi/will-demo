import { useEffect, useRef, useState } from 'react'
import {
  confirmAIBatch, loadAIWorkspace, newConversation, persistAIWorkspace, reconcileAIWorkspace,
  type AIWorkspaceData, type Conversation, type DraftBatch,
} from '../domain/aiWorkspace'
import type { ArrangementDraft, ScheduleData } from '../domain/schedule'
import { replyLocally } from '../services/aiService'

export function useAIWorkspace(getSchedule: () => ScheduleData, confirmDrafts: (drafts: ArrangementDraft[]) => boolean) {
  const [initial] = useState(() => loadAIWorkspace({ getItem: key => localStorage.getItem(key) }))
  const [state, setState] = useState(() => reconcileAIWorkspace(initial.data, getSchedule()))
  const stateRef = useRef(state)
  const [warning, setWarning] = useState(initial.warning)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [processingId, setProcessingId] = useState<string>()
  const controllerRef = useRef<AbortController | null>(null)
  const confirming = useRef(false)
  useEffect(() => () => controllerRef.current?.abort(), [])

  const save = (next: AIWorkspaceData) => {
    stateRef.current = next
    setState(next)
    if (initial.blocked) return false
    try {
      persistAIWorkspace(localStorage, next)
      setWarning('')
      return true
    } catch {
      setWarning('AI 会话未保存到本机；修改仅在本次页面中保留，请暂勿退出。')
      return false
    }
  }
  const change = (id: string, update: (c: Conversation) => Conversation) => save({
    ...stateRef.current,
    conversations: stateRef.current.conversations.map(c => c.id === id ? { ...update(c), updatedAt: new Date().toISOString() } : c),
  })
  const cancel = () => {
    const controller = controllerRef.current
    if (controller) {
      controller.abort()
      controllerRef.current = null
      setProcessingId(undefined)
      setNotice('已停止生成，输入与已有草案保留。')
    }
  }
  const select = (id: string) => {
    if (!stateRef.current.conversations.some(c => c.id === id)) return false
    if (stateRef.current.activeId === id) return true
    cancel()
    setError('')
    setNotice('')
    save({ ...stateRef.current, activeId: id })
    return true
  }
  const create = (projectId?: string) => {
    cancel()
    setError('')
    setNotice('')
    const c = newConversation(projectId)
    save({ ...stateRef.current, activeId: c.id, conversations: [c, ...stateRef.current.conversations] })
    return c.id
  }
  const openForProject = (projectId?: string) => {
    const active = stateRef.current.conversations.find(c => c.id === stateRef.current.activeId)
    const same = active?.contextProjectId === projectId ? active
      : stateRef.current.conversations.find(c => c.contextProjectId === projectId)
    if (same) { select(same.id); return same.id }
    return create(projectId)
  }
  const active = state.conversations.find(c => c.id === state.activeId)
  const setInput = (text: string) => {
    const id = stateRef.current.activeId ?? create()
    change(id, c => ({ ...c, input: text }))
  }
  const setContext = (projectId?: string) => {
    if (active) change(active.id, c => ({ ...c, contextProjectId: projectId }))
  }
  const send = async () => {
    const c = stateRef.current.conversations.find(c => c.id === stateRef.current.activeId)
    if (!c?.input.trim() || controllerRef.current) return
    if (c.input.length > 2000) { setError('一次最多输入 2000 字。'); return }
    const input = c.input.trim()
    const messageId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    change(c.id, current => ({ ...current,
      title: current.messages.length ? current.title : input.replace(/\n/g, ' ').slice(0, 28),
      messages: [...current.messages, { id: messageId, role: 'user', text: input, createdAt }],
    }))
    const controller = new AbortController()
    controllerRef.current = controller
    setProcessingId(c.id)
    setError('')
    setNotice('')
    try {
      const reply = await replyLocally(input, getSchedule(), c.contextProjectId, controller.signal)
      if (controller.signal.aborted) return
      const batch: DraftBatch = {
        id: crypto.randomUUID(), messageId, source: input, createdAt,
        status: 'pending', proposals: reply.drafts, notes: reply.notes,
      }
      change(c.id, current => ({
        ...current, input: current.input.trim() === input ? '' : current.input,
        messages: [...current.messages, { id: crypto.randomUUID(), role: 'assistant', text: reply.text, createdAt: new Date().toISOString() }],
        batches: reply.drafts.length ? [...current.batches, batch] : current.batches,
      }))
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '生成失败，输入已保留，请重试。')
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setProcessingId(undefined)
      }
    }
  }
  const editBatch = (batchId: string, proposals: ArrangementDraft[]) => {
    if (active) change(active.id, c => ({ ...c, batches: c.batches.map(b => b.id === batchId && ['pending', 'staged'].includes(b.status)
      ? { ...b, proposals, status: 'pending' } : b) }))
  }
  const stageBatch = (batchId: string) => {
    if (!active) return
    const persisted = change(active.id, c => ({ ...c, batches: c.batches.map(b => b.id === batchId && ['pending', 'staged'].includes(b.status)
      ? { ...b, status: 'staged' } : b) }))
    setNotice(persisted ? '草案已暂存到本机，可从历史会话继续。' : '暂存失败，草案仅在本次页面中保留。')
  }
  const discardBatch = (batchId: string) => {
    if (active) change(active.id, c => ({ ...c, batches: c.batches.map(b => b.id === batchId && ['pending', 'staged'].includes(b.status)
      ? { ...b, status: 'discarded' } : b) }))
  }
  const confirm = (batchId: string) => {
    if (confirming.current) return
    confirming.current = true
    setError('')
    setNotice('')
    try {
      const c = stateRef.current.conversations.find(item => item.id === stateRef.current.activeId)
      const b = c?.batches.find(item => item.id === batchId)
      if (!c || !b) throw new Error('请重新选择会话中的草案。')
      // Save stable proposal IDs before the business write. A failed receipt can be reconciled on restart.
      const result = confirmAIBatch(getSchedule(), c, b, status =>
        change(c.id, item => ({ ...item, batches: item.batches.map(batch => batch.id === b.id ? { ...batch, status } : batch) })), confirmDrafts)
      if (!result.count) { setNotice('此批次已确认，不会重复添加。'); return }
      setNotice(result.receiptSaved ? `已添加 ${result.count} 项安排，已保存到本机。`
        : '安排已保存到本机，但会话确认标记未保存；重启后会按同一建议项核对，不会重复添加。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '确认失败，草案已保留。')
    } finally { confirming.current = false }
  }
  return {
    state, active, warning, error, notice, processingId, cancel, select, create, openForProject,
    setInput, setContext, send, editBatch, stageBatch, discardBatch, confirm,
    rename: (title: string) => active && change(active.id, c => ({ ...c, title: title.trim().slice(0, 80) || '新会话' })),
    retrySave: () => save(stateRef.current),
  }
}
export type AIWorkspace = ReturnType<typeof useAIWorkspace>
