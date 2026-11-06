import dayjs, { type Dayjs } from 'dayjs'
import { validDate, validTime, type ArrangementDraft } from './schedule.ts'

export type ArrangementFormValue = Omit<ArrangementDraft, 'date' | 'time'> & {
  date: Dayjs | null
  time: Dayjs | null
}

export function toArrangementForm(draft: ArrangementDraft): ArrangementFormValue {
  return {
    ...draft,
    date: validDate(draft.date) ? dayjs(draft.date, 'YYYY-MM-DD') : null,
    time: validTime(draft.time) ? dayjs(draft.time, 'HH:mm') : null,
  }
}

export function fromArrangementForm(value: ArrangementFormValue): ArrangementDraft {
  if ((value.kind === 'event' && (!value.date?.isValid() || !value.time?.isValid()))
    || (value.date && !value.date.isValid()) || (value.time && !value.time.isValid()) || (!value.date && value.time)) {
    throw new Error('请选择有效的日期和时间。')
  }
  return {
    ...value, date: value.date?.format('YYYY-MM-DD') ?? '', time: value.time?.format('HH:mm') ?? '',
    duration: value.duration ?? 60, remind: value.remind ?? 0,
  }
}
