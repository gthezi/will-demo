import { FolderOutlined, RightOutlined, SearchOutlined, ClearOutlined } from '@ant-design/icons'
import { Button, Empty, Input, Progress, Segmented, Select, Tooltip } from 'antd'
import dayjs from 'dayjs'
import { useRef, useState } from 'react'
import { MonthCalendar } from '../components/MonthCalendar'
import { ScheduleList } from '../components/ScheduleList'
import { dashboardView, deadlineView, defaultDashboardFilters, type DashboardFilters } from '../domain/dashboard'
import type { UpcomingDays } from '../domain/dashboardPreferences'
import { projectName } from '../domain/projects'
import { scheduleItems, type ScheduleData } from '../domain/schedule'
import { useLocalNow } from '../hooks/useLocalNow'
import type { PageKey } from '../components/WillShell'
import './HomePage.css'

type HomePageProps = {
  data: ScheduleData
  selectedDate: string
  onDateChange: (date: string) => void
  onNavigate: (page: PageKey) => void
  onLoadDemo: () => void
  onEdit: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void
  upcomingDays: UpcomingDays
}

export function HomePage({
  data, selectedDate, onDateChange, onNavigate, onLoadDemo, onEdit, onToggleTask, upcomingDays,
}: HomePageProps) {
  const now = useLocalNow()
  const [searchOpen, setSearchOpen] = useState(false)
  const [showAllDeadlines, setShowAllDeadlines] = useState(false)
  const [showOverdue, setShowOverdue] = useState(false)
  const overdueSection = useRef<HTMLDivElement>(null)
  const [filters, setFilters] = useState<DashboardFilters>(defaultDashboardFilters)
  const items = scheduleItems(data)
  const tasks = items.filter(item => item.kind === 'task')
  const pending = tasks.filter(item => !item.done)
  const done = tasks.length - pending.length
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0
  const today = dayjs(now).format('YYYY-MM-DD')
  const view = dashboardView(data, filters, now)
  const { overdue, upcoming } = deadlineView(data, now, upcomingDays)
  const activeProjects = data.projects.filter(project => !project.archived)
  const listProps = { projects: data.projects, onToggleTask, onEdit }
  const revealOverdue = () => {
    setShowOverdue(true)
    requestAnimationFrame(() => {
      overdueSection.current?.scrollIntoView({ block: 'nearest' })
      overdueSection.current?.focus({ preventScroll: true })
    })
  }

  return (
    <div className="will-dashboard">
      {searchOpen && (
        <div className="will-dashboard-filters" role="search" aria-label="搜索和筛选安排">
          <Input aria-label="搜索安排标题" placeholder="搜索标题" prefix={<SearchOutlined />} allowClear
            value={filters.query} onChange={event => setFilters({ ...filters, query: event.target.value })} />
          <Select aria-label="筛选项目" placeholder="全部项目" allowClear value={filters.projectId ?? undefined}
            onChange={value => setFilters({ ...filters, projectId: value ?? null })}
            options={data.projects.map(project => ({ value: project.id, label: `${project.name}${project.archived ? '（已归档）' : ''}` }))} />
          <Segmented className="will-dashboard-kind" aria-label="筛选类型" value={filters.kind}
            options={[{ value: 'all', label: '全部' }, { value: 'event', label: '日程' }, { value: 'task', label: '待办' }]}
            onChange={kind => setFilters({ ...filters, kind: kind as DashboardFilters['kind'] })} />
          <Select aria-label="筛选完成状态" value={filters.status} onChange={status => setFilters({ ...filters, status })}
            options={[{ value: 'all', label: '全部状态' }, { value: 'pending', label: '未完成待办' }, { value: 'completed', label: '已完成待办' }]} />
          <Tooltip title="清除筛选"><Button icon={<ClearOutlined />} aria-label="清除筛选"
            onClick={() => setFilters(defaultDashboardFilters)} disabled={!view.hasFilters} /></Tooltip>
        </div>
      )}
      <div className="will-home-grid">
        <div className="will-home-column">
          <section className="will-summary" aria-label="任务概览">
            <div className="will-summary-copy">
              <span className="will-summary-label"><FolderOutlined /> 个人工作台</span>
              <h2>任务进度</h2>
              <p className="will-summary-remaining">{tasks.length ? pending.length ? `剩余 ${pending.length} 项` : '待办已全部完成' : '还没有待办'}</p>
            </div>
            <div className="will-task-progress">
              <Progress type="circle" percent={percent} size={136} strokeWidth={4}
                styles={{ body: { width: '100%', height: '100%' } }}
                aria-label={`全部待办已完成 ${done} / ${tasks.length}，${percent}%`}
                format={() => <span className="will-progress-count"><strong>{done}<span> / {tasks.length}</span></strong><small>全部待办 · 已完成</small></span>} />
            </div>
            <div className="will-metrics">
              <Tooltip title={`今天至 ${dayjs(now).add(upcomingDays - 1, 'day').format('M月D日')} 截止的未完成待办`}>
                <span><strong>{upcoming.length}</strong>项未来 {upcomingDays} 天截止</span>
              </Tooltip>
              {overdue.length ? (
                <Button className="will-metric-button has-overdue" type="text"
                  onClick={revealOverdue} aria-expanded={showOverdue} aria-controls="overdue-tasks">
                  <strong>{overdue.length}</strong>项已逾期<RightOutlined />
                </Button>
              ) : <span><strong>0</strong>项已逾期</span>}
            </div>
            {!items.length && <Button className="will-load-demo" onClick={onLoadDemo}>载入示例数据</Button>}
          </section>
          <section className="will-panel" aria-labelledby="deadlines-heading">
            <div className="will-panel-heading">
              <div className="will-deadline-heading">
                <h2 id="deadlines-heading">近期截止</h2>
                <span>未来 {upcomingDays} 天（含今天）</span>
              </div>
              <Button type="link" size="small" onClick={() => onNavigate('calendar')}>查看日历<RightOutlined /></Button>
            </div>
            {upcoming.length ? (showAllDeadlines ? upcoming : upcoming.slice(0, 4)).map(item => {
              const deadline = dayjs(`${item.date}T${item.time}`)
              const days = deadline.startOf('day').diff(dayjs(today), 'day')
              const relative = days === 0 ? '今天截止' : days === 1 ? '明天截止' : `还有 ${days} 天`
              return (
                <div className={`will-deadline-row${days === 0 ? ' is-due-today' : ''}`} key={item.id}>
                  <button className="will-deadline-title" onClick={() => onEdit(item.id)}>
                    <strong>{item.title}</strong><span>{projectName(data.projects, item.projectId)}</span>
                  </button>
                  <span className="will-deadline-relative">{relative}</span>
                  <time dateTime={`${item.date}T${item.time}`}>
                    <span>{dayjs(item.date).format('M/D')}<span className="will-deadline-weekday">（{dayjs(item.date).format('ddd')}）</span></span>
                    <span>{item.time}</span>
                  </time>
                </div>
              )
            }) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`未来 ${upcomingDays} 天没有未完成待办`} />}
            {upcoming.length > 4 && (
              <div className="will-deadline-more">
                <span>显示 {showAllDeadlines ? upcoming.length : 4} 项 / 共 {upcoming.length} 项</span>
                <Button type="link" size="small" aria-expanded={showAllDeadlines}
                  onClick={() => setShowAllDeadlines(current => !current)}>
                  {showAllDeadlines ? '只看前 4 项' : '查看全部'}
                </Button>
              </div>
            )}
            {overdue.length > 0 && (
              <div id="overdue-tasks" className="will-overdue-section" ref={overdueSection} tabIndex={-1}>
                <Button type="link" className="will-overdue-toggle" aria-expanded={showOverdue}
                  onClick={() => setShowOverdue(current => !current)}>
                  {showOverdue ? '收起逾期待办' : '查看逾期待办'} · {overdue.length} 项
                </Button>
                {showOverdue && <ScheduleList items={overdue} {...listProps}
                  overdueIds={new Set(overdue.map(item => item.id))} />}
              </div>
            )}
          </section>
          <section className="will-panel" aria-labelledby="tasks-heading">
            <div className="will-panel-heading">
              <h2 id="tasks-heading">{view.hasFilters ? '筛选结果' : '待办清单'}</h2>
              <div className="will-inline-actions">
                <Tooltip title="搜索与筛选"><Button type={searchOpen ? 'primary' : 'text'} size="small"
                  icon={<SearchOutlined />} aria-label="搜索与筛选" aria-expanded={searchOpen}
                  onClick={() => { setSearchOpen(!searchOpen); if (searchOpen) setFilters(defaultDashboardFilters) }} /></Tooltip>
                <Button type="link" size="small" onClick={() => onNavigate('projects')}>管理项目<RightOutlined /></Button>
              </div>
            </div>
            {view.hasFilters && <p className="will-result-count">全部日期 · {view.results.length} 项安排</p>}
            <ScheduleList items={view.hasFilters ? view.results : tasks.slice(0, 6)} {...listProps}
              emptyText={view.hasFilters ? '没有符合筛选条件的安排' : '尚无待办'} />
            {!view.hasFilters && tasks.length > 6 && <Button type="link" onClick={() => onNavigate('projects')}>查看全部 {tasks.length} 项待办<RightOutlined /></Button>}
          </section>
        </div>
        <aside className="will-home-column">
          <section className="will-calendar-tool" aria-labelledby="month-heading">
            <div className="will-panel-heading">
              <h2 id="month-heading">本月日历</h2>
              <Button type="link" size="small" onClick={() => onNavigate('calendar')}>展开<RightOutlined /></Button>
            </div>
            <MonthCalendar selectedDate={selectedDate} onSelect={onDateChange} items={items} />
            <div className="will-home-agenda">
              <div className="will-panel-heading"><h3>{dayjs(selectedDate).format('M/D（ddd）')} 的安排</h3></div>
              <ScheduleList items={items.filter(item => item.date === selectedDate)} {...listProps} emptyText="这一天还没有安排" />
            </div>
          </section>
          <section className="will-panel" aria-labelledby="projects-heading">
            <div className="will-panel-heading">
              <h2 id="projects-heading">项目概览</h2>
              <Button type="link" size="small" onClick={() => onNavigate('projects')}>全部项目<RightOutlined /></Button>
            </div>
            <div className="will-project-overview">
              {activeProjects.map(project => {
                const projectTasks = data.tasks.filter(task => task.projectId === project.id)
                const completed = projectTasks.filter(task => task.done).length
                return (
                  <button key={project.id} className="will-project-summary" onClick={() => onNavigate('projects')}>
                    <span><strong>{project.name}</strong><small>{completed}/{projectTasks.length} 完成</small></span>
                    <Progress percent={projectTasks.length ? Math.round(completed / projectTasks.length * 100) : 0} showInfo={false} size="small" />
                  </button>
                )
              })}
              {!activeProjects.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有进行中的项目" />}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
