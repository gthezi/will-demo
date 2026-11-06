import { useEffect, useState } from 'react'
import { parseRoute, routeHash, type WorkbenchRoute } from '../domain/navigation'
const LAST_ROUTE_KEY = 'will-workbench-route-v01'
const RECENT_PROJECT_KEY = 'will-workbench-recent-project-v01'
export function useWorkbenchRoute() {
  const [recentProjectId, setRecentProjectId] = useState(() => {
    try { return localStorage.getItem(RECENT_PROJECT_KEY) ?? undefined } catch { return undefined }
  })
  const [route, setRoute] = useState(() => {
    if (window.location.hash) return parseRoute(window.location.hash)
    try { return parseRoute(localStorage.getItem(LAST_ROUTE_KEY) ?? '') } catch { return parseRoute('') }
  })
  useEffect(() => {
    const changed = () => {
      const next = parseRoute(window.location.hash)
      setRoute(next)
      try {
        localStorage.setItem(LAST_ROUTE_KEY, routeHash(next))
        if (next.page === 'projects' && next.projectId) {
          localStorage.setItem(RECENT_PROJECT_KEY, next.projectId)
          setRecentProjectId(next.projectId)
        }
      } catch { /* Business data warnings are handled by useSchedule. */ }
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  const navigate = (next: WorkbenchRoute) => {
    setRoute(next)
    window.location.hash = routeHash(next)
    if (next.page === 'projects' && next.projectId) {
      setRecentProjectId(next.projectId)
      try { localStorage.setItem(RECENT_PROJECT_KEY, next.projectId) } catch { /* Route state remains available in memory. */ }
    }
    window.scrollTo(0, 0)
  }
  return { route, navigate, recentProjectId }
}
