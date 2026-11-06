import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat.js'
import { defaultProjects, validProjectId, validProjects, type Project, type ProjectId } from './projects.ts'

export type { ProjectId } from './projects.ts'

dayjs.extend(customParseFormat)

export const SCHEDULE_STORAGE_KEY = 'will-react-schedule-v01'
export const WORKBENCH_STORAGE_KEY = 'will-workbench-schedule-v03'
export type ItemKind = 'event' | 'task'
export type AISource = { conversationId: string; batchId: string; messageId: string; input: string }

export type ArrangementDraft = {
  id: string
  kind: ItemKind
  title: string
  date: string
  time: string
  projectId: ProjectId
  remind: number
  duration: number
  description?: string
  status?: TaskStatus
  source?: AISource
}

type BaseItem = {
  id: string
  title: string
  time: string
  projectId: ProjectId
  source?: AISource
}
export type TaskStatus = 'todo' | 'in_progress' | 'done'
export type Task = Omit<BaseItem, 'time'> & {
  due?: string
  time?: string
  done?: boolean
  status?: TaskStatus
  description?: string
  archived?: boolean
}
export type CalendarEvent = BaseItem & { date: string; duration: number; remind: number }
export type ScheduleData = { version: 3; projects: Project[]; tasks: Task[]; events: CalendarEvent[] }
export type DisplayItem = {
  id: string
  kind: ItemKind
  title: string
  date: string
  time: string
  projectId: ProjectId
  done?: boolean
  taskStatus?: TaskStatus
  duration?: number
  remind?: number
  source?: AISource
}

export function allScheduleItems(data: ScheduleData): DisplayItem[] {
  const items: DisplayItem[] = [
    ...data.events.map(event => ({ ...event, kind: 'event' as const })),
    ...data.tasks.map(task => ({
      ...task, date: task.due ?? '', time: task.time ?? '', done: taskStatus(task) === 'done', taskStatus: taskStatus(task), kind: 'task' as const,
    })),
  ]
  return items.sort((a, b) => Number(!!a.done) - Number(!!b.done)
    || `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
}

export function scheduleItems(data: ScheduleData): DisplayItem[] {
  return allScheduleItems(data).filter(item => !!item.date)
}

export function emptySchedule(): ScheduleData {
  return { version: 3, projects: defaultProjects(), tasks: [], events: [] }
}

export function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && dayjs(value, 'YYYY-MM-DD', true).isValid()
}

export function validTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function validSource(source: unknown) {
  if (source === undefined) return true
  if (!source || typeof source !== 'object') return false
  const value = source as Record<string, unknown>
  return ['conversationId', 'batchId', 'messageId', 'input'].every(key => typeof value[key] === 'string' && !!value[key])
}

function validBase(item: unknown): item is BaseItem {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  return typeof value.id === 'string' && !!value.id.trim()
    && typeof value.title === 'string' && !!value.title.trim() && value.title.length <= 80
    && validTime(value.time) && validProjectId(value.projectId) && validSource(value.source)
}

function validEvent(item: unknown): item is CalendarEvent {
  if (!validBase(item)) return false
  const value = item as CalendarEvent
  return validDate(value.date) && Number.isInteger(value.duration)
    && value.duration >= 15 && value.duration <= 1440 && [0, 10, 30, 60].includes(value.remind)
}

function validTask(item: unknown): item is Task {
  if (!item || typeof item !== 'object') return false
  const value = item as Record<string, unknown>
  const date = value.due
  const status = value.status ?? (value.done ? 'done' : 'todo')
  return typeof value.id === 'string' && !!value.id.trim()
    && typeof value.title === 'string' && !!value.title.trim() && value.title.length <= 80
    && validProjectId(value.projectId)
    && (date === undefined || date === '' || validDate(date))
    && (value.time === undefined || value.time === '' || validTime(value.time))
    && (!value.time || !!date)
    && ['todo', 'in_progress', 'done'].includes(String(status))
    && (value.done === undefined || typeof value.done === 'boolean')
    && (value.description === undefined || typeof value.description === 'string')
    && (value.archived === undefined || typeof value.archived === 'boolean')
    && validSource(value.source)
}

export function decodeSchedule(text: string): ScheduleData {
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object') throw new Error('本地安排格式无效')
  const data = value as Record<string, unknown>
  if (![1, 2, 3].includes(data.version as number) || !Array.isArray(data.tasks) || !Array.isArray(data.events)
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
  const tasks = data.tasks.map(raw => {
    const task = raw as Task
    const status = task.status ?? (task.done ? 'done' : 'todo')
    return data.version === 3 ? task : { ...task, status, done: status === 'done' }
  })
  return { version: 3, projects, tasks, events: data.events }
}

export function validateDraft(draft: ArrangementDraft) {
  if (!validBase({ ...draft, time: draft.time || '00:00' })
    || !['event', 'task'].includes(draft.kind)
    || (draft.kind === 'event' && (!validDate(draft.date) || !validTime(draft.time) || !validEvent(draft)))
    || (draft.kind === 'task' && ((draft.date !== '' && !validDate(draft.date))
      || (draft.time !== '' && !validTime(draft.time)) || (!draft.date && draft.time)))) {
    throw new Error('请检查草案的标题、日期、时间和时长')
  }
  if (draft.status !== undefined && !['todo', 'in_progress', 'done'].includes(draft.status))
    throw new Error('任务状态无效。')
}

export function getArrangementDraft(data: ScheduleData, id: string): ArrangementDraft {
  const event = data.events.find(item => item.id === id)
  if (event) return { ...event, kind: 'event' }
  const task = data.tasks.find(item => item.id === id)
  if (task) {
    return {
      id: task.id, kind: 'task', title: task.title, date: task.due ?? '', time: task.time ?? '',
      projectId: task.projectId, duration: 60, remind: 0,
      description: task.description ?? '', status: taskStatus(task),
      ...(task.source ? { source: task.source } : {}),
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
  const next = appendDrafts(remaining, [{ ...draft, ...(previous.source ? { source: previous.source } : {}) }], previous.projectId)
  if (draft.kind === 'task' && previousTask) {
    const task = next.tasks.find(item => item.id === draft.id)!
    task.status = draft.status ?? taskStatus(previousTask)
    task.done = task.status === 'done'
    if (previousTask.archived !== undefined) task.archived = previousTask.archived
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

export function setTaskStatus(data: ScheduleData, id: string, status: TaskStatus): ScheduleData {
  if (!['todo', 'in_progress', 'done'].includes(status)) throw new Error('任务状态无效。')
  let found = false
  const tasks = data.tasks.map(task => {
    if (task.id !== id) return task
    found = true
    return { ...task, status, done: status === 'done' }
  })
  if (!found) throw new Error('任务已不存在。')
  return { ...data, tasks }
}

export function taskStatus(task: Task): TaskStatus {
  return task.done || task.status === 'done' ? 'done' : task.status === 'in_progress' ? 'in_progress' : 'todo'
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
      ...(draft.source ? { source: draft.source } : {}),
    }
    if (draft.kind === 'event') {
      next.events.push({ ...base, date: draft.date, duration: draft.duration, remind: draft.remind })
    } else {
      next.tasks.push({
        id: base.id, title: base.title, projectId: base.projectId,
        ...(base.source ? { source: base.source } : {}),
        ...(draft.date ? { due: draft.date } : {}), ...(draft.time ? { time: draft.time } : {}),
        ...(draft.description ? { description: draft.description.trim() } : {}),
        status: draft.status ?? 'todo', done: draft.status === 'done',
      })
    }
  }
  return next
}
