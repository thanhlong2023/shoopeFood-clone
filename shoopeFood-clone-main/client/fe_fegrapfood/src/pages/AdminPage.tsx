import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminRestaurantPanel from '../components/admin/AdminRestaurantPanel'
import { useCreate, useDelete, useList, useUpdate } from '@refinedev/core'
import type { HttpError } from '@refinedev/core'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../services/api/categories'
import { createFood, deleteFood, getFoods, updateFood } from '../services/api/foods'
import { getDrivers } from '../services/api/drivers'
import { getOrders } from '../services/api/orders'
import AdminCategoryPanel from '../components/admin/AdminCategoryPanel'
import AdminDriverApplicationsPanel from '../components/admin/AdminDriverApplicationsPanel'
import ImageUrlField from '../components/common/ImageUrlField'
import { getAllRestaurantsForAdmin } from '../services/api/restaurants'
import { foodPhotoStyle } from '../utils/foodImage'
import type { Category, Driver, Food, Order, Restaurant } from '../types'

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

type MenuFoodForm = {
  id: number | null
  name: string
  imageUrl: string
  price: string
  restaurantId: string
  categoryId: string
  defaultQuantity: string
  currentQuantity: string
  isAvailable: boolean
}

type MenuCategoryForm = {
  id: number | null
  restaurantId: string
  name: string
}

type MenuFoodFormErrors = Partial<
  Record<'name' | 'price' | 'restaurantId' | 'categoryId' | 'defaultQuantity' | 'currentQuantity', string>
>
type MenuCategoryFormErrors = Partial<Record<'restaurantId' | 'name', string>>

const emptyFoodForm: MenuFoodForm = {
  id: null,
  name: '',
  imageUrl: '',
  price: '',
  restaurantId: '',
  categoryId: '',
  defaultQuantity: '20',
  currentQuantity: '20',
  isAvailable: true,
}

const emptyCategoryForm: MenuCategoryForm = {
  id: null,
  restaurantId: '',
  name: '',
}

const ROLE_LABELS: Record<string, string> = {
  CUSTOMER: 'CUSTOMER - Khách hàng',
  DRIVER: 'DRIVER - Tài xế',
  MERCHANT: 'MERCHANT - Chủ quán',
  ADMIN: 'ADMIN - Quản trị',
}

