import { decodeSchedule, emptySchedule, SCHEDULE_STORAGE_KEY, WORKBENCH_STORAGE_KEY, type ScheduleData } from './schedule.ts'

export const LEGACY_PROTOTYPE_KEY = 'will-prototype-schedule-v01'
type StorageReader = Pick<Storage, 'getItem'>

export function loadSchedule(storage: StorageReader) {
  try {
    for (const key of [WORKBENCH_STORAGE_KEY, LEGACY_PROTOTYPE_KEY, SCHEDULE_STORAGE_KEY]) {
      const saved = storage.getItem(key)
      if (saved !== null) return { data: decodeSchedule(saved), readFailed: false, sourceKey: key }
    }
    return { data: emptySchedule(), readFailed: false, sourceKey: null }
  } catch {
    // Never fall through damaged current data to an older, misleading snapshot.
    return { data: emptySchedule(), readFailed: true, sourceKey: null }
  }
}

export function persistSchedule(storage: Pick<Storage, 'setItem'>, data: ScheduleData) {
  storage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(data))
}
