import { useEffect, useState } from 'react'

export function useLocalNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    let timer: number
    const schedule = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(update, 1_000 - Date.now() % 1_000)
    }
    const update = () => {
      setNow(new Date())
      schedule()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible') update()
    }
    update()
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
  return now
}
