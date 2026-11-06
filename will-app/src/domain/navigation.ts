export type WorkbenchRoute = { page: 'home' | 'projects' | 'calendar' | 'settings' | 'ai'; projectId?: string; tab?: string; date?: string; conversationId?: string }
const tabs = ['overview', 'tasks', 'materials', 'paper', 'workflow', 'collaboration']
export function parseRoute(hash: string): WorkbenchRoute {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [path, query] = (raw.startsWith('/') ? raw.slice(1) : raw).split('?')
  const parts = path.split('/')
  if (parts[0] === 'ai') {
    try { return { page: 'ai', ...(parts[1] ? { conversationId: decodeURIComponent(parts[1]) } : {}) } }
    catch { return { page: 'ai' } }
  }
  if (parts[0] === 'projects') {
    try { return { page: 'projects', ...(parts[1] ? { projectId: decodeURIComponent(parts[1]), tab: tabs.includes(parts[2]) ? parts[2] : 'overview' } : {}) } }
    catch { return { page: 'projects' } }
  }
  if (parts[0] === 'calendar') return { page: 'calendar', date: new URLSearchParams(query).get('date') ?? undefined }
  return { page: parts[0] === 'settings' ? 'settings' : 'home' }
}
export function routeHash(route: WorkbenchRoute) {
  if (route.page === 'ai' && route.conversationId) return `#/ai/${encodeURIComponent(route.conversationId)}`
  if (route.page === 'projects' && route.projectId) return `#/projects/${encodeURIComponent(route.projectId)}/${route.tab ?? 'overview'}`
  if (route.page === 'calendar' && route.date) return `#/calendar?date=${encodeURIComponent(route.date)}`
  return `#/${route.page}`
}
