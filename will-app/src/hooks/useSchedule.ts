import { useRef, useState } from 'react'
import {
  addDrafts, decodeSchedule, deleteArrangement, emptySchedule, SCHEDULE_STORAGE_KEY, updateArrangement,
  type ArrangementDraft, type ScheduleData,
} from '../domain/schedule'
import { addProject, renameProject, setProjectArchived, type ProjectId } from '../domain/projects'

function loadSchedule(storageKey: string) {
  try {
    const saved = localStorage.getItem(storageKey)
      ?? (storageKey !== SCHEDULE_STORAGE_KEY ? localStorage.getItem(SCHEDULE_STORAGE_KEY) : null)
    return { data: saved ? decodeSchedule(saved) : emptySchedule(), readFailed: false }
  } catch {
    return { data: emptySchedule(), readFailed: true }
  }
}

export function useSchedule(storageKey = SCHEDULE_STORAGE_KEY) {
  const [initial] = useState(() => loadSchedule(storageKey))
  const [data, setData] = useState(initial.data)
  const dataRef = useRef(data)
  const [storageWarning, setStorageWarning] = useState(initial.readFailed
    ? '无法读取本地安排；修改仅在本次页面中保留，请勿刷新。'
    : '')

  const save = (next: ScheduleData) => {
    let persisted = false
    if (!initial.readFailed) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
        persisted = true
      } catch {
        setStorageWarning('浏览器无法保存安排，修改仅在本次页面中保留，请勿刷新。')
      }
    }
    if (persisted) setStorageWarning('')
    dataRef.current = next
    setData(next)
    return persisted
  }

  const confirmDrafts = (drafts: ArrangementDraft[]) => {
    const next = addDrafts(dataRef.current, drafts)
    return save(next)
  }

  const toggleTask = (id: string, done: boolean) => {
    const current = dataRef.current
    save({ ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, done } : task) })
  }

  const updateItem = (draft: ArrangementDraft) => save(updateArrangement(dataRef.current, draft))
  const deleteItem = (id: string) => save(deleteArrangement(dataRef.current, id))
  const createProject = (id: ProjectId, name: string) => {
    const current = dataRef.current
    return save({ ...current, projects: addProject(current.projects, id, name) })
  }
  const updateProjectName = (id: ProjectId, name: string) => {
    const current = dataRef.current
    return save({ ...current, projects: renameProject(current.projects, id, name) })
  }
  const archiveProject = (id: ProjectId, archived: boolean) => {
    const current = dataRef.current
    return save({ ...current, projects: setProjectArchived(current.projects, id, archived) })
  }
  const replaceSchedule = (next: ScheduleData) => save(decodeSchedule(JSON.stringify(next)))

  return {
    data, storageWarning, confirmDrafts, toggleTask, updateItem, deleteItem,
    createProject, updateProjectName, archiveProject, replaceSchedule,
  }
}
