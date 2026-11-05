import {
  CalendarOutlined, CheckOutlined, CheckSquareOutlined, DeleteOutlined, EditOutlined,
  ReloadOutlined, SendOutlined, UpOutlined, ClockCircleOutlined, FolderOutlined,
} from '@ant-design/icons'
import {
  Alert, Button, Drawer, Empty, Form, Input, Result,
  Space, Spin, Tag, Tooltip,
} from 'antd'
import dayjs from 'dayjs'
import { useEffect, useRef, useState } from 'react'
import type { ArrangementDraft } from '../domain/schedule'
import { defaultProjectId, type Project } from '../domain/projects'
import { fromArrangementForm, toArrangementForm, type ArrangementFormValue } from '../domain/arrangementForm'
import { ArrangementFields } from './ArrangementFields'
import { draftService, type DraftResult } from '../services/draftService'
import './AssistantDrawer.css'

type DraftFormValue = { drafts: ArrangementFormValue[] }
type AssistantDrawerProps = {
  open: boolean
  onClose: () => void
  onConfirm: (drafts: ArrangementDraft[]) => boolean
  onViewCalendar: (date: string) => void
  onViewProjects: () => void
  projects: Project[]
}

function DraftFields({ index, value, expanded, onToggle, onRemove, projects }: {
  index: number
  value?: ArrangementFormValue
  expanded: boolean
  onToggle: () => void
  onRemove: () => void
  projects: Project[]
}) {
  const isEvent = value?.kind === 'event'
  const project = projects.find(project => project.id === value?.projectId)
  const date = value?.date?.format(value.date.year() === dayjs().year() ? 'M月D日' : 'YYYY年M月D日')
  const time = value?.time?.format('HH:mm')
  const end = isEvent && value?.time && value.duration ? value.time.add(value.duration, 'minute') : null
  const nextDay = end && value?.time ? end.startOf('day').diff(value.time.startOf('day'), 'day') : 0
  const missing = !value?.title?.trim() || !value.date || !value.time || !project || project.archived
  const panelId = `assistant-draft-editor-${value?.id ?? index}`
  return (
    <section className="assistant-draft" role="group" aria-label={`安排 ${index + 1}`}>
      <div className="assistant-draft-heading">
        <span className="assistant-draft-number">{String(index + 1).padStart(2, '0')}</span>
        <Tag color={isEvent ? 'blue' : 'default'}>{isEvent ? '日程' : '待办'}</Tag>
        {missing && <span className="assistant-draft-incomplete">待补全</span>}
        <div className="assistant-draft-tools">
          <Button className="assistant-draft-edit" type="text" icon={expanded ? <UpOutlined /> : <EditOutlined />}
            aria-label={`${expanded ? '收起' : '编辑'}安排 ${index + 1}`}
            aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}>
            {expanded ? '收起' : '编辑'}
          </Button>
          <Tooltip title="移除此项">
            <Button className="assistant-draft-remove" type="text" danger icon={<DeleteOutlined />}
              aria-label={`移除安排 ${index + 1}`} onClick={onRemove} />
          </Tooltip>
        </div>
      </div>
      <div className="assistant-draft-summary">
        <h3>{value?.title?.trim() || '未填写标题'}</h3>
        <p><ClockCircleOutlined /><span>
          {date || '日期待补全'} · {time || '时间待补全'}
          {end && `–${nextDay ? `次${nextDay > 1 ? nextDay : ''}日 ` : ''}${end.format('HH:mm')}`}
          {!isEvent && time && ' 截止'}
        </span></p>
        <p><FolderOutlined /><span>{project?.name || '项目待选择'}{project?.archived && '（已归档）'}
          {isEvent && Number(value?.remind) > 0 && ` · 提前 ${value?.remind} 分钟提醒`}</span></p>
      </div>
      <div id={panelId} className="assistant-draft-editor" hidden={!expanded}>
        <ArrangementFields prefix={[index]} kind={value?.kind ?? 'task'} projects={projects} />
      </div>
    </section>
  )
}

