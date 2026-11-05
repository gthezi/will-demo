export const UPCOMING_RANGE_STORAGE_KEY = 'will-react-upcoming-range-v01'
export const DEFAULT_UPCOMING_DAYS = 3
export const UPCOMING_RANGE_OPTIONS = [3, 7, 14, 30] as const

export type UpcomingDays = typeof UPCOMING_RANGE_OPTIONS[number]

export function isUpcomingDays(value: unknown): value is UpcomingDays {
  return UPCOMING_RANGE_OPTIONS.includes(value as UpcomingDays)
}

export function decodeUpcomingDays(saved: string | null): UpcomingDays {
  try {
    const value: unknown = saved === null ? null : JSON.parse(saved)
    return isUpcomingDays(value) ? value : DEFAULT_UPCOMING_DAYS
  } catch {
    return DEFAULT_UPCOMING_DAYS
  }
}
