import dayjs, { type Dayjs } from 'dayjs'
import { validDate, type ArrangementDraft } from '../domain/schedule.ts'

export type DraftResult = { drafts: ArrangementDraft[]; notes: string[] }
export interface DraftService {
  extract(text: string, signal: AbortSignal): Promise<DraftResult>
}

const numberMap: Record<string, number> = {
  零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9,
}

function chineseNumber(value: string): number {
  if (/^\d+$/.test(value)) return Number(value)
  if (value.includes('十')) {
    const [tens, units] = value.split('十')
    return (tens ? numberMap[tens] : 1) * 10 + (units ? numberMap[units] : 0)
  }
  return numberMap[value] ?? NaN
}

function dateFromText(text: string, now: Dayjs): string | undefined {
  const numeric = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  const chinese = text.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})[日号]?/)
  const match = numeric ?? chinese
  if (match) {
    const date = `${match[1] || now.year()}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
    if (!validDate(date)) throw new Error('日期不存在，请检查月份和日期后重新整理。')
    return date
  }
  for (const [word, offset] of [['大后天', 3], ['后天', 2], ['明天', 1], ['今天', 0], ['今晚', 0]] as const) {
    if (text.includes(word)) return now.add(offset, 'day').format('YYYY-MM-DD')
  }
  const weekday = text.match(/(下|本|这)?(?:周|星期|礼拜)([一二三四五六日天])/)
  if (weekday) {
    const target = '一二三四五六日'.indexOf(weekday[2].replace('天', '日'))
    const current = (now.day() + 6) % 7
    const offset = weekday[1] === '下' ? 7 + target - current
      : weekday[1] ? target - current : (target - current + 7) % 7
    return now.add(offset, 'day').format('YYYY-MM-DD')
  }
  return undefined
}

type Period = string | undefined
function timesFromText(text: string, inherited: Period) {
  const pattern = /(上午|下午|早上|中午|晚上|晚间|凌晨)?\s*([零一二两三四五六七八九十\d]{1,3})(?:(?:点|时)(?:半|\s*([零一二两三四五六七八九十\d]{1,3})分?)?|[:：](\d{2}))/g
  let period = inherited
  const times: string[] = []
  for (const match of text.matchAll(pattern)) {
    period = match[1] || period
    let hour = chineseNumber(match[2])
    const minutes = match[0].includes('半') ? 30 : match[3] ? chineseNumber(match[3]) : Number(match[4] || 0)
    if (hour < 12 && /下午|晚上|晚间/.test(period || '')) hour += 12
    if (hour < 11 && period === '中午') hour += 12
    if (hour === 12 && /凌晨|晚上|晚间/.test(period || '')) hour = 0
    if (!Number.isInteger(hour) || hour > 23 || !Number.isInteger(minutes) || minutes > 59) {
      throw new Error('时间无效，请使用有效的小时和分钟后重新整理。')
    }
    // Bare Chinese hours are ambiguous; require an explicit choice in the draft.
    times.push(!period && !match[4] && hour < 12 ? '' : `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`)
  }
  return { times, period }
}

function reminderFromText(text: string): number | undefined {
  if (/提前(?:一|1)\s*小时/.test(text)) return 60
  if (/提前(?:半小时|30\s*分钟|三十分钟)/.test(text)) return 30
  if (/提前(?:10|十)\s*分钟/.test(text)) return 10
  return undefined
}

export function extractDrafts(text: string, now = dayjs()): DraftResult {
  const source = text.trim()
  if (!source) throw new Error('先输入要安排的事情。')
  if (source.length > 2000) throw new Error('一次最多整理 2000 字，请分次输入。')
  const drafts: ArrangementDraft[] = []
  const notes = new Set<string>()
  let date = ''
  let period: Period
  for (const clause of source.split(/[，,；;。\n]+/).map(value => value.trim()).filter(Boolean)) {
    const explicitDate = dateFromText(clause, now)
    if (explicitDate) {
      date = explicitDate
      period = undefined
      if (/\d{1,2}月\d{1,2}/.test(clause) && !/\d{4}年/.test(clause)) {
        notes.add(`未注明年份的日期按 ${now.year()} 年处理。`)
      }
    }
    const reminder = reminderFromText(clause)
    if (/^提前.+提醒(?:我)?$/.test(clause) && drafts.at(-1)?.kind === 'event') {
      drafts.at(-1)!.remind = reminder ?? 0
      if (reminder === undefined) notes.add('有一项提醒未识别，请在草案中选择。')
      continue
    }
    const parsed = timesFromText(clause, period)
    period = parsed.period
    const hasEvent = /会议|组会|开会|讲座|上课|面试|约见|约会/.test(clause)
    const hasTask = /提交|汇报文档|报告|作业|待办|完成|整理|截止|报名表/.test(clause)
    const projectId = /课程|作业|上课/.test(clause) ? 'course' : hasEvent || hasTask ? 'will' : 'personal'
    const create = (kind: 'event' | 'task', title: string, timeIndex: number) => {
      drafts.push({
        id: crypto.randomUUID(), kind, title, date, time: parsed.times[timeIndex] ?? '',
        projectId, remind: kind === 'event' ? reminder ?? 0 : 0, duration: 60,
      })
    }
    if (hasEvent) {
      const title = /组会/.test(clause) ? '项目组会' : /面试/.test(clause) ? '面试'
        : /讲座/.test(clause) ? '参加讲座' : /上课/.test(clause) ? '课程安排'
          : /约见|约会/.test(clause) ? '约见安排' : '会议'
      create('event', title, 0)
    }
    if (hasTask || !hasEvent) {
      const title = /汇报文档/.test(clause) ? '提交汇报文档'
        : /报名表/.test(clause) ? '提交报名表' : /课程报告/.test(clause) ? '提交课程报告'
          : /作业/.test(clause) ? '完成作业' : /报告/.test(clause) ? '提交报告'
            : clause
      create('task', title, hasEvent ? 1 : 0)
    }
  }
  if (!drafts.length) throw new Error('没有可整理的内容，请补充具体事项。')
  if (drafts.some(draft => draft.kind === 'event' && (!draft.date || !draft.time))) notes.add('部分日程缺少日期或开始时间，请补全后确认。')
  if (drafts.some(draft => draft.kind === 'task' && !draft.date)) notes.add('未明确截止日期的待办将保留为无截止日期任务。')
  return { drafts, notes: [...notes] }
}

export class MockScheduleService implements DraftService {
  async extract(text: string, signal: AbortSignal): Promise<DraftResult> {
    await new Promise<void>((resolve, reject) => {
      const cancel = () => {
        clearTimeout(timer)
        reject(new DOMException('已取消整理', 'AbortError'))
      }
      const timer = setTimeout(() => {
        signal.removeEventListener('abort', cancel)
        resolve()
      }, 300)
      signal.addEventListener('abort', cancel, { once: true })
      if (signal.aborted) cancel()
    })
    return extractDrafts(text)
  }
}

export const draftService: DraftService = new MockScheduleService()
