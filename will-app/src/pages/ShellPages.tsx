import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import dayjs from 'dayjs'
import { ScheduleList } from '../components/ScheduleList'
import { MonthCalendar } from '../components/MonthCalendar'
import type { PageKey } from '../components/WillShell'
import type { UpcomingDays } from '../domain/dashboardPreferences'
import { scheduleItems, type ProjectId, type ScheduleData, type TaskStatus } from '../domain/schedule'
import type { ProjectTemplate, ProjectView } from '../domain/projects'
import type { ThemeMode } from '../theme'
import { ProjectsPage } from './ProjectsPage'
import { HomePage } from './HomePage'
import { SettingsPage } from './SettingsPage'
import { ProjectDetailPage } from './ProjectDetailPage'

type ShellPagesProps = {
  page: PageKey
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  upcomingDays: UpcomingDays
  onUpcomingDaysChange: (days: UpcomingDays) => void
  data: ScheduleData
  selectedDate: string
  onDateChange: (date: string) => void
  onToggleTask: (id: string, done: boolean) => void
  onManualAdd: (date: string, projectId?: ProjectId) => void
  onEdit: (id: string) => void
  onCreateProject: (id: ProjectId, name: string, template?: ProjectTemplate, description?: string) => boolean
  projectId?: string
  recentProjectId?: string
  projectTab: string
  onProjectTab: (tab: string) => void
  onOpenProject: (id: string, tab?: string) => void
  onTaskStatus: (id: string, status: TaskStatus) => boolean
  onProjectViews: (id: string, views: ProjectView[]) => boolean
  onOpenAssistant: () => void
  onCalendar: (date: string) => void
  onRenameProject: (id: ProjectId, name: string) => boolean
  onArchiveProject: (id: ProjectId, archived: boolean) => boolean
  onNavigate: (page: PageKey) => void
  onLoadDemo: () => void
  onClear: () => void
  username: string
  onSaveName: (name: string) => boolean
}

export function ShellPages({
  page, themeMode, onThemeChange, upcomingDays, onUpcomingDaysChange, data, selectedDate, onDateChange, onToggleTask,
  onManualAdd, onEdit,
  onCreateProject, onRenameProject, onArchiveProject, onNavigate, onLoadDemo, onClear, username, onSaveName,
  projectId, recentProjectId, projectTab, onProjectTab, onOpenProject, onTaskStatus, onProjectViews, onOpenAssistant, onCalendar,
}: ShellPagesProps) {
  const items = scheduleItems(data)
  const noActiveProjects = !data.projects.some(project => !project.archived)
  if (page === 'settings') {
    return (
      <SettingsPage username={username} onSaveName={onSaveName} themeMode={themeMode}
        onThemeChange={onThemeChange} upcomingDays={upcomingDays} onUpcomingDaysChange={onUpcomingDaysChange}
        onLoadDemo={onLoadDemo} onClear={onClear} />
    )
  }

  if (page === 'calendar') {
    return (
      <div className="will-calendar-layout">
        <div className="will-calendar-picker">
          <MonthCalendar selectedDate={selectedDate} onSelect={onDateChange} items={items} expanded />
          <div className="will-calendar-legend">
            <span><i />日程</span><span><i className="task" />待办</span>
            <span><i className="today" />今天截止</span><span><i className="overdue" />逾期</span><span><i className="done" />已完成</span>
          </div>
        </div>
        <section className="will-agenda" aria-labelledby="agenda-heading">
          <div className="will-agenda-heading">
            <h2 id="agenda-heading">{dayjs(selectedDate).format('YYYY年M月D日')}</h2>
            <Button type="text" icon={<PlusOutlined />} aria-label="在这一天添加" onClick={() => onManualAdd(selectedDate)} disabled={noActiveProjects} />
          </div>
          <ScheduleList items={items.filter(item => item.date === selectedDate)} projects={data.projects} onToggleTask={onToggleTask} onEdit={onEdit} onOpenProject={id => onOpenProject(id, 'tasks')} emptyText="这一天还没有安排" />
        </section>
      </div>
    )
  }

  if (page === 'projects') {
    const project = data.projects.find(project => project.id === projectId)
    if (project) return <ProjectDetailPage data={data} project={project} tab={projectTab} onTab={onProjectTab}
      onBack={() => onNavigate('projects')} onManualAdd={onManualAdd} onEdit={onEdit} onToggleTask={onToggleTask}
      onStatus={onTaskStatus} onViews={onProjectViews} onAssistant={onOpenAssistant} onCalendar={onCalendar} />
    return (
      <ProjectsPage
        data={data} onCreate={onCreateProject} onRename={onRenameProject} onArchive={onArchiveProject}
        onManualAdd={onManualAdd} onEdit={onEdit} onToggleTask={onToggleTask}
        onOpenProject={onOpenProject}
      />
    )
  }

  return (
    <HomePage data={data} selectedDate={selectedDate} onDateChange={onDateChange} onNavigate={onNavigate}
      onLoadDemo={onLoadDemo} onEdit={onEdit} onToggleTask={onToggleTask} upcomingDays={upcomingDays} onOpenProject={onOpenProject} recentProjectId={recentProjectId} />
  )
}
