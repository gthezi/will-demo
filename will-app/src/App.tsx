import { Alert, App as AntApp, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import { useState } from 'react'
import { AssistantDrawer } from './components/AssistantDrawer'
import { ArrangementEditor, type EditorMode } from './components/ArrangementEditor'
import { WillShell } from './components/WillShell'
import type { PageKey } from './components/WillShell'
import { useThemeMode } from './hooks/useThemeMode'
import { useSchedule } from './hooks/useSchedule'
import { useUpcomingDays } from './hooks/useUpcomingDays'
import { ShellPages } from './pages/ShellPages'
import { getThemeConfig } from './theme'
import { getArrangementDraft, type ArrangementDraft, type ProjectId } from './domain/schedule'
import { defaultProjectId } from './domain/projects'
import { createDemoSchedule, PROTOTYPE_STORAGE_KEY } from './domain/demo'
import './App.css'

const PROFILE_KEY = 'will-prototype-name-v01'
function loadName() {
  try {
    const name = localStorage.getItem(PROFILE_KEY)?.trim()
    return name && name.length <= 24 ? name : '同学'
  } catch { return '同学' }
}

function WillExperience({ themeMode, setThemeMode }: ReturnType<typeof useThemeMode>) {
  const { modal, message } = AntApp.useApp()
  const [username, setUsername] = useState(loadName)
  const [activePage, setActivePage] = useState<PageKey>('home')
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [editor, setEditor] = useState<{ mode: EditorMode; draft: ArrangementDraft } | null>(null)
  const { upcomingDays, setUpcomingDays, rangeStorageWarning } = useUpcomingDays()
  const {
    data, storageWarning, confirmDrafts, toggleTask, updateItem, deleteItem,
    createProject, updateProjectName, archiveProject, replaceSchedule,
  } = useSchedule(PROTOTYPE_STORAGE_KEY)

  const saveName = (name: string) => {
    setUsername(name)
    try { localStorage.setItem(PROFILE_KEY, name); return true } catch { return false }
  }
  const loadDemo = () => modal.confirm({
    title: '载入示例数据？',
    content: data.tasks.length || data.events.length || data.projects.some(project => !['will', 'course', 'personal'].includes(project.id))
      ? '这会替换当前预览版中的安排与项目。原线上版本的数据保持独立。'
      : '将载入 5 项示例待办和 2 项示例日程，体验后可以在设置中清空安排。',
    okText: '载入示例', cancelText: '取消', mask: { closable: false },
    focusable: { autoFocusButton: 'cancel' },
    onOk: () => {
      const persisted = replaceSchedule(createDemoSchedule())
      setSelectedDate(dayjs().format('YYYY-MM-DD'))
      setActivePage('home')
      if (persisted) void message.success('已载入示例数据')
      else void message.warning('示例数据仅在本次页面中保留')
    },
  })
  const clearSchedule = () => modal.confirm({
    title: '清空当前预览版的安排？', content: '所有日程和待办将被删除，项目、显示名称与主题设置会保留。',
    okText: '确认清空', cancelText: '保留安排', okButtonProps: { danger: true },
    focusable: { autoFocusButton: 'cancel' }, mask: { closable: false },
    onOk: () => {
      const persisted = replaceSchedule({ ...data, tasks: [], events: [] })
      if (persisted) void message.success('安排已清空')
      else void message.warning('清空仅在本次页面中有效，请勿刷新')
    },
  })

  const manualAdd = (date: string, projectId: ProjectId = defaultProjectId(data.projects)) => {
    setEditor({
      mode: 'create',
      draft: { id: crypto.randomUUID(), kind: 'task', title: '', date, time: '', projectId, duration: 60, remind: 0 },
    })
  }

  const saveItem = (draft: ArrangementDraft, mode: EditorMode) => {
    const persisted = mode === 'create' ? confirmDrafts([draft]) : updateItem(draft)
    setSelectedDate(draft.date)
    setEditor(null)
    return persisted
  }

  return (
    <>
        <WillShell
          themeMode={themeMode}
          onThemeChange={setThemeMode}
          activePage={activePage}
          onNavigate={page => { setActivePage(page); window.scrollTo(0, 0) }}
          onOpenAssistant={() => setAssistantOpen(true)}
          onManualAdd={() => manualAdd(activePage === 'calendar' ? selectedDate : dayjs().format('YYYY-MM-DD'))}
          onLoadDemo={loadDemo}
          manualDisabled={!data.projects.some(project => !project.archived)}
          username={username}
          hasDemo={[...data.tasks, ...data.events].some(item => item.id.startsWith('demo-'))}
        >
          {storageWarning && <Alert className="will-storage-warning" type="warning" showIcon title={storageWarning} role="alert" />}
          {rangeStorageWarning && <Alert className="will-storage-warning" type="warning" showIcon title={rangeStorageWarning} role="alert" />}
          <ShellPages
            page={activePage} themeMode={themeMode} onThemeChange={setThemeMode}
            upcomingDays={upcomingDays} onUpcomingDaysChange={setUpcomingDays}
            data={data} selectedDate={selectedDate} onDateChange={setSelectedDate}
            onToggleTask={toggleTask}
            onManualAdd={manualAdd}
            onEdit={id => setEditor({ mode: 'edit', draft: getArrangementDraft(data, id) })}
            onCreateProject={createProject} onRenameProject={updateProjectName} onArchiveProject={archiveProject}
            onNavigate={setActivePage} onLoadDemo={loadDemo} onClear={clearSchedule}
            username={username} onSaveName={saveName}
          />
        </WillShell>
        <AssistantDrawer
          open={assistantOpen} onClose={() => setAssistantOpen(false)} onConfirm={confirmDrafts}
          projects={data.projects}
          onViewCalendar={date => {
            setSelectedDate(date)
            setActivePage('calendar')
            setAssistantOpen(false)
          }}
          onViewProjects={() => {
            setActivePage('projects')
            setAssistantOpen(false)
          }}
        />
        {editor && (
          <ArrangementEditor
            key={editor.draft.id} initial={editor.draft} mode={editor.mode}
            projects={data.projects}
            onClose={() => setEditor(null)} onSave={saveItem}
            onDelete={id => {
              const persisted = deleteItem(id)
              setEditor(null)
              return persisted
            }}
          />
        )}
    </>
  )
}

function App() {
  const theme = useThemeMode()
  return (
    <ConfigProvider locale={zhCN} theme={getThemeConfig(theme.resolvedTheme)} button={{ autoInsertSpace: false }}>
      <AntApp message={{ maxCount: 1 }}><WillExperience {...theme} /></AntApp>
    </ConfigProvider>
  )
}

export default App
