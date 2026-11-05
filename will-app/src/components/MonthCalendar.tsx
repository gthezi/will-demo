import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import dayjs, { type Dayjs } from 'dayjs'
import { useState } from 'react'
import type { DisplayItem } from '../domain/schedule'
import { useLocalNow } from '../hooks/useLocalNow'
import './MonthCalendar.css'

type MonthCalendarProps = {
  selectedDate: string
  onSelect: (date: string) => void
  items: DisplayItem[]
  expanded?: boolean
}

export function MonthCalendar({ selectedDate, onSelect, items, expanded = false }: MonthCalendarProps) {
  const [view, setView] = useState(() => ({ selectedDate, month: dayjs(selectedDate).startOf('month') }))
  if (view.selectedDate !== selectedDate) {
    setView({ selectedDate, month: dayjs(selectedDate).startOf('month') })
  }
  const month = view.month
  const setMonth = (month: Dayjs) => setView({ selectedDate, month })
  const now = useLocalNow()
  const today = dayjs(now).format('YYYY-MM-DD')
  const start = month.subtract((month.day() + 6) % 7, 'day')
  const count = expanded || month.daysInMonth() + (month.day() + 6) % 7 > 35 ? 42 : 35
  return (
    <div className={`will-month-calendar${expanded ? ' is-expanded' : ''}`}>
      <div className="will-month-toolbar">
        <strong>{month.format('YYYY 年 M 月')}</strong>
        <div>
          <Button type="text" icon={<LeftOutlined />} aria-label="上个月" onClick={() => setMonth(month.subtract(1, 'month'))} />
          <Button type="text" onClick={() => { setMonth(dayjs(now).startOf('month')); onSelect(today) }}>今天</Button>
          <Button type="text" icon={<RightOutlined />} aria-label="下个月" onClick={() => setMonth(month.add(1, 'month'))} />
        </div>
      </div>
      <div className="will-month-grid" aria-label={expanded ? '日历月视图' : '本月日历'}>
        {[...'一二三四五六日'].map(day => <span className="will-weekday" key={day}>{day}</span>)}
        {Array.from({ length: count }, (_, index) => {
          const date = start.add(index, 'day')
          const key = date.format('YYYY-MM-DD')
          const dayItems = items.filter(item => item.date === key)
          return (
            <button key={key} type="button" aria-label={`${key}，${dayItems.length} 项安排`}
              aria-pressed={key === selectedDate}
              className={`will-calendar-day${date.month() !== month.month() ? ' is-other-month' : ''}${key === selectedDate ? ' is-selected' : ''}${key === today ? ' is-today' : ''}`}
              onClick={() => { setMonth(date.startOf('month')); onSelect(key) }}>
              <span className="will-date-number">{date.date()}</span>
              {expanded ? (
                <span className="will-calendar-entries">
                  {dayItems.slice(0, 2).map(item => <span key={item.id} title={item.title}
                    className={`will-calendar-entry ${item.kind}${item.done ? ' is-done' : ''}`}>{item.title}</span>)}
                  {dayItems.length > 2 && <span className="will-calendar-more">+{dayItems.length - 2}</span>}
                </span>
              ) : (
                <span className="will-calendar-dots">
                  {dayItems.some(item => item.kind === 'event') && <i />}
                  {dayItems.some(item => item.kind === 'task') && <i className="task" />}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
