import { draftService } from './draftService.ts'
import type { ScheduleData, ArrangementDraft } from '../domain/schedule.ts'

export const shortcutPrompts = {
  notice: '整理通知：\n',
  breakdown: '拆解任务：',
}
export type AIReply = { text: string; drafts: ArrangementDraft[]; notes: string[] }
export async function replyLocally(text: string, data: ScheduleData, projectId: string | undefined, signal: AbortSignal): Promise<AIReply> {
  const project = data.projects.find(p => p.id === projectId)
  const matching = data.projects.filter(p => !p.archived && text.includes(p.name))
  const targetId = projectId ?? (matching.length === 1 ? matching[0].id : undefined)
  const context = project ? `参考「${project.name}」现有 ${data.tasks.filter(t => t.projectId === projectId).length} 项任务、${data.events.filter(e => e.projectId === projectId).length} 项日程。` : ''
  if (/^(拆解任务|帮我拆解|拆解目标)[：:\s]/.test(text)) {
    const goal = text.replace(/^(拆解任务|帮我拆解|拆解目标)[：:\s]*/, '').trim()
    if (!goal) throw new Error('请补充要拆解的目标。')
    await delay(signal)
    const short = goal.slice(0, 45)
    return {
      text: `${context}按本地固定步骤给出 3 项起草建议，尚未写入项目。未推断截止日期，请按实际情况核对。`,
      drafts: ['明确目标与要求', '完成第一版', '检查并提交'].map(step => ({
        id: crypto.randomUUID(), kind: 'task', title: `${step}：${short}`,
        date: '', time: '', projectId: targetId ?? '', status: 'todo', duration: 60, remind: 0,
        description: `原目标：${goal}`,
      })), notes: ['此为固定步骤模板，不是模型推理。可修改、移除并自行设置截止日期。'],
    }
  }
  const notice = /^(整理通知|整理安排)[：:\s]/.test(text)
  const source = text.replace(/^(整理通知|整理安排)[：:\s]*/, '').trim()
  if (notice && !source) throw new Error('请粘贴需要整理的通知原文。')
  if (notice || /提交|组会|讲座|上课|会议|面试|截止|作业|报名表/.test(text)) {
    const result = await draftService.extract(source, signal)
    return {
      text: `${context}已按本地日期与关键词规则整理 ${result.drafts.length} 项建议。请核对原文、日期和归属，确认前不会创建安排。`,
      drafts: result.drafts.map(p => ({ ...p, status: 'todo', projectId: targetId ?? '' })), notes: result.notes,
    }
  }
  await delay(signal)
  const overview = /进度|有哪些任务|当前任务|项目情况/.test(text) && project
  return {
    text: overview
      ? `${context}\n${data.tasks.filter(t => t.projectId === projectId).slice(0, 8).map(t => `• ${t.title}${t.due ? `（${t.due}）` : '（无截止日期）'}`).join('\n') || '当前还没有任务。'}\n仅按项目 ID 读取本地记录，未读取资料。`
      : '当前是本地规则模拟，不能提供通用大模型问答。可以粘贴明确的通知，或输入“拆解任务：你的目标”；也可以在项目会话里询问“当前任务”。',
    drafts: [], notes: [],
  }
}
function delay(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const cancel = () => { clearTimeout(timer); reject(new DOMException('已取消生成', 'AbortError')) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve() }, 300)
    signal.addEventListener('abort', cancel, { once: true })
    if (signal.aborted) cancel()
  })
}
