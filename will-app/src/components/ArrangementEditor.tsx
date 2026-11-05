import { CheckOutlined, DeleteOutlined } from '@ant-design/icons'
import { Alert, App, Button, Form, Modal } from 'antd'
import { useRef, useState } from 'react'
import { fromArrangementForm, toArrangementForm, type ArrangementFormValue } from '../domain/arrangementForm'
import type { ArrangementDraft } from '../domain/schedule'
import type { Project } from '../domain/projects'
import { ArrangementFields } from './ArrangementFields'
import './ArrangementEditor.css'

export type EditorMode = 'create' | 'edit'
type ArrangementEditorProps = {
  initial: ArrangementDraft
  mode: EditorMode
  onClose: () => void
  onSave: (draft: ArrangementDraft, mode: EditorMode) => boolean
  onDelete: (id: string) => boolean
  projects: Project[]
}

export function ArrangementEditor({ initial, mode, onClose, onSave, onDelete, projects }: ArrangementEditorProps) {
  const [form] = Form.useForm<ArrangementFormValue>()
  const kind = Form.useWatch('kind', form) ?? initial.kind
  const [error, setError] = useState('')
  const finishedRef = useRef(false)
  const { modal, message } = App.useApp()
  const isEdit = mode === 'edit'

  const notify = (persisted: boolean, text: string) => {
    if (persisted) void message.success(text)
    else void message.warning(`${text}，仅在本次页面中保留，请勿刷新。`)
  }

  const save = (values: ArrangementFormValue) => {
    if (finishedRef.current) return
    try {
      const persisted = onSave(fromArrangementForm(values), mode)
      finishedRef.current = true
      notify(persisted, isEdit ? '已保存修改' : '已添加安排')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '保存失败，请重试。')
    }
  }

  const requestDelete = () => {
    modal.confirm({
      title: '删除这项安排？',
      content: initial.title,
      okText: '确认删除',
      cancelText: '保留事项',
      okButtonProps: { danger: true },
      focusable: { autoFocusButton: 'cancel' },
      mask: { closable: false },
      onOk: async () => {
        if (finishedRef.current) return
        try {
          const persisted = onDelete(initial.id)
          finishedRef.current = true
          notify(persisted, '已删除安排')
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : '删除失败，请重试。')
          throw cause
        }
      },
    })
  }

  return (
    <Modal
      open title={isEdit ? '编辑安排' : '手动添加安排'} onCancel={onClose}
      width={520} className="arrangement-editor" mask={{ closable: false }}
      footer={
        <div className="arrangement-editor-actions">
          {isEdit && (
            <Button danger icon={<DeleteOutlined />} aria-label="删除事项" onClick={requestDelete}>删除</Button>
          )}
          <div className="arrangement-editor-save">
            <Button aria-label="取消" onClick={onClose}>取消</Button>
            <Button type="primary" icon={<CheckOutlined />} aria-label={isEdit ? '保存修改' : '添加安排'} onClick={() => form.submit()}>
              {isEdit ? '保存修改' : '添加安排'}
            </Button>
          </div>
        </div>
      }
    >
      {error && <Alert className="arrangement-editor-error" type="error" showIcon title={error} role="alert" />}
      <Form
        form={form} name="arrangement-editor" layout="vertical"
        initialValues={toArrangementForm(initial)} onFinish={save}
        scrollToFirstError={{ block: 'center', focus: true }} autoComplete="off"
      >
        <ArrangementFields kind={kind} autoFocusTitle projects={projects} retainedProjectId={isEdit ? initial.projectId : undefined} />
      </Form>
    </Modal>
  )
}
