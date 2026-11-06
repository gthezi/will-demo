import { EditOutlined, FolderOutlined, InboxOutlined, MoreOutlined, PlusOutlined, UndoOutlined } from '@ant-design/icons'
import { Alert, App, Button, Dropdown, Empty, Form, Input, Modal, Progress, Tabs, Tooltip, Select } from 'antd'
import { useRef, useState } from 'react'
import { ScheduleList } from '../components/ScheduleList'
import { validateProjectName, type Project, type ProjectId, type ProjectTemplate } from '../domain/projects'
import { allScheduleItems, taskStatus, type ScheduleData } from '../domain/schedule'
import './ProjectsPage.css'

type ProjectsPageProps = {
  data: ScheduleData
  onCreate: (id: ProjectId, name: string, template?: ProjectTemplate, description?: string) => boolean
  onOpenProject: (id: string) => void
  onRename: (id: ProjectId, name: string) => boolean
  onArchive: (id: ProjectId, archived: boolean) => boolean
  onManualAdd: (date: string, projectId: ProjectId) => void
  onEdit: (id: string) => void
  onToggleTask: (id: string, done: boolean) => void
}

type ProjectSession = { id: ProjectId; name: string; isNew: boolean }

function ProjectNameEditor({ session, projects, onClose, onSave }: {
  session: ProjectSession
  projects: Project[]
  onClose: () => void
  onSave: (name: string, template?: ProjectTemplate, description?: string) => boolean
}) {
  const [form] = Form.useForm<{ name: string; template: ProjectTemplate; description: string }>()
  const [error, setError] = useState('')
  const finishedRef = useRef(false)
  const { message } = App.useApp()
  return (
    <Modal
      open title={session.isNew ? '新建项目' : '修改项目名称'} width={440}
      onCancel={onClose} mask={{ closable: false }}
      okText={session.isNew ? '创建项目' : '保存名称'} cancelText="取消"
      okButtonProps={{ 'aria-label': session.isNew ? '创建项目' : '保存名称' }}
      cancelButtonProps={{ 'aria-label': '取消' }}
      onOk={() => form.submit()}
    >
      {error && <Alert type="error" showIcon title={error} role="alert" />}
      <Form
        form={form} layout="vertical" name="project-name" initialValues={{ name: session.name, template: 'standard' }} autoComplete="off"
        onFinish={({ name, template, description }) => {
          if (finishedRef.current) return
          try {
            const persisted = onSave(name, template, description)
            finishedRef.current = true
            if (persisted) void message.success(session.isNew ? '已创建项目' : '已修改项目名称')
            else void message.warning('项目修改仅在本次页面中保留，请勿刷新。')
            onClose()
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
          }
        }}
      >
        <Form.Item
          name="name" label="项目名称"
          rules={[{
            validator: (_, name: string) => {
              try {
                validateProjectName(projects, name ?? '', session.isNew ? undefined : session.id)
                return Promise.resolve()
              } catch (cause) {
                return Promise.reject(cause)
              }
            },
          }]}
        >
          <Input autoFocus maxLength={40} showCount />
        </Form.Item>
        {session.isNew && <>
          <Form.Item name="template" label="项目模板"><Select options={[{ value: 'standard', label: '普通项目' }, { value: 'paper', label: '课程论文' }, { value: 'workflow', label: '流程申请' }, { value: 'collaboration', label: '小组协作' }]} /></Form.Item>
          <Form.Item name="description" label="项目目标（可选）"><Input.TextArea maxLength={2000} rows={3} /></Form.Item>
        </>}
      </Form>
    </Modal>
  )
}

