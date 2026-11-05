import { useState } from 'react'
import { decodeUpcomingDays, UPCOMING_RANGE_STORAGE_KEY, type UpcomingDays } from '../domain/dashboardPreferences'

function loadUpcomingDays() {
  try {
    return { days: decodeUpcomingDays(localStorage.getItem(UPCOMING_RANGE_STORAGE_KEY)), readFailed: false }
  } catch {
    return { days: decodeUpcomingDays(null), readFailed: true }
  }
}

export function useUpcomingDays() {
  const [initial] = useState(loadUpcomingDays)
  const [upcomingDays, setUpcomingDays] = useState<UpcomingDays>(initial.days)
  const [rangeStorageWarning, setRangeStorageWarning] = useState(initial.readFailed
    ? '无法读取本地截止范围；设置仅在本次页面中保留，请勿刷新。' : '')

  const saveUpcomingDays = (days: UpcomingDays) => {
    setUpcomingDays(days)
    try {
      localStorage.setItem(UPCOMING_RANGE_STORAGE_KEY, String(days))
      setRangeStorageWarning('')
    } catch {
      setRangeStorageWarning('浏览器无法保存截止范围，设置仅在本次页面中保留，请勿刷新。')
    }
  }

  return { upcomingDays, setUpcomingDays: saveUpcomingDays, rangeStorageWarning }
}
