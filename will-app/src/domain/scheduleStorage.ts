import { decodeSchedule, emptySchedule, SCHEDULE_STORAGE_KEY, WORKBENCH_STORAGE_KEY, type ScheduleData } from './schedule.ts'

export const LEGACY_PROTOTYPE_KEY = 'will-prototype-schedule-v01'
const STORAGE_KEYS = [WORKBENCH_STORAGE_KEY, LEGACY_PROTOTYPE_KEY, SCHEDULE_STORAGE_KEY]
type StorageReader = Pick<Storage, 'getItem'>
type ScheduleStorage = Pick<Storage, 'getItem' | 'setItem'>

function findLegacySchedule(storage: Pick<Storage, 'getItem'>, corruptKey: string) {
  const start = STORAGE_KEYS.indexOf(corruptKey)
  if (start < 0) return null
  for (const key of STORAGE_KEYS.slice(start + 1)) {
    const saved = storage.getItem(key)
    if (saved === null) continue
    try { return { key, data: decodeSchedule(saved) } } catch { /* Keep looking for a valid older copy. */ }
  }
  return null
}

export function loadSchedule(storage: StorageReader) {
  for (const key of STORAGE_KEYS) {
    try {
      const saved = storage.getItem(key)
      if (saved === null) continue
      try {
        return { data: decodeSchedule(saved), readFailed: false, sourceKey: key, corruptKey: null, recoveryAvailable: false }
      } catch {
        const recoveryAvailable = !!findLegacySchedule(storage, key)
        return { data: emptySchedule(), readFailed: true, sourceKey: null, corruptKey: key, recoveryAvailable }
      }
    } catch {
      return { data: emptySchedule(), readFailed: true, sourceKey: null, corruptKey: null, recoveryAvailable: false }
    }
  }
  return { data: emptySchedule(), readFailed: false, sourceKey: null, corruptKey: null, recoveryAvailable: false }
}

export function persistSchedule(storage: Pick<Storage, 'setItem'>, data: ScheduleData) {
  storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(data))
}

export function recoverSchedule(storage: ScheduleStorage, now = Date.now()) {
  const loaded = loadSchedule(storage)
  if (!loaded.readFailed || !loaded.corruptKey) throw new Error('没有可恢复的损坏安排。')
  const fallback = findLegacySchedule(storage, loaded.corruptKey)
  if (!fallback) throw new Error('没有找到有效的旧版安排，原始数据未更改。')

  const damaged = storage.getItem(loaded.corruptKey)
  if (damaged === null) throw new Error('损坏数据已变化，原始数据未更改。')
  const base = `${loaded.corruptKey}.corrupt-${now}`
  let backupKey = base
  let suffix = 1
  while (storage.getItem(backupKey) !== null) backupKey = `${base}-${suffix++}`
  storage.setItem(backupKey, damaged)
  persistSchedule(storage, fallback.data)
  return { data: fallback.data, sourceKey: fallback.key, backupKey }
}
