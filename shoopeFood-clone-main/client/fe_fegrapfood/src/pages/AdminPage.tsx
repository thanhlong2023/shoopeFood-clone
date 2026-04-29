import { useMemo, useState, type FormEvent } from 'react'
import { useCreate, useDelete, useList, useUpdate } from '@refinedev/core'
import type { HttpError } from '@refinedev/core'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

type AdminRecord = Record<string, unknown> & {
  id: number | string
}

type FieldValue = string | number | boolean | null
type FieldType = 'text' | 'number' | 'checkbox' | 'select'

type FieldConfig = {
  key: string
  label: string
  type: FieldType
  defaultValue?: FieldValue
  nullable?: boolean
  options?: string[]
}

type ResourceConfig = {
  name: string
  title: string
  description: string
  columns: string[]
  fields: FieldConfig[]
  canCreate?: boolean
  canDelete?: boolean
}

const resourceConfigs: ResourceConfig[] = [
  {
    name: 'orders',
    title: 'Don hang',
    description: 'Theo doi va cap nhat trang thai don hang.',
    columns: ['id', 'orderCode', 'customerId', 'restaurantId', 'driverId', 'statusCode', 'totalAmount', 'createdAt'],
    fields: [
      { key: 'statusCode', label: 'Trang thai', type: 'select', options: ['PENDING', 'CONFIRMED', 'PICKING_UP', 'DELIVERING', 'COMPLETED', 'CANCELLED'] },
      { key: 'driverId', label: 'Driver ID', type: 'number', nullable: true },
      { key: 'receiverAddress', label: 'Dia chi giao', type: 'text' },
      { key: 'distanceKm', label: 'Khoang cach km', type: 'number' },
      { key: 'discountAmount', label: 'Giam gia', type: 'number', defaultValue: 0 },
      { key: 'taxAmount', label: 'Thue', type: 'number', defaultValue: 0 },
    ],
    canCreate: false,
  },
  {
    name: 'restaurants',
    title: 'Nha hang',
    description: 'Quan ly quan an, vi tri va trang thai mo cua.',
    columns: ['id', 'name', 'ownerId', 'address', 'isOpen', 'ratingAvg'],
    fields: [
      { key: 'ownerId', label: 'Owner ID', type: 'number', defaultValue: 1 },
      { key: 'name', label: 'Ten nha hang', type: 'text' },
      { key: 'address', label: 'Dia chi', type: 'text' },
      { key: 'latitude', label: 'Latitude', type: 'number', defaultValue: 10.7769 },
      { key: 'longitude', label: 'Longitude', type: 'number', defaultValue: 106.7009 },
      { key: 'imageUrl', label: 'Image URL', type: 'text', nullable: true },
      { key: 'ratingAvg', label: 'Rating', type: 'number', defaultValue: 5 },
      { key: 'isOpen', label: 'Dang mo cua', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    name: 'foods',
    title: 'Mon an',
    description: 'Quan ly menu, gia va so luong mon moi ngay.',
    columns: ['id', 'name', 'categoryId', 'price', 'isAvailable', 'currentQuantity', 'defaultQuantity'],
    fields: [
      { key: 'categoryId', label: 'Category ID', type: 'number', nullable: true },
      { key: 'name', label: 'Ten mon', type: 'text' },
      { key: 'price', label: 'Gia', type: 'number' },
      { key: 'defaultQuantity', label: 'So luong mac dinh', type: 'number', defaultValue: 20 },
      { key: 'currentQuantity', label: 'So luong hien tai', type: 'number', defaultValue: 20 },
      { key: 'isAvailable', label: 'Dang ban', type: 'checkbox', defaultValue: true },
    ],
  },
  {
    name: 'categories',
    title: 'Danh muc',
    description: 'Nhom mon theo nha hang.',
    columns: ['id', 'restaurantId', 'name'],
    fields: [
      { key: 'restaurantId', label: 'Restaurant ID', type: 'number', defaultValue: 1 },
      { key: 'name', label: 'Ten danh muc', type: 'text' },
    ],
  },
  {
    name: 'drivers',
    title: 'Tai xe',
    description: 'Quan ly tai xe, bien so va trang thai online.',
    columns: ['id', 'fullName', 'phone', 'vehicleType', 'licensePlate', 'isOnline', 'ratingAvg'],
    fields: [
      { key: 'fullName', label: 'Ho ten', type: 'text' },
      { key: 'phone', label: 'So dien thoai', type: 'text' },
      { key: 'password', label: 'Mat khau', type: 'text', defaultValue: '123456' },
      { key: 'vehicleType', label: 'Loai xe', type: 'text', defaultValue: 'Motorbike' },
      { key: 'licensePlate', label: 'Bien so', type: 'text' },
      { key: 'ratingAvg', label: 'Rating', type: 'number', defaultValue: 5 },
      { key: 'isOnline', label: 'Online', type: 'checkbox', defaultValue: false },
    ],
  },
  {
    name: 'users',
    title: 'Nguoi dung',
    description: 'Quan ly tai khoan khach hang va nhan su.',
    columns: ['id', 'fullName', 'phone', 'roles', 'ratingAvg', 'createdAt'],
    fields: [
      { key: 'fullName', label: 'Ho ten', type: 'text' },
      { key: 'phone', label: 'So dien thoai', type: 'text' },
      { key: 'password', label: 'Mat khau', type: 'text', defaultValue: '123456' },
      { key: 'ratingAvg', label: 'Rating', type: 'number', defaultValue: 5 },
    ],
  },
]

function formatCellValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(', ')
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No'
  }

  if (value === null || value === undefined || value === '') {
    return '-'
  }

  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(2)
  }

  return String(value)
}