const resourceConfigs: ResourceConfig[] = [
  {
    name: 'menu-manager',
    title: 'Menu',
    description: 'Quản lý menu theo nhà hàng, lọc danh mục và món ăn.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
  },
  {
    name: 'orders',
    title: 'Đơn hàng',
    description: 'Theo dõi và cập nhật trạng thái đơn hàng.',
    columns: ['id', 'orderCode', 'customerId', 'restaurantId', 'driverId', 'statusCode', 'totalAmount', 'createdAt'],
    fields: [
      { key: 'statusCode', label: 'Trạng thái', type: 'select', options: ['PENDING', 'CONFIRMED', 'PICKING_UP', 'DELIVERING', 'COMPLETED', 'CANCELLED'] },
      { key: 'receiverAddress', label: 'Địa chỉ giao', type: 'text' },
      { key: 'distanceKm', label: 'Khoảng cách km', type: 'number' },
      { key: 'discountAmount', label: 'Giảm giá', type: 'number', defaultValue: 0 },
      { key: 'taxAmount', label: 'Thuế', type: 'number', defaultValue: 0 },
    ],
    canCreate: false,
  },
  {
    name: 'restaurant-manager',
    title: 'Nhà hàng',
    description: 'Tạo quán cho chủ quán, duyệt và quản lý danh sách.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
  },
  {
    name: 'foods',
    title: 'Món ăn',
    description: 'Quản lý menu, giá và số lượng món mỗi ngày.',
    columns: ['id', 'name', 'categoryId', 'price', 'isAvailable', 'currentQuantity', 'defaultQuantity'],
    fields: [
      { key: 'categoryId', label: 'Category ID', type: 'number', nullable: true },
      { key: 'name', label: 'Tên món', type: 'text' },
      { key: 'price', label: 'Giá', type: 'number' },
      { key: 'defaultQuantity', label: 'Số lượng mặc định', type: 'number', defaultValue: 20 },
      { key: 'currentQuantity', label: 'Số lượng hiện tại', type: 'number', defaultValue: 20 },
      { key: 'isAvailable', label: 'Đang bán', type: 'checkbox', defaultValue: true },
    ],
    canCreate: false,
  },
  {
    name: 'category-manager',
    title: 'Danh mục',
    description: 'Tạo danh mục theo đúng nhà hàng.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
  },
  {
    name: 'driver-applications',
    title: 'Đơn tài xế',
    description: 'Duyệt đơn đăng ký tài xế từ khách hàng.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
  },
  {
    name: 'drivers',
    title: 'Tài xế',
    description: 'Quản lý tài xế, biển số và trạng thái online.',
    columns: ['id', 'fullName', 'phone', 'vehicleType', 'licensePlate', 'isOnline', 'ratingAvg'],
    fields: [
      { key: 'fullName', label: 'Họ tên', type: 'text' },
      { key: 'phone', label: 'Số điện thoại', type: 'text' },
      { key: 'password', label: 'Mật khẩu', type: 'text', defaultValue: '123456' },
      { key: 'vehicleType', label: 'Loại xe', type: 'text', defaultValue: 'Motorbike' },
      { key: 'licensePlate', label: 'Biển số', type: 'text' },
      { key: 'ratingAvg', label: 'Rating', type: 'number', defaultValue: 5 },
      { key: 'isOnline', label: 'Online', type: 'checkbox', defaultValue: false },
    ],
  },
  {
    name: 'users',
    title: 'Người dùng',
    description: 'Quản lý tài khoản khách hàng và nhân sự.',
    columns: ['id', 'fullName', 'phone', 'roles', 'ratingAvg', 'createdAt'],
    fields: [
      { key: 'fullName', label: 'Họ tên', type: 'text' },
      { key: 'phone', label: 'Số điện thoại', type: 'text' },
      {
        key: 'role',
        label: 'Vai trò',
        type: 'select',
        options: ['CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN'],
        defaultValue: 'CUSTOMER',
      },
      { key: 'password', label: 'Mật khẩu', type: 'text', defaultValue: '123456' },
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
    let sourceValue: unknown = record ? record[field.key] : undefined
    if (record && field.key === 'role' && Array.isArray(record.roles)) {
      sourceValue = record.roles[0] ?? ''
    }
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
        setFeedback(`Đã cập nhật ${config.title.toLowerCase()} #${editingRecord.id}`)
      } else {
        await createRecord({ values })
        setFeedback(`Đã tạo ${config.title.toLowerCase()} mới`)
      }

      resetForm()
      await query.refetch()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Thao tác thất bại')
    }
  }

  async function handleDelete(record: AdminRecord) {
    const confirmed = window.confirm(`Xóa ${config.title.toLowerCase()} #${record.id}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteRecord({ resource: config.name, id: record.id })
      setFeedback(`Đã xóa #${record.id}`)
      await query.refetch()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Không thể xóa')
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
            Tải lại
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
                        Sửa
                      </button>
                      {canDelete ? (
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => void handleDelete(record)}
                          disabled={deleteMutation.isPending}
                        >
                          Xóa
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {query.isLoading ? <p className="empty-state">Đang tải dữ liệu...</p> : null}
          {!query.isLoading && records.length === 0 ? <p className="empty-state">Chưa có dữ liệu.</p> : null}
        </div>
      </section>

      {(canCreate || editingRecord) && (
        <aside className="admin-form-panel">
          <div className="driver-control-head">
            <span>{editingRecord ? `Edit #${editingRecord.id}` : 'Create'}</span>
            <h2>{config.title}</h2>
            <p>{canCreate || editingRecord ? 'Nhập thông tin và lưu vào backend.' : 'Resource nay chỉ cập nhật bản ghi có sẵn.'}</p>
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
                            {field.key === 'role' ? ROLE_LABELS[option] || option : option}
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
                {isSaving ? 'Đang lưu...' : editingRecord ? 'Lưu thay đổi' : 'Tạo mới'}
              </button>
              <button type="button" className="button-secondary" onClick={resetForm}>
                Hủy
              </button>
            </div>
          </form>
        </aside>
      )}
    </div>
  )
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function isSameLocalDate(value: string, target = new Date()) {
  const date = new Date(value)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

function MenuManagerPanel() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [availabilityFilter, setAvailabilityFilter] = useState('all')
  const [foodForm, setFoodForm] = useState<MenuFoodForm>(emptyFoodForm)
  const [categoryForm, setCategoryForm] = useState<MenuCategoryForm>(emptyCategoryForm)
  const [foodFormErrors, setFoodFormErrors] = useState<MenuFoodFormErrors>({})
  const [categoryFormErrors, setCategoryFormErrors] = useState<MenuCategoryFormErrors>({})
  const [feedback, setFeedback] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingFood, setIsSavingFood] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories])
  const restaurantById = useMemo(() => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])), [restaurants])

  const visibleCategories = useMemo(() => {
    if (!restaurantFilter) {
      return categories
    }

    return categories.filter((category) => category.restaurantId === Number(restaurantFilter))
  }, [categories, restaurantFilter])

  const categoryOptions = useMemo(() => {
    if (!foodForm.restaurantId) {
      return []
    }

    return categories.filter((category) => category.restaurantId === Number(foodForm.restaurantId))
  }, [categories, foodForm.restaurantId])

  const canSubmitFood = foodForm.restaurantId !== '' && foodForm.categoryId !== ''

  const stats = useMemo(() => {
    const available = foods.filter((food) => food.isAvailable && Number(food.currentQuantity || 0) > 0).length
    const soldOut = foods.length - available
    const totalStock = foods.reduce((total, food) => total + Number(food.currentQuantity || 0), 0)

    return { available, soldOut, totalStock }
  }, [foods])

  async function loadMenuData() {
    try {
      setIsLoading(true)
      setFeedback(null)

      const foodFilters = {
        ...(restaurantFilter ? { restaurantId: Number(restaurantFilter) } : {}),
        ...(categoryFilter ? { categoryId: Number(categoryFilter) } : {}),
        ...(searchTerm.trim() ? { name: searchTerm.trim() } : {}),
        ...(availabilityFilter !== 'all' ? { isAvailable: availabilityFilter === 'true' } : {}),
      }

      const [restaurantData, categoryData, foodData] = await Promise.all([
        getAllRestaurantsForAdmin(),
        getCategories(),
        getFoods(foodFilters),
      ])

      setRestaurants(restaurantData)
      setCategories(categoryData)
      setFoods(foodData)
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Không thể tải dữ liệu menu')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadMenuData()
  }, [])

  useEffect(() => {
    setCategoryFilter('')
    setFoodForm((current) => ({
      ...current,
      restaurantId: restaurantFilter,
      categoryId: '',
    }))
    setCategoryForm((current) => ({
      ...current,
      restaurantId: restaurantFilter || current.restaurantId,
    }))
  }, [restaurantFilter])

  async function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await loadMenuData()
  }

  function resetFoodForm() {
    setFoodForm({
      ...emptyFoodForm,
      restaurantId: restaurantFilter,
      categoryId: categoryFilter,
    })
  }

  function resetCategoryForm() {
    setCategoryForm({
      ...emptyCategoryForm,
      restaurantId: restaurantFilter,
    })
  }

  function updateFoodFormField<K extends keyof MenuFoodForm>(field: K, value: MenuFoodForm[K]) {
    setFoodForm((current) => ({ ...current, [field]: value }))
    setFoodFormErrors((current) => {
      if (!(field in current)) return current
      return { ...current, [field]: undefined }
    })
  }

  async function handleFoodSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = foodForm.name.trim()
    const price = Number(foodForm.price)
    const restaurantId = foodForm.restaurantId ? Number(foodForm.restaurantId) : null
    const categoryId = foodForm.categoryId ? Number(foodForm.categoryId) : null
    const defaultQuantity = Number(foodForm.defaultQuantity || 0)
    const currentQuantity = Number(foodForm.currentQuantity || 0)
    const nextErrors: MenuFoodFormErrors = {}

    if (!name) {
      nextErrors.name = 'Tên món là bắt buộc'
    }

    if (!Number.isFinite(price) || price < 0) {
      nextErrors.price = 'Giá phải là số không âm'
    }

    if (!Number.isInteger(defaultQuantity) || defaultQuantity < 0) {
      nextErrors.defaultQuantity = 'Số lượng mặc định phải là số nguyên không âm'
    }

    if (!Number.isInteger(currentQuantity) || currentQuantity < 0) {
      nextErrors.currentQuantity = 'Số lượng hiện tại phải là số nguyên không âm'
    } else if (Number.isInteger(defaultQuantity) && defaultQuantity >= 0 && currentQuantity > defaultQuantity) {
      nextErrors.currentQuantity = 'Số lượng hiện tại không được lớn hơn số lượng mặc định'
    }

    if (restaurantId === null) {
      nextErrors.restaurantId = 'Phải chọn nhà hàng'
    }

    if (categoryId === null) {
      nextErrors.categoryId = 'Phải chọn danh mục'
    }

    const selectedCategory = categoryId !== null ? categories.find((category) => category.id === categoryId) : null
    if (selectedCategory && restaurantId !== null && selectedCategory.restaurantId !== restaurantId) {
      nextErrors.categoryId = 'Danh mục không thuộc nhà hàng đã chọn'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFoodFormErrors(nextErrors)
      return
    }

    setFoodFormErrors({})

    try {
      setIsSavingFood(true)
      setFeedback(null)

      const payload = {
        name,
        imageUrl: foodForm.imageUrl.trim() || null,
        price,
        categoryId,
        defaultQuantity,
        currentQuantity,
        isAvailable: foodForm.isAvailable,
      }

      if (foodForm.id) {
        await updateFood(foodForm.id, payload)
        setFeedback(`Đã cập nhật món #${foodForm.id}`)
      } else {
        await createFood(payload)
        setFeedback('Đã tạo món mới')
      }

      resetFoodForm()
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Lưu món thất bại')
    } finally {
      setIsSavingFood(false)
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = categoryForm.name.trim()
    const restaurantId = Number(categoryForm.restaurantId)
    const nextErrors: MenuCategoryFormErrors = {}

    if (!Number.isFinite(restaurantId) || !categoryForm.restaurantId) {
      nextErrors.restaurantId = 'Phải chọn nhà hàng'
    }

    if (!name) {
      nextErrors.name = 'Tên danh mục là bắt buộc'
    }

    if (Object.keys(nextErrors).length > 0) {
      setCategoryFormErrors(nextErrors)
      return
    }

    setCategoryFormErrors({})

    try {
      setIsSavingCategory(true)
      setFeedback(null)

      if (categoryForm.id) {
        await updateCategory(categoryForm.id, { name, restaurantId })
        setFeedback(`Đã cập nhật danh mục #${categoryForm.id}`)
      } else {
        await createCategory({ name, restaurantId })
        setFeedback('Đã tạo danh mục mới')
      }

      resetCategoryForm()
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Lưu danh mục thất bại')
    } finally {
      setIsSavingCategory(false)
    }
  }

  async function handleDeleteFood(food: Food) {
    const confirmed = window.confirm(`Xóa món ${food.name}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteFood(food.id)
      setFeedback(`Đã xóa món #${food.id}`)
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Không thể xóa món')
    }
  }

  async function handleDeleteCategory(category: Category) {
    const confirmed = window.confirm(`Xóa danh mục ${category.name}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteCategory(category.id)
      setFeedback(`Đã xóa danh mục #${category.id}`)
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Không thể xóa danh mục')
    }
  }

  return (
    <div className="menu-manager">
      <section className="menu-manager-hero">
        <div>
          <span className="hero-badge">Nguoi 4</span>
          <h2>Quản lý menu theo nhà hàng</h2>
          <p>CRUD danh mục, CRUD món ăn và kiểm tra API lọc menu theo nhà hàng, danh mục, tên món, trạng thái bàn.</p>
        </div>
        <div className="menu-stat-grid">
          <div>
            <span>Món hiển thị</span>
            <strong>{foods.length}</strong>
          </div>
          <div>
            <span>Đang bán</span>
            <strong>{stats.available}</strong>
          </div>
          <div>
            <span>Hết/Tạm dừng</span>
            <strong>{stats.soldOut}</strong>
          </div>
          <div>
            <span>Tồn kho</span>
            <strong>{stats.totalStock}</strong>
          </div>
        </div>
      </section>

      {feedback ? <p className={feedback.includes('thất bại') || feedback.includes('Không') ? 'app-feedback error' : 'restaurant-feedback success'}>{feedback}</p> : null}

      <form className="menu-filter-bar" onSubmit={(event) => void applyFilters(event)}>
        <label>
          <span>Nhà hàng</span>
          <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
            <option value="">Tất cả nhà hàng</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                #{restaurant.id} - {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Danh mục</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Tất cả danh mục</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                #{category.id} - {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tìm món</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nhập tên món" />
        </label>
        <label>
          <span>Trạng thái</span>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
            <option value="all">Tất cả</option>
            <option value="true">Đang bán</option>
            <option value="false">Tạm dừng</option>
          </select>
        </label>
        <button type="submit" className="button-primary" disabled={isLoading}>
          {isLoading ? 'Đang tải...' : 'Lọc menu'}
        </button>
      </form>

      <div className="menu-manager-layout">
        <section className="admin-panel menu-list-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Danh sách món ăn</h2>
              <p>Kết quả lấy từ GET /api/foods với query filter đang chọn.</p>
            </div>
            <button type="button" className="button-secondary" onClick={() => void loadMenuData()} disabled={isLoading}>
              Tải lại
            </button>
          </div>

          <div className="menu-card-grid">
            {foods.map((food) => {
              const category = food.categoryId ? categoryById.get(food.categoryId) : null
              const restaurant = category ? restaurantById.get(category.restaurantId) : null
              const isSoldOut = !food.isAvailable || Number(food.currentQuantity || 0) <= 0

              return (
                <article key={food.id} className={`menu-admin-card ${isSoldOut ? 'sold-out' : ''}`}>
                  <div
                    className={`menu-admin-card-photo ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                    style={foodPhotoStyle(food.imageUrl, food.id)}
                  />
                  <div className="menu-admin-card-head">
                    <div>
                      <span>#{food.id}</span>
                      <h3>{food.name}</h3>
                    </div>
                    <strong>{formatMoney(Number(food.price))} VND</strong>
                  </div>
                  <div className="menu-admin-meta">
                    <span>{restaurant ? restaurant.name : 'Chưa gắn nhà hàng'}</span>
                    <span>{category ? category.name : 'Chưa có danh mục'}</span>
                    <span>{food.isAvailable ? 'Đang bán' : 'Tạm dừng'}</span>
                    <span>
                      {food.currentQuantity}/{food.defaultQuantity} món
                    </span>
                  </div>
                </article>
              )
            })}
          </div>

          {!isLoading && foods.length === 0 ? <p className="empty-state">Không có món phù hợp với bộ lọc.</p> : null}
        </section>

      </div>
    </div>
  )
}

const TAB_QUERY_KEY = 'tab'

const tabToResource: Record<string, string> = {
  menu: 'menu-manager',
  orders: 'orders',
  restaurants: 'restaurant-manager',
  foods: 'foods',
  categories: 'category-manager',
  'driver-applications': 'driver-applications',
  drivers: 'drivers',
  users: 'users',
}

const resourceToTab = Object.fromEntries(Object.entries(tabToResource).map(([tab, resource]) => [resource, tab]))

function resolveResourceFromTab(tab: string | null) {
  if (!tab) return null
  return tabToResource[tab] ?? null
}

export default function AdminPage() {
  useDocumentTitle(`${APP_NAME} | Admin`)

  const { user } = useAuth()
  const [dashboardRestaurants, setDashboardRestaurants] = useState<Restaurant[]>([])
  const [dashboardOrders, setDashboardOrders] = useState<Order[]>([])
  const [dashboardDrivers, setDashboardDrivers] = useState<Driver[]>([])
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get(TAB_QUERY_KEY)
  const [activeResource, setActiveResource] = useState(
    () => resolveResourceFromTab(tabFromUrl) || resourceConfigs[0].name,
  )

  const config = useMemo(
    () => resourceConfigs.find((resource) => resource.name === activeResource) || resourceConfigs[0],
    [activeResource],
  )

  useEffect(() => {
    const nextResource = resolveResourceFromTab(tabFromUrl)
    if (nextResource) {
      setActiveResource(nextResource)
    }
  }, [tabFromUrl])

  useEffect(() => {
    let ignore = false

    async function loadDashboardStats() {
      try {
        setDashboardError(null)
        const [restaurantData, orderData, driverData] = await Promise.all([
          getAllRestaurantsForAdmin(),
          getOrders(),
          getDrivers(),
        ])

        if (!ignore) {
          setDashboardRestaurants(restaurantData)
          setDashboardOrders(orderData)
          setDashboardDrivers(driverData)
        }
      } catch (error) {
        if (!ignore) {
          setDashboardError(error instanceof Error ? error.message : 'Không thể tải thống kê dashboard')
        }
      }
    }

    void loadDashboardStats()

    return () => {
      ignore = true
    }
  }, [])

  const dashboardStats = useMemo(() => {
    const todayOrders = dashboardOrders.filter((order) => isSameLocalDate(order.createdAt))
    const todayRevenue = todayOrders
      .filter((order) => order.statusCode !== 'CANCELLED' && order.statusCode !== 'TIMEOUT')
      .reduce((total, order) => total + Number(order.totalAmount || 0), 0)
    const waitingOrders = dashboardOrders.filter((order) =>
      ['PENDING', 'DRIVER_ACCEPTED', 'CONFIRMED'].includes(order.statusCode || ''),
    ).length
    const onlineDrivers = dashboardDrivers.filter((driver) => driver.isOnline).length

    return {
      restaurants: dashboardRestaurants.filter((restaurant) => !restaurant.deletedAt).length,
      todayOrders: todayOrders.length,
      todayRevenue,
      waitingOrders,
      onlineDrivers,
    }
  }, [dashboardDrivers, dashboardOrders, dashboardRestaurants])

  function selectResource(name: string) {
    setActiveResource(name)
    const tab = resourceToTab[name]
    const next = new URLSearchParams(searchParams)
    if (tab) {
      next.set(TAB_QUERY_KEY, tab)
    } else {
      next.delete(TAB_QUERY_KEY)
    }
    next.delete('action')
    setSearchParams(next, { replace: true })
  }

  return (
    <section className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-header">
          <span className="hero-badge">Admin Panel</span>
          <p>Quản trị hệ thống GrabFood</p>
        </div>
        <div className="admin-tabs-vertical" aria-label="Admin resources">
          {resourceConfigs.map((resource) => (
            <button
              key={resource.name}
              type="button"
              className={resource.name === activeResource ? 'active' : ''}
              onClick={() => selectResource(resource.name)}
            >
              {resource.title}
            </button>
          ))}
        </div>
      </aside>

      <main className="admin-content">
        <div className="admin-header">
          <div>
            <h1>Dashboard</h1>
            <p>{user ? `${user.fullName || user.phone} đang đăng nhập với role ${user.role}` : 'Quản lý dữ liệu hệ thống.'}</p>
          </div>
          <div className="admin-kpis">
            <div>
              <span>Tổng nhà hàng</span>
              <strong>{dashboardStats.restaurants}</strong>
            </div>
            <div>
              <span>Đơn hôm nay</span>
              <strong>{dashboardStats.todayOrders}</strong>
            </div>
            <div>
              <span>Doanh thu hôm nay</span>
              <strong>{formatMoney(dashboardStats.todayRevenue)}</strong>
            </div>
            <div>
              <span>Đơn chờ xử lý</span>
              <strong>{dashboardStats.waitingOrders}</strong>
            </div>
            <div>
              <span>Tài xế đang hoạt động</span>
              <strong>{dashboardStats.onlineDrivers}</strong>
            </div>
          </div>
        </div>

      {dashboardError ? <p className="restaurant-feedback error">{dashboardError}</p> : null}

      {config.name === 'menu-manager' ? (
        <MenuManagerPanel />
      ) : config.name === 'restaurant-manager' ? (
        <AdminRestaurantPanel />
      ) : config.name === 'category-manager' ? (
        <AdminCategoryPanel />
      ) : config.name === 'driver-applications' ? (
        <AdminDriverApplicationsPanel />
      ) : (
        <AdminResourcePanel key={config.name} config={config} />
      )}
      </main>
    </section>
  )
}
