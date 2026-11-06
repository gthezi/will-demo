import { ArrowLeftOutlined, PlusOutlined, SettingOutlined, ThunderboltOutlined, CalendarOutlined } from '@ant-design/icons'
import { Alert, App, Button, Checkbox, Empty, Modal, Progress, Segmented, Select, Tabs, Tag } from 'antd'
import { useState } from 'react'
import { ScheduleList } from '../components/ScheduleList'
import { projectViewLabels, type Project, type ProjectView } from '../domain/projects'
import { allScheduleItems, taskStatus, type ScheduleData, type Task, type TaskStatus } from '../domain/schedule'
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
  const { message } = App.useApp()
  const tasks = data.tasks.filter(task => task.projectId === project.id)
  const done = tasks.filter(task => taskStatus(task) === 'done').length
  const activeViews = project.enabledViews ?? []
  const validTab = ['overview', 'tasks', 'materials', ...activeViews].includes(tab) ? tab : 'overview'
  const focusItems = allScheduleItems(data)
    .filter(item => item.projectId === project.id && item.kind === 'task' && !item.done)
    .sort((a, b) => Number(b.taskStatus === 'in_progress') - Number(a.taskStatus === 'in_progress')
      || (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31'))
  const saveStatus = (id: string, status: TaskStatus) => { if (!onStatus(id, status)) void message.warning('状态仅在本次页面中保留，请勿刷新。') }
  const renderTask = (task: Task) => <article className="will-task-card" key={task.id}>
    <button className="will-task-title" onClick={() => onEdit(task.id)}>{task.title}</button>
    {task.description && <p>{task.description}</p>}
    <div className="will-task-date">{task.due ? <button className="will-inline-link" onClick={() => onCalendar(task.due!)}><CalendarOutlined /> {task.due} {task.time || '日期截止'}</button> : '无截止日期'}</div>
    <Select aria-label={`任务状态：${task.title}`} value={taskStatus(task)} options={[...states]} onChange={status => saveStatus(task.id, status)} />
  </article>
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
        <section><h3>项目进度</h3><Progress percent={tasks.length ? Math.round(done / tasks.length * 100) : 0} /><p>{done} / {tasks.length} 项已完成 · {tasks.filter(task => taskStatus(task) === 'in_progress').length} 项进行中</p><Button onClick={() => onTab('tasks')}>继续处理任务</Button></section>
        <section><h3>近期重点</h3><ScheduleList items={focusItems.slice(0, 4)} projects={data.projects} onEdit={onEdit} onToggleTask={onToggleTask} emptyText={tasks.length && done === tasks.length ? '任务已全部完成' : '尚无待处理任务'} /></section>
      </div> },
      { key: 'tasks', label: `任务 (${tasks.length})`, children: <>
        <div className="will-task-toolbar"><span>{done} / {tasks.length} 项已完成</span><Segmented aria-label="任务显示方式" value={layout} onChange={setLayout} options={[{ value: 'board', label: '看板' }, { value: 'list', label: '列表' }]} /></div>
        {layout === 'board' ? <div className="will-task-board">{states.map(state => <section className="will-task-column" key={state.value} aria-label={state.label}><h3>{state.label}<Tag>{tasks.filter(task => taskStatus(task) === state.value).length}</Tag></h3><div>{tasks.filter(task => taskStatus(task) === state.value).map(renderTask)}</div>{!tasks.some(task => taskStatus(task) === state.value) && <p className="will-board-empty">暂无任务</p>}</section>)}</div> : <div className="will-task-list">{tasks.map(renderTask)}{!tasks.length && <Empty description="还没有任务" />}</div>}
      </> },
      { key: 'materials', label: '资料', children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><strong>还没有资料</strong><p>资料库与来源关联计划在 W3 接入，当前未上传或同步任何文件。</p></>} /> },
      ...activeViews.map(view => ({ key: view, label: projectViewLabels[view], children: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<><Tag>专用视图预览</Tag><p>{projectViewLabels[view]}内容功能留待 W4。当前仅保存视图配置，隐藏不会删除项目数据。</p></>} /> })),
    ]} />
    <Modal title="专用视图" open={configure} onCancel={() => setConfigure(false)} footer={<Button type="primary" onClick={() => setConfigure(false)}>完成</Button>}>
      <p>概览、任务、资料始终可用。隐藏专用视图仅改变显示配置，已有内容会保留。</p>
      <Checkbox.Group value={activeViews} options={Object.entries(projectViewLabels).map(([value, label]) => ({ value, label }))} onChange={views => {
        if (!onViews(project.id, views as ProjectView[])) void message.warning('视图配置仅在本次页面中保留，请勿刷新。')
      }} />
    </Modal>
  </div>
}
