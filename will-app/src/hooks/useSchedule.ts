import { useRef, useState } from 'react'
import {
  addDrafts, decodeSchedule, deleteArrangement, updateArrangement, setTaskStatus,
  type ArrangementDraft, type ScheduleData, type TaskStatus,
} from '../domain/schedule'
import { addProjectFromTemplate, renameProject, setProjectArchived, setProjectViews, type ProjectId, type ProjectTemplate, type ProjectView } from '../domain/projects'
import { loadSchedule, persistSchedule } from '../domain/scheduleStorage'

export function useSchedule() {
  const [initial] = useState(() => loadSchedule(localStorage))
  const [data, setData] = useState(initial.data)
  const dataRef = useRef(data)
  const [storageWarning, setStorageWarning] = useState(initial.readFailed
    ? '无法读取本地安排；修改仅在本次页面中保留，请勿刷新。'
    : '')

  const save = (next: ScheduleData) => {
    let persisted = false
    if (!initial.readFailed) {
      try {
        persistSchedule(localStorage, next)
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
    save(setTaskStatus(dataRef.current, id, done ? 'done' : 'todo'))
  }
  const updateTaskStatus = (id: string, status: TaskStatus) => save(setTaskStatus(dataRef.current, id, status))
  const updateProjectViews = (id: ProjectId, views: ProjectView[]) => {
    const current = dataRef.current
    return save({ ...current, projects: setProjectViews(current.projects, id, views) })
  }

  const updateItem = (draft: ArrangementDraft) => save(updateArrangement(dataRef.current, draft))
  const deleteItem = (id: string) => save(deleteArrangement(dataRef.current, id))
  const createProject = (id: ProjectId, name: string, template: ProjectTemplate = 'standard', description = '') => {
    const current = dataRef.current
    return save({ ...current, projects: addProjectFromTemplate(current.projects, id, name, template, description) })
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
    data, storageWarning, confirmDrafts, toggleTask, updateTaskStatus, updateProjectViews, updateItem, deleteItem,
    createProject, updateProjectName, archiveProject, replaceSchedule,
  }
}
