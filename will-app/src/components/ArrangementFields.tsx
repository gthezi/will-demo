import { DatePicker, Form, Input, InputNumber, Segmented, Select, TimePicker } from 'antd'
import type { ItemKind } from '../domain/schedule'
import type { Project, ProjectId } from '../domain/projects'
import './ArrangementFields.css'

type ArrangementFieldsProps = {
  prefix?: (string | number)[]
  kind: ItemKind
  autoFocusTitle?: boolean
  projects: Project[]
  retainedProjectId?: ProjectId
}

export function ArrangementFields({
  prefix = [], kind, autoFocusTitle = false, projects, retainedProjectId,
}: ArrangementFieldsProps) {
  const isEvent = kind === 'event'
  const name = (field: string) => [...prefix, field]
  return (
    <div className="arrangement-fields">
      <Form.Item name={name('id')} hidden><Input /></Form.Item>
      <Form.Item name={name('kind')} label="类别">
        <Segmented options={[
          { value: 'event', label: '日程' }, { value: 'task', label: '待办' },
        ]} />
      </Form.Item>
      <Form.Item
        name={name('title')} label="标题"
        rules={[{ required: true, whitespace: true, message: '请输入标题' }, { max: 80, message: '标题最多 80 字' }]}
      >
        <Input maxLength={80} autoFocus={autoFocusTitle} />
      </Form.Item>
      <div className="arrangement-field-grid">
        <Form.Item name={name('date')} label={isEvent ? '开始日期' : '截止日期'} rules={[{ required: true, message: '请选择日期' }]}>
          <DatePicker format="YYYY-MM-DD" inputReadOnly />
        </Form.Item>
        <Form.Item name={name('time')} label={isEvent ? '开始时间' : '截止时间'} rules={[{ required: true, message: '请选择时间' }]}>
          <TimePicker format="HH:mm" needConfirm={false} inputReadOnly />
        </Form.Item>
      </div>
      <Form.Item
        name={name('projectId')} label="关联项目"
        extra={!retainedProjectId && !projects.some(project => !project.archived) ? '请先在项目页新建或恢复项目。' : undefined}
        rules={[{ required: true, message: '请选择项目' }, {
          validator: (_, id) => {
            const project = projects.find(project => project.id === id)
            return project && (!project.archived || id === retainedProjectId)
              ? Promise.resolve() : Promise.reject(new Error('请选择进行中的项目'))
          },
        }]}
      >
        <Select
          placeholder="请选择项目"
          options={projects.map(project => ({
            value: project.id, label: `${project.name}${project.archived ? '（已归档）' : ''}`, disabled: project.archived,
          }))}
        />
      </Form.Item>
      {isEvent && (
        <div className="arrangement-field-grid">
          <Form.Item
            name={name('duration')} label="时长（分钟）"
            rules={[{ required: true, type: 'integer', min: 15, max: 1440, message: '填写 15–1440 的整数' }]}
          >
            <InputNumber min={15} max={1440} step={15} />
          </Form.Item>
          <Form.Item name={name('remind')} label="提前提醒" extra="仅保存偏好，暂不发送通知。">
            <Select options={[
              { value: 0, label: '不提醒' }, { value: 10, label: '10 分钟' },
              { value: 30, label: '30 分钟' }, { value: 60, label: '1 小时' },
            ]} />
          </Form.Item>
        </div>
      )}
    </div>
  )
}
