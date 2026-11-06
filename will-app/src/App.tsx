import { Alert, App as AntApp, Button, ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
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
import { createDemoSchedule } from './domain/demo'
import { useWorkbenchRoute } from './hooks/useWorkbenchRoute'
import { validDate } from './domain/schedule'
import { useAIWorkspace } from './hooks/useAIWorkspace'
import { AIWorkspacePage } from './pages/AIWorkspacePage'
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
  const { route, navigate, recentProjectId } = useWorkbenchRoute()
  const activePage = route.page
  const setActivePage = (page: PageKey) => { ai.cancel(); navigate({ page, ...(page === 'ai' && ai.active ? { conversationId: ai.active.id } : {}) }) }
  const openProject = (projectId: string, tab = 'overview') => navigate({ page: 'projects', projectId, tab })
  const [assistantOpen, setAssistantOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'))
  const [editor, setEditor] = useState<{ mode: EditorMode; draft: ArrangementDraft } | null>(null)
  const { upcomingDays, setUpcomingDays, rangeStorageWarning } = useUpcomingDays()
  const {
    data, getSchedule, storageWarning, recoveryAvailable, recoverCorruptData, confirmDrafts, toggleTask, updateItem, deleteItem,
    createProject, updateProjectName, archiveProject, replaceSchedule, updateTaskStatus, updateProjectViews,
  } = useSchedule()
  const ai = useAIWorkspace(getSchedule, confirmDrafts)
  const appliedAIRoute = useRef('')
  useEffect(() => {
    const key = `${route.page}/${route.conversationId ?? ''}`
    if (appliedAIRoute.current === key) return
    appliedAIRoute.current = key
    if (route.page === 'ai' && route.conversationId) {
      if (!ai.select(route.conversationId)) void message.warning('未找到此会话，原始安排保持不变。')
    }
  }, [route.page, route.conversationId, ai, message])
  const openAssistant = () => {
    if (route.page !== 'ai' || !ai.active) ai.openForProject(route.projectId)
    setAssistantOpen(true)
  }
  const selectConversation = (id: string) => { ai.select(id); navigate({ page: 'ai', conversationId: id }) }
  const aiProject = (id: string) => { ai.cancel(); setAssistantOpen(false); openProject(id, 'tasks') }
  const aiCalendar = (date: string) => { ai.cancel(); setAssistantOpen(false); showCalendar(date) }
  const showCalendar = (date: string) => { setSelectedDate(date); navigate({ page: 'calendar', date }) }

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
      draft: { id: crypto.randomUUID(), kind: 'task', title: '', date, time: '', projectId, duration: 60, remind: 0, status: 'todo' },
    })
  }

  const saveItem = (draft: ArrangementDraft, mode: EditorMode) => {
    const persisted = mode === 'create' ? confirmDrafts([draft]) : updateItem(draft)
    if (draft.date) setSelectedDate(draft.date)
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
          onOpenAssistant={openAssistant}
          onManualAdd={() => manualAdd(activePage === 'calendar' ? selectedDate : '', route.projectId)}
          onLoadDemo={loadDemo}
          manualDisabled={!data.projects.some(project => !project.archived)}
          username={username}
          hasDemo={[...data.tasks, ...data.events].some(item => item.id.startsWith('demo-'))}
        >
          {storageWarning && <Alert className="will-storage-warning" type="warning" showIcon title={storageWarning} role="alert"
            action={recoveryAvailable ? <Button size="small" onClick={() => modal.confirm({
              title: '从旧版恢复安排？',
              content: '旧版快照可能不含最近修改，并会替换本次页面中未保存的安排。恢复前会单独备份损坏内容，旧版原始数据仍会保留。',
              okText: '备份并恢复', cancelText: '取消', focusable: { autoFocusButton: 'cancel' },
              onOk: () => {
                try {
                  const recovered = recoverCorruptData()
                  void message.success(`已从旧数据恢复；损坏内容备份为 ${recovered.backupKey}`)
                } catch (cause) {
                  void message.error(cause instanceof Error ? cause.message : '恢复失败，原始数据未更改。')
                  throw cause
                }
              },
            })}>从旧数据恢复</Button> : undefined} />}
          {rangeStorageWarning && <Alert className="will-storage-warning" type="warning" showIcon title={rangeStorageWarning} role="alert" />}
          {activePage === 'ai' ? !assistantOpen && <AIWorkspacePage ai={ai} data={data} onSelect={selectConversation}
            onViewProject={aiProject} onViewCalendar={aiCalendar} /> : <ShellPages
            page={activePage} themeMode={themeMode} onThemeChange={setThemeMode}
            upcomingDays={upcomingDays} onUpcomingDaysChange={setUpcomingDays}
            data={data} selectedDate={validDate(route.date) ? route.date : selectedDate} onDateChange={showCalendar}
            projectId={route.projectId} projectTab={route.tab ?? 'overview'}
            recentProjectId={recentProjectId}
            onOpenProject={openProject} onProjectTab={tab => route.projectId && openProject(route.projectId, tab)}
            onTaskStatus={updateTaskStatus} onProjectViews={updateProjectViews} onOpenAssistant={openAssistant}
            onCalendar={showCalendar}
            onToggleTask={toggleTask}
            onManualAdd={manualAdd}
            onEdit={id => setEditor({ mode: 'edit', draft: getArrangementDraft(data, id) })}
            onCreateProject={(id, name, template, description) => createProject(id, name, template, description)} onRenameProject={updateProjectName} onArchiveProject={archiveProject}
            onNavigate={setActivePage} onLoadDemo={loadDemo} onClear={clearSchedule}
            username={username} onSaveName={saveName}
          />}
        </WillShell>
        <AssistantDrawer
          open={assistantOpen} onClose={() => setAssistantOpen(false)} ai={ai} data={data}
          onViewCalendar={aiCalendar} onViewProject={aiProject}
          onExpand={() => {
            setAssistantOpen(false)
            if (ai.active) navigate({ page: 'ai', conversationId: ai.active.id })
          }}
        />
        {editor && (
          <ArrangementEditor
            key={editor.draft.id} initial={editor.draft} mode={editor.mode}
            projects={data.projects}
            onViewSource={conversationId => {
              if (ai.select(conversationId)) { setEditor(null); navigate({ page: 'ai', conversationId }) }
              else void message.warning('原会话不可用；此安排仍保留原始输入。')
            }}
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
      <AntApp message={{
        maxCount: 1, top: 0,
        getContainer: () => document.getElementById('will-feedback') ?? document.body,
        styles: {
          list: { position: 'relative', inset: 'auto', transform: 'none', height: 'auto', padding: 0, maxWidth: '100%', width: '100%' },
          root: { maxWidth: '100%', width: '100%', boxShadow: 'none' },
        },
      }}><WillExperience {...theme} /></AntApp>
    </ConfigProvider>
  )
}

export default App
