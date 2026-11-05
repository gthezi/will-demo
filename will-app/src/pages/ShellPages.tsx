import { PlusOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import dayjs from 'dayjs'
import { ScheduleList } from '../components/ScheduleList'
import { MonthCalendar } from '../components/MonthCalendar'
import type { PageKey } from '../components/WillShell'
import { scheduleItems, type ProjectId, type ScheduleData } from '../domain/schedule'
import type { ThemeMode } from '../theme'
import { ProjectsPage } from './ProjectsPage'
import { HomePage } from './HomePage'
import { SettingsPage } from './SettingsPage'

type ShellPagesProps = {
  page: PageKey
  themeMode: ThemeMode
  onThemeChange: (mode: ThemeMode) => void
  data: ScheduleData
  selectedDate: string
  onDateChange: (date: string) => void
  onToggleTask: (id: string, done: boolean) => void
  onManualAdd: (date: string, projectId?: ProjectId) => void
  onEdit: (id: string) => void
  onCreateProject: (id: ProjectId, name: string) => boolean
  onRenameProject: (id: ProjectId, name: string) => boolean
  onArchiveProject: (id: ProjectId, archived: boolean) => boolean
  onNavigate: (page: PageKey) => void
  onLoadDemo: () => void
  onClear: () => void
  username: string
  onSaveName: (name: string) => boolean
}

export function ShellPages({
  page, themeMode, onThemeChange, data, selectedDate, onDateChange, onToggleTask,
  onManualAdd, onEdit,
  onCreateProject, onRenameProject, onArchiveProject, onNavigate, onLoadDemo, onClear, username, onSaveName,
}: ShellPagesProps) {
  const items = scheduleItems(data)
  const noActiveProjects = !data.projects.some(project => !project.archived)
  if (page === 'settings') {
    return (
      <SettingsPage username={username} onSaveName={onSaveName} themeMode={themeMode}
        onThemeChange={onThemeChange} onLoadDemo={onLoadDemo} onClear={onClear} />
    )
  }

  if (page === 'calendar') {
    return (
      <div className="will-calendar-layout">
        <div className="will-calendar-picker">
          <MonthCalendar selectedDate={selectedDate} onSelect={onDateChange} items={items} expanded />
          <div className="will-calendar-legend"><span><i />日程</span><span><i className="task" />待办</span></div>
        </div>
        <section className="will-agenda" aria-labelledby="agenda-heading">
          <div className="will-agenda-heading">
            <h2 id="agenda-heading">{dayjs(selectedDate).format('YYYY年M月D日')}</h2>
            <Button type="text" icon={<PlusOutlined />} aria-label="在这一天添加" onClick={() => onManualAdd(selectedDate)} disabled={noActiveProjects} />
          </div>
          <ScheduleList items={items.filter(item => item.date === selectedDate)} projects={data.projects} onToggleTask={onToggleTask} onEdit={onEdit} emptyText="这一天还没有安排" />
        </section>
      </div>
    )
  }

  if (page === 'projects') {
    return (
      <ProjectsPage
        data={data} onCreate={onCreateProject} onRename={onRenameProject} onArchive={onArchiveProject}
        onManualAdd={onManualAdd} onEdit={onEdit} onToggleTask={onToggleTask}
      />
    )
  }

  return (
    <HomePage data={data} selectedDate={selectedDate} onDateChange={onDateChange} onNavigate={onNavigate}
      onLoadDemo={onLoadDemo} onEdit={onEdit} onToggleTask={onToggleTask} />
  )
}
