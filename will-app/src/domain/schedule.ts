import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { defaultProjects, validProjectId, validProjects, type Project, type ProjectId } from './projects.ts'

export type { ProjectId } from './projects.ts'

dayjs.extend(customParseFormat)

export const SCHEDULE_STORAGE_KEY = 'will-react-schedule-v01'
export type ItemKind = 'event' | 'task'

export type ArrangementDraft = {
  id: string
  kind: ItemKind
  title: string
  date: string
  time: string
  projectId: ProjectId
  remind: number
  duration: number
}

type BaseItem = {
  id: string
  title: string
  time: string
  projectId: ProjectId
}
export type Task = BaseItem & { due: string; done: boolean }
export type CalendarEvent = BaseItem & { date: string; duration: number; remind: number }
export type ScheduleData = { version: 2; projects: Project[]; tasks: Task[]; events: CalendarEvent[] }
export type DisplayItem = {
  id: string
  kind: ItemKind
  title: string
  date: string
  time: string
  projectId: ProjectId
  done?: boolean
  duration?: number
  remind?: number
}

export function scheduleItems(data: ScheduleData): DisplayItem[] {
  const items: DisplayItem[] = [
    ...data.events.map(event => ({ ...event, kind: 'event' as const })),
    ...data.tasks.map(task => ({ ...task, date: task.due, kind: 'task' as const })),
  ]
  return items.sort((a, b) => Number(!!a.done) - Number(!!b.done)
    || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

export function emptySchedule(): ScheduleData {
  return { version: 2, projects: defaultProjects(), tasks: [], events: [] }
}

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && dayjs(value, 'YYYY-MM-DD', true).isValid()
}

export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function validBase(item: unknown): item is BaseItem {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  return typeof value.id === 'string' && !!value.id.trim()
    && typeof value.title === 'string' && !!value.title.trim() && value.title.length <= 80
    && validTime(value.time) && validProjectId(value.projectId)
}

function validEvent(item: unknown): item is CalendarEvent {
  if (!validBase(item)) return false
  const value = item as CalendarEvent
  return validDate(value.date) && Number.isInteger(value.duration)
    && value.duration >= 15 && value.duration <= 1440 && [0, 10, 30, 60].includes(value.remind)
}

function validTask(item: unknown): item is Task {
  if (!validBase(item)) return false
  const value = item as Task
  return validDate(value.due) && typeof value.done === 'boolean'
}

export function decodeSchedule(text: string): ScheduleData {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object') throw new Error('本地安排格式无效')
  const data = value as Record<string, unknown>
  if (![1, 2].includes(data.version as number) || !Array.isArray(data.tasks) || !Array.isArray(data.events)
    || !data.tasks.every(validTask) || !data.events.every(validEvent)) {
    throw new Error('本地安排格式无效')
  }
  const ids = [...data.tasks, ...data.events].map(item => item.id)
  if (new Set(ids).size !== ids.length) throw new Error('本地安排编号重复')
  // Upgrade the original three project IDs in memory; persist only on an explicit change.
  const projects = data.version === 1 ? defaultProjects() : data.projects
  if (!validProjects(projects)
    || [...data.tasks, ...data.events].some(item => !projects.some(project => project.id === item.projectId))) {
    throw new Error('本地项目格式或事项归属无效')
  }
  return { version: 2, projects, tasks: data.tasks, events: data.events }
}

export function validateDraft(draft: ArrangementDraft) {
  if (!validBase(draft) || !validDate(draft.date)
    || !['event', 'task'].includes(draft.kind)
    || (draft.kind === 'event' && !validEvent(draft))) {
    throw new Error('请检查草案的标题、日期、时间和时长')
  }
}

export function getArrangementDraft(data: ScheduleData, id: string): ArrangementDraft {
  const event = data.events.find(item => item.id === id)
  if (event) return { ...event, kind: 'event' }
  const task = data.tasks.find(item => item.id === id)
  if (task) {
    return {
      id: task.id, kind: 'task', title: task.title, date: task.due, time: task.time,
      projectId: task.projectId, duration: 60, remind: 0,
    }
  }
  throw new Error('事项已不存在，请关闭后重新选择。')
}

export function updateArrangement(data: ScheduleData, draft: ArrangementDraft): ScheduleData {
  validateDraft(draft)
  const previous = getArrangementDraft(data, draft.id)
  const previousTask = data.tasks.find(item => item.id === draft.id)
  const remaining = {
    ...data,
    events: data.events.filter(item => item.id !== draft.id),
    tasks: data.tasks.filter(item => item.id !== draft.id),
  }
  const next = appendDrafts(remaining, [draft], previous.projectId)
  if (draft.kind === 'task' && previousTask) {
    next.tasks.find(item => item.id === draft.id)!.done = previousTask.done
  }
  return next
}

export function deleteArrangement(data: ScheduleData, id: string): ScheduleData {
  getArrangementDraft(data, id)
  return {
    ...data,
    events: data.events.filter(item => item.id !== id),
    tasks: data.tasks.filter(item => item.id !== id),
  }
}

// Validate the whole batch before adding anything; draft IDs also make retries idempotent.
export function addDrafts(data: ScheduleData, drafts: ArrangementDraft[]): ScheduleData {
  return appendDrafts(data, drafts)
}

function appendDrafts(data: ScheduleData, drafts: ArrangementDraft[], retainedProjectId?: ProjectId): ScheduleData {
  if (!drafts.length) throw new Error('请先生成草案')
  const batchIds = new Set<string>()
  for (const draft of drafts) {
    validateDraft(draft)
    const project = data.projects.find(project => project.id === draft.projectId)
    if (!project || (project.archived && project.id !== retainedProjectId)) {
      throw new Error('请选择进行中的项目；归档项目须恢复后才能添加安排。')
    }
    if (batchIds.has(draft.id)) {
      throw new Error('请检查草案的标题、日期、时间和时长')
    }
    batchIds.add(draft.id)
  }
  const next: ScheduleData = { ...data, tasks: [...data.tasks], events: [...data.events] }
  const existingIds = new Set([...data.tasks, ...data.events].map(item => item.id))
  for (const draft of drafts) {
    if (existingIds.has(draft.id)) continue
    const base = {
      id: draft.id, title: draft.title.trim(), time: draft.time, projectId: draft.projectId,
    }
    if (draft.kind === 'event') {
      next.events.push({ ...base, date: draft.date, duration: draft.duration, remind: draft.remind })
    } else {
      next.tasks.push({ ...base, due: draft.date, done: false })
    }
  }
  return next
}