function getInitialForm(fields: FieldConfig[], record?: AdminRecord | null) {
  return fields.reduce<Record<string, FieldValue>>((values, field) => {
    const sourceValue = record ? record[field.key] : undefined
    values[field.key] = (sourceValue as FieldValue | undefined) ?? field.defaultValue ?? (field.type === 'checkbox' ? false : '')
    return values
  }, {})
}

function parseFieldValue(field: FieldConfig, value: FieldValue) {
  if (field.type === 'checkbox') {
    return Boolean(value)
  }

  if (field.type === 'number') {
    if (value === '' || value === null) {
      return field.nullable ? null : 0
    }

    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : field.nullable ? null : 0
  }

  const textValue = String(value ?? '').trim()
  return field.nullable && !textValue ? null : textValue
}

function buildPayload(fields: FieldConfig[], form: Record<string, FieldValue>) {
  return fields.reduce<Record<string, unknown>>((payload, field) => {
    payload[field.key] = parseFieldValue(field, form[field.key])
    return payload
  }, {})
}

type AdminResourcePanelProps = {
  config: ResourceConfig
}

function AdminResourcePanel({ config }: AdminResourcePanelProps) {
  const { result, query } = useList<AdminRecord, HttpError>({
    resource: config.name,
    pagination: { mode: 'off' },
  })
  const { mutateAsync: createRecord, mutation: createMutation } = useCreate<AdminRecord, HttpError, Record<string, unknown>>({
    resource: config.name,
  })
  const { mutateAsync: updateRecord, mutation: updateMutation } = useUpdate<AdminRecord, HttpError, Record<string, unknown>>({
    resource: config.name,
  })
  const { mutateAsync: deleteRecord, mutation: deleteMutation } = useDelete<AdminRecord, HttpError>()
  const [form, setForm] = useState(() => getInitialForm(config.fields))
  const [editingRecord, setEditingRecord] = useState<AdminRecord | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  const records = result.data ?? []
  const canCreate = config.canCreate !== false
  const canDelete = config.canDelete !== false
  const isSaving = createMutation.isPending || updateMutation.isPending

  function resetForm() {
    setEditingRecord(null)
    setForm(getInitialForm(config.fields))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setFeedback(null)
      const values = buildPayload(config.fields, form)

      if (editingRecord) {
        await updateRecord({ id: editingRecord.id, values })
        setFeedback(`Da cap nhat ${config.title.toLowerCase()} #${editingRecord.id}`)
      } else {
        await createRecord({ values })
        setFeedback(`Da tao ${config.title.toLowerCase()} moi`)
      }

      resetForm()
      await query.refetch()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Thao tac that bai')
    }
  }

  async function handleDelete(record: AdminRecord) {
    const confirmed = window.confirm(`Xoa ${config.title.toLowerCase()} #${record.id}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteRecord({ resource: config.name, id: record.id })
      setFeedback(`Da xoa #${record.id}`)
      await query.refetch()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Khong the xoa')
    }
  }

  return (
    <div className="admin-workspace">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <button type="button" className="button-secondary" onClick={() => void query.refetch()} disabled={query.isFetching}>
            Reload
          </button>
        </div>

        {feedback ? <p className={feedback.includes('that bai') || feedback.includes('Khong') ? 'app-feedback error' : 'restaurant-feedback success'}>{feedback}</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                {config.columns.map((column) => (
                  <th key={column}>{column}</th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={String(record.id)}>
                  {config.columns.map((column) => (
                    <td key={column}>{formatCellValue(record[column])}</td>
                  ))}
                  <td>
                    <div className="admin-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => {
                          setEditingRecord(record)
                          setForm(getInitialForm(config.fields, record))
                        }}
                      >
                        Edit
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => void handleDelete(record)}
                          disabled={deleteMutation.isPending}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {query.isLoading ? <p className="empty-state">Dang tai du lieu...</p> : null}
          {!query.isLoading && records.length === 0 ? <p className="empty-state">Chua co du lieu.</p> : null}
        </div>
      </section>

      <aside className="admin-form-panel">
        <div className="driver-control-head">
          <span>{editingRecord ? `Edit #${editingRecord.id}` : 'Create'}</span>
          <h2>{config.title}</h2>
          <p>{canCreate || editingRecord ? 'Nhap thong tin va luu vao backend.' : 'Resource nay chi cap nhat ban ghi co san.'}</p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          {config.fields.map((field) => (
            <label key={field.key} className={field.type === 'checkbox' ? 'restaurant-checkbox' : 'restaurant-field'}>
              {field.type === 'checkbox' ? (
                <>
                  <input
                    type="checkbox"
                    checked={Boolean(form[field.key])}
                    onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.checked }))}
                  />
                  <span>{field.label}</span>
                </>
              ) : (
                <>
                  <span>{field.label}</span>
                  {field.type === 'select' ? (
                    <select
                      value={String(form[field.key] ?? '')}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    >
                      {(field.options || []).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={String(form[field.key] ?? '')}
                      onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                    />
                  )}
                </>
              )}
            </label>
          ))}

          <div className="restaurant-form-actions">
            <button type="submit" className="button-primary" disabled={isSaving || (!canCreate && !editingRecord)}>
              {isSaving ? 'Saving...' : editingRecord ? 'Save changes' : 'Create'}
            </button>
            <button type="button" className="button-secondary" onClick={resetForm}>
              Clear
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}

