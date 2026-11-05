export type ProjectId = string
export type Project = { id: ProjectId; name: string; archived: boolean }

export function defaultProjects(): Project[] {
  return [
    { id: 'will', name: 'Will 客户端', archived: false },
    { id: 'course', name: '课程与学习', archived: false },
    { id: 'personal', name: '个人事务', archived: false },
  ]
}

export function validProjectId(value: unknown): value is ProjectId {
  return typeof value === 'string' && !!value.trim()
}

const nameKey = (name: string) => name.trim().toLocaleLowerCase()

export function validProjects(value: unknown): value is Project[] {
  if (!Array.isArray(value)) return false
  if (!value.every(project => project && validProjectId(project.id)
    && typeof project.name === 'string' && !!project.name.trim() && project.name.length <= 40
    && typeof project.archived === 'boolean')) return false
  return new Set(value.map(project => project.id)).size === value.length
    && new Set(value.map(project => nameKey(project.name))).size === value.length
}

export function projectName(projects: Project[], id: ProjectId) {
  return projects.find(project => project.id === id)?.name ?? '未知项目'
}

export function defaultProjectId(projects: Project[]): ProjectId {
  return projects.find(project => project.id === 'personal' && !project.archived)?.id
    ?? projects.find(project => !project.archived)?.id ?? ''
}

export function validateProjectName(projects: Project[], name: string, exceptId?: ProjectId) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 40) throw new Error('项目名称请填写 1–40 字。')
  if (projects.some(project => project.id !== exceptId && nameKey(project.name) === nameKey(trimmed))) {
    throw new Error('项目名称已存在，请换一个名称，或恢复同名的归档项目。')
  }
  return trimmed
}

export function addProject(projects: Project[], id: ProjectId, name: string): Project[] {
  if (!validProjectId(id) || projects.some(project => project.id === id)) throw new Error('项目编号无效或已存在。')
  return [...projects, { id, name: validateProjectName(projects, name), archived: false }]
}

export function renameProject(projects: Project[], id: ProjectId, name: string): Project[] {
  if (!projects.some(project => project.id === id)) throw new Error('项目已不存在。')
  const trimmed = validateProjectName(projects, name, id)
  return projects.map(project => project.id === id ? { ...project, name: trimmed } : project)
}

export function setProjectArchived(projects: Project[], id: ProjectId, archived: boolean): Project[] {
  if (!projects.some(project => project.id === id)) throw new Error('项目已不存在。')
  return projects.map(project => project.id === id ? { ...project, archived } : project)
}
