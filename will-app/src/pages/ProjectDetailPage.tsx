import { ArrowLeftOutlined, PlusOutlined, SettingOutlined, ThunderboltOutlined, CalendarOutlined } from '@ant-design/icons'
import { Alert, App, Button, Checkbox, Empty, Modal, Progress, Segmented, Select, Tabs, Tag } from 'antd'
import { useState } from 'react'
import { ScheduleList } from '../components/ScheduleList'
import { projectViewLabels, type Project, type ProjectView } from '../domain/projects'
import { allScheduleItems, taskStatus, type ScheduleData, type Task, type TaskStatus } from '../domain/schedule'
import { itemStatus, itemStatusLabels } from '../domain/itemStatus'
import { useLocalNow } from '../hooks/useLocalNow'
import './ProjectsPage.css'
const states = [{ value: 'todo', label: '待处理' }, { value: 'in_progress', label: '进行中' }, { value: 'done', label: '已完成' }] as const
type Props = {
  data: ScheduleData; project: Project; tab: string; onTab: (tab: string) => void; onBack: () => void
  onManualAdd: (date: string, projectId: string) => void; onEdit: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void; onStatus: (id: string, status: TaskStatus) => boolean
  onViews: (id: string, views: ProjectView[]) => boolean; onAssistant: () => void; onCalendar: (date: string) => void
}
export function ProjectDetailPage({ data, project, tab, onTab, onBack, onManualAdd, onEdit, onToggleTask, onStatus, onViews, onAssistant, onCalendar }: Props) {
  const [layout, setLayout] = useState('board')
  const [configure, setConfigure] = useState(false)
  const now = useLocalNow()
  const { message } = App.useApp()
  const tasks = data.tasks.filter(task => task.projectId === project.id)
  const done = tasks.filter(task => taskStatus(task) === 'done').length
  const activeViews = project.enabledViews ?? []
  const validTab = ['overview', 'tasks', 'materials', ...activeViews].includes(tab) ? tab : 'overview'
  const projectItems = allScheduleItems(data).filter(item => item.projectId === project.id)
  const focusItems = projectItems
    .filter(item => item.kind === 'task' && !item.done)
    .sort((a, b) => Number(b.taskStatus === 'in_progress') - Number(a.taskStatus === 'in_progress')
      || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31'))
  const saveStatus = (id: string, status: TaskStatus) => { if (!onStatus(id, status)) void message.warning('状态仅在本次页面中保留，请勿刷新。') }
  const renderTask = (task: Task) => {
    const display = projectItems.find(item => item.id === task.id)!
    const urgency = itemStatus(display, now)
    return <article className="will-task-card" key={task.id} data-state={taskStatus(task)}>
      <button className="will-task-title" onClick={() => onEdit(task.id)}>{task.title}</button>
      {task.description && <p>{task.description}</p>}
      <div className="will-task-date">{task.due ? <button className="will-inline-link" onClick={() => onCalendar(task.due!)}><CalendarOutlined /> {task.due} {task.time || '日期截止'}</button> : '无截止日期'}
        {(urgency === 'overdue' || urgency === 'today') && <Tag className="will-item-status" data-status={urgency}>{itemStatusLabels[urgency]}</Tag>}
      </div>
      <Select aria-label={`任务状态：${task.title}`} value={taskStatus(task)} options={[...states]} onChange={status => saveStatus(task.id, status)} />
    </article>
  }
  return <div className="will-project-detail">
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>全部项目</Button>
    <div className="will-detail-heading"><div><h2>{project.name} {project.archived && <Tag>已归档</Tag>}</h2><p>{project.description || '尚未填写项目目标'}</p></div><div className="will-detail-actions">
      <Button icon={<SettingOutlined />} onClick={() => setConfigure(true)}>视图设置</Button>
      <Button icon={<ThunderboltOutlined />} onClick={onAssistant} disabled={project.archived}>AI 助手</Button>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => onManualAdd('', project.id)} disabled={project.archived}>新建任务</Button>
    </div></div>
    {project.archived && <Alert type="info" showIcon title="项目已归档，任务与完成历史保留。可在项目列表恢复后继续添加。" />}
    <Tabs activeKey={validTab} onChange={onTab} items={[
      { key: 'overview', label: '概览', children: <div className="will-project-overview-grid">
        <section className="will-project-summary-section"><h3>项目进度</h3>
          {tasks.length ? <>
            <div className="will-detail-completion"><strong>{done}<span> / {tasks.length}</span></strong><span>项已完成</span></div>
            <Progress percent={Math.round(done / tasks.length * 100)} showInfo={false} />
            <p>{done === tasks.length ? '所有任务均已完成' : `${tasks.length - done} 项未完成 · ${tasks.filter(task => taskStatus(task) === 'in_progress').length} 项进行中`}</p>
            <Button onClick={() => onTab('tasks')}>{done === tasks.length ? '查看已完成任务' : '继续处理任务'}</Button>
          </> : <><p className="will-project-no-tasks">尚未添加任务</p><Button icon={<PlusOutlined />} disabled={project.archived} onClick={() => onManualAdd('', project.id)}>添加第一项任务</Button></>}
        </section>
        <section><h3>近期重点</h3><ScheduleList items={focusItems.slice(0, 4)} projects={data.projects} onEdit={onEdit} onToggleTask={onToggleTask} hideProject emptyText={tasks.length && done === tasks.length ? '任务已全部完成' : '尚无待处理任务'} /></section>
      </div> },
      { key: 'tasks', label: `任务 (${tasks.length})`, children: <>
        <div className="will-task-toolbar"><span>{tasks.length ? `${done} / ${tasks.length} 项已完成` : '尚未添加任务'}</span><Segmented aria-label="任务显示方式" value={layout} onChange={setLayout} options={[{ value: 'board', label: '看板' }, { value: 'list', label: '列表' }]} /></div>
        {layout === 'board' ? <div className="will-task-board">{states.map(state => <section className="will-task-column" key={state.value} aria-label={state.label}><h3>{state.label}<span>{tasks.filter(task => taskStatus(task) === state.value).length}</span></h3><div>{tasks.filter(task => taskStatus(task) === state.value).map(renderTask)}</div>{!tasks.some(task => taskStatus(task) === state.value) && <p className="will-board-empty">暂无任务</p>}</section>)}</div> : <div className="will-task-list">{tasks.map(renderTask)}{!tasks.length && <Empty className="will-empty" image={false} description="还没有任务" />}</div>}
      </> },
      { key: 'materials', label: '资料', children: <Empty className="will-empty will-view-placeholder" image={false} description={<><strong>还没有资料</strong><p>资料库与来源关联计划在 W3 接入，当前未上传或同步任何文件。</p></>} /> },
      ...activeViews.map(view => ({ key: view, label: projectViewLabels[view], children: <Empty className="will-empty will-view-placeholder" image={false} description={<><strong>{projectViewLabels[view]} · 专用视图预览</strong><p>{projectViewLabels[view]}内容功能留待 W4。当前仅保存视图配置，隐藏不会删除项目数据。</p></>} /> })),
    ]} />
    <Modal title="专用视图" open={configure} onCancel={() => setConfigure(false)} footer={<Button type="primary" onClick={() => setConfigure(false)}>完成</Button>}>
      <p>选择要在项目中显示的专用标签。概览、任务、资料始终可用。</p>
      <p>专用内容计划在 W4 开放；当前仅保存标签显示偏好。隐藏视图不会删除项目数据。</p>
      <Checkbox.Group value={activeViews} options={Object.entries(projectViewLabels).map(([value, label]) => ({ value, label }))} onChange={views => {
        if (!onViews(project.id, views as ProjectView[])) void message.warning('视图配置仅在本次页面中保留，请勿刷新。')
      }} />
    </Modal>
  </div>
}