export default function AdminPage() {
  useDocumentTitle(`${APP_NAME} | Admin`)

  const { user } = useAuth()
  const [activeResource, setActiveResource] = useState(resourceConfigs[0].name)
  const config = useMemo(
    () => resourceConfigs.find((resource) => resource.name === activeResource) || resourceConfigs[0],
    [activeResource],
  )

  return (
    <section className="admin-page">
      <div className="admin-header">
        <div>
          <span className="hero-badge">Admin</span>
          <h1>Quan tri he thong GrabFood</h1>
          <p>{user ? `${user.fullName || user.phone} dang dang nhap voi role ${user.role}` : 'Quan ly du lieu he thong.'}</p>
        </div>
        <div className="admin-kpis">
          <div>
            <span>API</span>
            <strong>/api</strong>
          </div>
          <div>
            <span>Provider</span>
            <strong>simple-rest</strong>
          </div>
        </div>
      </div>

      <div className="admin-tabs" aria-label="Admin resources">
        {resourceConfigs.map((resource) => (
          <button
            key={resource.name}
            type="button"
            className={resource.name === activeResource ? 'active' : ''}
            onClick={() => setActiveResource(resource.name)}
          >
            {resource.title}
          </button>
        ))}
      </div>

      <AdminResourcePanel key={config.name} config={config} />
    </section>
  )
}
