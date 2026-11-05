import dayjs from 'dayjs'
import { emptySchedule, type ScheduleData } from './schedule.ts'

export const PROTOTYPE_STORAGE_KEY = 'will-prototype-schedule-v01'

export function createDemoSchedule(now = new Date()): ScheduleData {
  const date = (offset: number) => dayjs(now).add(offset, 'day').format('YYYY-MM-DD')
  return {
    ...emptySchedule(),
    tasks: [
      { id: 'demo-task-1', title: '确认核心交互流程', due: date(-1), time: '18:00', projectId: 'will', done: true },
      { id: 'demo-task-2', title: '完善首页布局', due: date(0), time: '20:00', projectId: 'will', done: false },
      { id: 'demo-task-3', title: '准备原型演示', due: date(4), time: '10:00', projectId: 'will', done: false },
      { id: 'demo-task-4', title: '整理课程报告', due: date(2), time: '17:00', projectId: 'course', done: false },
      { id: 'demo-task-5', title: '整理调研反馈', due: date(5), time: '18:00', projectId: 'will', done: false },
    ],
    events: [
      { id: 'demo-event-1', title: '技术组讨论', date: date(1), time: '15:00', duration: 60, projectId: 'will', remind: 30 },
      { id: 'demo-event-2', title: '客户端演示验收', date: date(3), time: '16:00', duration: 60, projectId: 'will', remind: 60 },
    ],
  }
}