export function AssistantDrawer({
  open, onClose, onConfirm, onViewCalendar, onViewProjects, projects,
}: AssistantDrawerProps) {
  const [form] = Form.useForm<DraftFormValue>()
  const [phase, setPhase] = useState<'input' | 'draft' | 'saved'>('input')
  const [text, setText] = useState('')
  const [source, setSource] = useState('')
  const [result, setResult] = useState<DraftResult | null>(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saved, setSaved] = useState({ count: 0, date: '', persisted: true })
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [exampleDate] = useState(() => dayjs().add(2, 'day').format('M月D日'))
  const controllerRef = useRef<AbortController | null>(null)
  const confirmingRef = useRef(false)
  const draftValues = Form.useWatch('drafts', form)
  const count = draftValues?.length ?? 0

  useEffect(() => () => controllerRef.current?.abort(), [])

  const close = () => {
    controllerRef.current?.abort()
    setProcessing(false)
    onClose()
  }

  const generate = async () => {
    if (controllerRef.current && !controllerRef.current.signal.aborted && processing) return
    if (!text.trim() || phase !== 'input') return
    const controller = new AbortController()
    controllerRef.current = controller
    setError('')
    setProcessing(true)
    try {
      const next = await draftService.extract(text, controller.signal)
      if (controller.signal.aborted) return
      form.setFieldsValue({
        drafts: next.drafts.map(draft => toArrangementForm({
          ...draft,
          projectId: projects.some(project => project.id === draft.projectId && !project.archived)
            ? draft.projectId : defaultProjectId(projects),
        })),
      })
      setSource(text.trim())
      setExpandedIds([])
      setResult(next)
      setPhase('draft')
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : '整理失败，请重试。')
    } finally {
      if (controllerRef.current === controller) setProcessing(false)
    }
  }

  const reset = (clearText = false) => {
    setPhase('input')
    setResult(null)
    setError('')
    form.resetFields()
    setExpandedIds([])
    if (clearText) setText('')
  }

  const confirm = (values: DraftFormValue) => {
    if (confirmingRef.current || phase !== 'draft' || !values.drafts?.length) return
    confirmingRef.current = true
    try {
      const drafts = values.drafts.map(fromArrangementForm)
      const persisted = onConfirm(drafts)
      setSaved({ count: drafts.length, date: drafts[0].date, persisted })
      setPhase('saved')
      setError('')
      form.resetFields()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '添加失败，草案已保留，请重试。')
    } finally {
      confirmingRef.current = false
    }
  }

  return (
    <Drawer
      title="AI 助手" extra={<Tag color="gold">本地模拟</Tag>}
      open={open} onClose={close} size={520} forceRender
      className="assistant-drawer"
      styles={{ wrapper: { maxWidth: '100vw' } }}
      footer={phase === 'input' ? (
        <div className="assistant-composer">
          <Input.TextArea
            aria-label="输入安排" placeholder="把需要安排的事情写在这里…"
            value={text} onChange={event => setText(event.target.value)}
            autoSize={{ minRows: 3, maxRows: 6 }} maxLength={2000} showCount disabled={processing}
            onKeyDown={event => {
              if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void generate()
              }
            }}
          />
          <Button type="primary" aria-label="生成草案" icon={<SendOutlined />} loading={processing} disabled={!text.trim()} onClick={() => void generate()}>
            生成草案
          </Button>
        </div>
      ) : phase === 'draft' ? (
        <div className="assistant-confirm-actions">
          <Button onClick={() => reset()}>取消草案</Button>
          <Button type="primary" aria-label={`确认添加 ${count} 项`} icon={<CheckOutlined />} disabled={!count} onClick={() => form.submit()}>
            确认添加 {count} 项
          </Button>
        </div>
      ) : undefined}
    >
      {error && <Alert type="error" showIcon title={error} role="alert" />}
      {phase === 'input' && (
        <>
          <Alert type="info" showIcon title="当前为模拟识别，请核对草案。" />
          <section className="assistant-examples" aria-labelledby="examples-heading">
            <h3 id="examples-heading">试试这些安排</h3>
            {[
              '明天下午三点有组会，提前一小时提醒我',
              `${exampleDate}下午三点开项目组会，五点前提交汇报文档`,
              `${exampleDate}下午三点有校园讲座，五点前提交报名表`,
            ].map(example => (
              <Button className="assistant-example" key={example} icon={<EditOutlined />} disabled={processing} onClick={() => setText(example)}>
                {example}
              </Button>
            ))}
          </section>
          {processing && <div className="assistant-loading" role="status"><Spin size="small" /> 正在整理…</div>}
        </>
      )}
      {phase === 'draft' && (
        <>
          <blockquote className="assistant-source">{source}</blockquote>
          {!!result?.notes.length && <Alert type="warning" showIcon title={result.notes.join(' ')} />}
          <p className="assistant-draft-count">待确认 {count} 项</p>
        </>
      )}
      <Form
        form={form} layout="vertical" onFinish={confirm}
        onFinishFailed={({ errorFields }) => {
          const ids = errorFields.flatMap(field => {
            const index = field.name[1]
            return typeof index === 'number' ? [form.getFieldValue(['drafts', index, 'id']) as string] : []
          })
          setExpandedIds(current => [...new Set([...current, ...ids])])
          requestAnimationFrame(() => {
            if (errorFields[0]) form.scrollToField(errorFields[0].name, { block: 'center', focus: true })
          })
        }}
        className={phase === 'draft' ? 'assistant-form' : 'assistant-form-hidden'}
        initialValues={{ drafts: [] }} autoComplete="off"
      >
        <Form.List name="drafts">
          {(fields, { remove }) => (
            <>
              {fields.map(field => {
                const value = draftValues?.[field.name]
                return <DraftFields key={field.key} index={field.name} value={value}
                  expanded={!!value && expandedIds.includes(value.id)}
                  onToggle={() => {
                    if (value) setExpandedIds(current => current.includes(value.id)
                      ? current.filter(id => id !== value.id) : [...current, value.id])
                  }}
                  onRemove={() => remove(field.name)} projects={projects} />
              })}
              {!fields.length && phase === 'draft' && <Empty description="草案已全部移除" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </>
          )}
        </Form.List>
      </Form>
      {phase === 'saved' && (
        <Result
          status={saved.persisted ? 'success' : 'warning'}
          title={`已添加 ${saved.count} 项安排`}
          subTitle={saved.persisted ? '已保存到本机。' : '仅在本次页面中保留，请勿刷新。'}
          extra={
            <Space wrap>
              <Button type="primary" aria-label="查看日历" icon={<CalendarOutlined />} onClick={() => onViewCalendar(saved.date)}>查看日历</Button>
              <Button aria-label="查看项目" icon={<CheckSquareOutlined />} onClick={onViewProjects}>查看项目</Button>
              <Button aria-label="再整理一条" icon={<ReloadOutlined />} onClick={() => reset(true)}>再整理一条</Button>
            </Space>
          }
        />
      )}
    </Drawer>
  )
}