export function ProjectsPage({
  data, onCreate, onRename, onArchive, onManualAdd, onEdit, onToggleTask, onOpenProject,
}: ProjectsPageProps) {
  const [view, setView] = useState('active')
  const [session, setSession] = useState<ProjectSession | null>(null)
  const { modal, message } = App.useApp()
  const items = allScheduleItems(data)
  const active = data.projects.filter(project => !project.archived)
  const archived = data.projects.filter(project => project.archived)
  const create = () => setSession({ id: crypto.randomUUID(), name: '', isNew: true })

  const changeArchive = (project: Project) => {
    const apply = () => {
      const persisted = onArchive(project.id, !project.archived)
      const text = project.archived ? '已恢复项目' : '已归档项目'
      if (persisted) void message.success(text)
      else void message.warning(`${text}，仅在本次页面中保留，请勿刷新。`)
    }
    if (project.archived) {
      try { apply() } catch (cause) {
        void message.error(cause instanceof Error ? cause.message : '恢复失败，请重试。')
      }
      return
    }
    const count = items.filter(item => item.projectId === project.id).length
    modal.confirm({
      title: '归档这个项目？',
      content: `“${project.name}”的 ${count} 项安排和完成状态将保留，可随时恢复项目。`,
      okText: '确认归档', cancelText: '保留项目',
      focusable: { autoFocusButton: 'cancel' },
      mask: { closable: false },
      onOk: async () => {
        try { apply() } catch (cause) {
          void message.error(cause instanceof Error ? cause.message : '归档失败，请重试。')
          throw cause
        }
      },
    })
  }

  const renderProjects = (projects: Project[], isArchived: boolean) => (
    <div className="will-projects">
      {!projects.length && (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isArchived ? '还没有归档项目' : '还没有进行中的项目'}>
          {!isArchived && <Button icon={<PlusOutlined />} onClick={create}>新建项目</Button>}
        </Empty>
      )}
      {projects.map(project => {
        const projectItems = items.filter(item => item.projectId === project.id)
        const tasks = data.tasks.filter(task => task.projectId === project.id)
        const done = tasks.filter(task => taskStatus(task) === 'done').length
        return (
          <section className="will-project-section" key={project.id} aria-label={project.name}>
            <div className="will-project-heading">
              <h2><FolderOutlined /><button className="will-inline-link" onClick={() => onOpenProject(project.id)}>{project.name}</button></h2>
              <span>{projectItems.length} 项安排</span>
              <div className="will-project-actions">
                {isArchived && (
                  <Tooltip title="恢复项目">
                    <Button icon={<UndoOutlined />} aria-label={`恢复项目：${project.name}`} onClick={() => changeArchive(project)} />
                  </Tooltip>
                )}
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      { key: 'rename', icon: <EditOutlined />, label: '修改名称' },
                      ...(!isArchived ? [{ key: 'archive', icon: <InboxOutlined />, label: '归档项目' }] : []),
                    ],
                    onClick: ({ key }) => {
                      if (key === 'rename') setSession({ id: project.id, name: project.name, isNew: false })
                      if (key === 'archive') changeArchive(project)
                    },
                  }}
                >
                  <Button type="text" icon={<MoreOutlined />} aria-label={`管理项目：${project.name}`} title="管理项目" />
                </Dropdown>
              </div>
            </div>
              <div className="will-project-progress">
                <Progress percent={tasks.length ? Math.round(done / tasks.length * 100) : 0} size="small" />
                <span>{done} / {tasks.length} 项待办已完成</span>
              </div>
            {project.description && <p className="will-project-goal">{project.description}</p>}
            <ScheduleList items={projectItems.slice(0, 3)} projects={data.projects} onToggleTask={onToggleTask} onEdit={onEdit} />
            <Button type="link" onClick={() => onOpenProject(project.id)}>打开项目 · {tasks.length} 项任务</Button>
            {!isArchived && <Button className="will-project-add" icon={<PlusOutlined />}
              aria-label={`向${project.name}添加待办`}
              onClick={() => onManualAdd('', project.id)}>添加待办</Button>}
          </section>
        )
      })}
    </div>
  )

  return (
    <>
      <Tabs
        activeKey={view} onChange={setView}
        tabBarExtraContent={<Button icon={<PlusOutlined />} aria-label="新建项目" onClick={create}>新建项目</Button>}
        items={[
          { key: 'active', label: `进行中 (${active.length})`, children: renderProjects(active, false) },
          { key: 'archived', label: `已归档 (${archived.length})`, children: renderProjects(archived, true) },
        ]}
      />
      {session && (
        <ProjectNameEditor
          key={session.id} session={session} projects={data.projects} onClose={() => setSession(null)}
          onSave={(name, template, description) => {
            const persisted = session.isNew ? onCreate(session.id, name, template, description) : onRename(session.id, name)
            if (session.isNew) setView('active')
            if (session.isNew) onOpenProject(session.id)
            return persisted
          }}
        />
      )}
    </>
  )
}
