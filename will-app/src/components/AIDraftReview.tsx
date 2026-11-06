import { CheckOutlined, DeleteOutlined, EditOutlined, SaveOutlined, UpOutlined } from '@ant-design/icons'
import { Button, Empty, Form, Select, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import type { DraftBatch } from '../domain/aiWorkspace'
import type { ArrangementDraft } from '../domain/schedule'
import type { Project } from '../domain/projects'
import { toArrangementForm, type ArrangementFormValue } from '../domain/arrangementForm'
import type { AIWorkspace } from '../hooks/useAIWorkspace'
import { ArrangementFields } from './ArrangementFields'
import './AssistantDrawer.css'

function serializable(values: ArrangementFormValue[]): ArrangementDraft[] {
  return values.map(v => ({
    ...v, date: v.date?.isValid() ? v.date.format('YYYY-MM-DD') : '',
    time: v.time?.isValid() ? v.time.format('HH:mm') : '', duration: v.duration ?? 60, remind: v.remind ?? 0,
  }))
}
export function AIDraftReview({ batch, projects, ai }: { batch: DraftBatch; projects: Project[]; ai: AIWorkspace }) {
  const [form] = Form.useForm<{ drafts: ArrangementFormValue[] }>()
  const [expanded, setExpanded] = useState<string[]>([])
  const values: ArrangementFormValue[] = Form.useWatch('drafts', form) ?? batch.proposals.map(toArrangementForm)
  const locked = batch.status === 'confirming'
  const sync = () => ai.editBatch(batch.id, serializable(form.getFieldValue('drafts') ?? []))
  const uniqueProjects = [...new Set(values.map(v => v.projectId))]
  return <section className="ai-review-batch" aria-label="待确认草案" data-batch-id={batch.id}>
    <div className="ai-section-heading" tabIndex={-1}><h3>待确认 {values.length} 项</h3><Tag>{batch.status === 'staged' ? '已暂存' : locked ? '等待重试保存' : '待确认'}</Tag></div>
    <details className="ai-original"><summary>原始输入</summary><blockquote className="assistant-source">{batch.source}</blockquote></details>
    {batch.notes.length > 0 && <p className="ai-review-notes">{batch.notes.join(' ')}</p>}
    <label className="ai-target">批次目标项目
      <Select aria-label="批次目标项目" placeholder="确认前选择目标项目"
        value={uniqueProjects.length === 1 && uniqueProjects[0] ? uniqueProjects[0] : undefined} disabled={locked}
        options={projects.map(p => ({ value: p.id, label: `${p.name}${p.archived ? '（已归档）' : ''}`, disabled: p.archived }))}
        onChange={projectId => {
          form.setFieldsValue({ drafts: values.map(v => ({ ...v, projectId })) })
          sync()
        }} />
    </label>
    {locked && <p className="ai-review-notes">草案编号已保存，重试将核对同一批安排。请先完成保存再继续编辑。</p>}
    <Form form={form} layout="vertical" initialValues={{ drafts: batch.proposals.map(toArrangementForm) }} autoComplete="off"
      disabled={locked} onValuesChange={sync} onFinish={() => { sync(); ai.confirm(batch.id) }}
      onFinishFailed={({ errorFields }) => {
        setExpanded(values.map(v => v.id))
        requestAnimationFrame(() => errorFields[0] && form.scrollToField(errorFields[0].name, { block: 'center', focus: true }))
      }}>
      <Form.List name="drafts">{(fields, { remove }) => <>
        {fields.map(field => {
          const value = values[field.name]
          if (!value) return null
          const project = projects.find(p => p.id === value.projectId)
          const show = expanded.includes(value.id)
          return <article className="assistant-draft" key={field.key} role="group" aria-label={`安排 ${field.name + 1}`}>
            <div className="assistant-draft-heading">
              <Tag>{value.kind === 'event' ? '日程' : '待办'}</Tag>
              {value.kind === 'task' && <Tag>{value.status === 'in_progress' ? '进行中' : value.status === 'done' ? '已完成' : '待处理'}</Tag>}
              <div className="assistant-draft-tools">
                <Button type="text" disabled={locked} icon={show ? <UpOutlined /> : <EditOutlined />}
                  aria-label={`${show ? '收起' : '编辑'}安排 ${field.name + 1}`} aria-expanded={show}
                  onClick={() => setExpanded(ids => show ? ids.filter(id => id !== value.id) : [...ids, value.id])}>{show ? '收起' : '编辑'}</Button>
                <Tooltip title="移除此项"><Button type="text" danger disabled={locked} icon={<DeleteOutlined />}
                  aria-label={`移除安排 ${field.name + 1}`} onClick={() => { remove(field.name); sync() }} /></Tooltip>
              </div>
            </div>
            <div className="assistant-draft-summary"><h3>{value.title || '未填写标题'}</h3>
              <p>{value.date?.format('YYYY-MM-DD') || (value.kind === 'event' ? '日期待补全' : '无截止日期')} {value.time?.format('HH:mm') || (value.date && value.kind === 'task' ? '日期截止' : '')}</p>
              <p>{project?.name || '项目待选择'}{project?.archived && '（已归档）'}{value.kind === 'event' && ` · ${value.duration} 分钟`}</p>
            </div>
            <div className="assistant-draft-editor" hidden={!show}>
              <ArrangementFields prefix={[field.name]} kind={value.kind} projects={projects} />
            </div>
          </article>
        })}
        {!fields.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="草案已全部移除" />}
      </>}</Form.List>
    </Form>
    <div className="ai-review-actions">
      {!locked && <Button onClick={() => ai.discardBatch(batch.id)}>取消草案</Button>}
      {!locked && <Button icon={<SaveOutlined />} aria-label="暂存草案" onClick={() => { sync(); ai.stageBatch(batch.id) }}>暂存草案</Button>}
      <Button type="primary" icon={<CheckOutlined />} disabled={!values.length}
        aria-label={`确认添加 ${values.length} 项`} onClick={() => locked ? ai.confirm(batch.id) : form.submit()}>
        {locked ? '重试保存' : `确认添加 ${values.length} 项`}
      </Button>
    </div>
  </section>
}
