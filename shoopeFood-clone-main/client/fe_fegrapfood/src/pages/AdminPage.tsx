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
import AdminCategoryPanel from '../components/admin/AdminCategoryPanel'
import ImageUrlField from '../components/common/ImageUrlField'
import { getAllRestaurantsForAdmin } from '../services/api/restaurants'
import { foodPhotoStyle } from '../utils/foodImage'
import type { Category, Food, Restaurant } from '../types'

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
  CUSTOMER: 'CUSTOMER - Khach hang',
  DRIVER: 'DRIVER - Tai xe',
  MERCHANT: 'MERCHANT - Chu quan',
  ADMIN: 'ADMIN - Quan tri',
}

const resourceConfigs: ResourceConfig[] = [
  {
    name: 'menu-manager',
    title: 'Menu',
    description: 'Quan ly menu theo nha hang, loc danh muc va mon an.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
  },
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
    name: 'restaurant-manager',
    title: 'Nha hang',
    description: 'Tao quan cho chu quan, duyet va quan ly danh sach.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
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
    name: 'category-manager',
    title: 'Danh muc',
    description: 'Tao danh muc theo dung nha hang.',
    columns: [],
    fields: [],
    canCreate: false,
    canDelete: false,
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
      {
        key: 'role',
        label: 'Vai tro',
        type: 'select',
        options: ['CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN'],
        defaultValue: 'CUSTOMER',
      },
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
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
      setFeedback(error instanceof Error ? error.message : 'Khong the tai du lieu menu')
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

  async function handleFoodSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = foodForm.name.trim()
    const price = Number(foodForm.price)
    const restaurantId = foodForm.restaurantId ? Number(foodForm.restaurantId) : null
    const categoryId = foodForm.categoryId ? Number(foodForm.categoryId) : null
    const defaultQuantity = Number(foodForm.defaultQuantity || 0)
    const currentQuantity = Number(foodForm.currentQuantity || 0)

    if (!name || !Number.isFinite(price) || price < 0) {
      setFeedback('Ten mon va gia khong am la bat buoc')
      return
    }

    if (!Number.isInteger(defaultQuantity) || defaultQuantity < 0 || !Number.isInteger(currentQuantity) || currentQuantity < 0) {
      setFeedback('So luong phai la so nguyen khong am')
      return
    }

    if (restaurantId === null || categoryId === null) {
      setFeedback('Phai chon nha hang va danh muc')
      return
    }

    const selectedCategory = categories.find((category) => category.id === categoryId)
    if (selectedCategory && selectedCategory.restaurantId !== restaurantId) {
      setFeedback('Danh muc khong thuoc nha hang da chon')
      return
    }

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
        setFeedback(`Da cap nhat mon #${foodForm.id}`)
      } else {
        await createFood(payload)
        setFeedback('Da tao mon moi')
      }

      resetFoodForm()
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Luu mon that bai')
    } finally {
      setIsSavingFood(false)
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = categoryForm.name.trim()
    const restaurantId = Number(categoryForm.restaurantId)

    if (!name || !Number.isFinite(restaurantId)) {
      setFeedback('Ten danh muc va Restaurant ID la bat buoc')
      return
    }

    try {
      setIsSavingCategory(true)
      setFeedback(null)

      if (categoryForm.id) {
        await updateCategory(categoryForm.id, { name, restaurantId })
        setFeedback(`Da cap nhat danh muc #${categoryForm.id}`)
      } else {
        await createCategory({ name, restaurantId })
        setFeedback('Da tao danh muc moi')
      }

      resetCategoryForm()
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Luu danh muc that bai')
    } finally {
      setIsSavingCategory(false)
    }
  }

  async function handleDeleteFood(food: Food) {
    const confirmed = window.confirm(`Xoa mon ${food.name}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteFood(food.id)
      setFeedback(`Da xoa mon #${food.id}`)
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Khong the xoa mon')
    }
  }

  async function handleDeleteCategory(category: Category) {
    const confirmed = window.confirm(`Xoa danh muc ${category.name}?`)

    if (!confirmed) {
      return
    }

    try {
      setFeedback(null)
      await deleteCategory(category.id)
      setFeedback(`Da xoa danh muc #${category.id}`)
      await loadMenuData()
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Khong the xoa danh muc')
    }
  }

  return (
    <div className="menu-manager">
      <section className="menu-manager-hero">
        <div>
          <span className="hero-badge">Nguoi 4</span>
          <h2>Quan ly menu theo nha hang</h2>
          <p>CRUD danh muc, CRUD mon an va kiem tra API loc menu theo restaurant, category, ten mon, trang thai ban.</p>
        </div>
        <div className="menu-stat-grid">
          <div>
            <span>Mon hien thi</span>
            <strong>{foods.length}</strong>
          </div>
          <div>
            <span>Dang ban</span>
            <strong>{stats.available}</strong>
          </div>
          <div>
            <span>Het/tam dung</span>
            <strong>{stats.soldOut}</strong>
          </div>
          <div>
            <span>Ton kho</span>
            <strong>{stats.totalStock}</strong>
          </div>
        </div>
      </section>

      {feedback ? <p className={feedback.includes('that bai') || feedback.includes('Khong') ? 'app-feedback error' : 'restaurant-feedback success'}>{feedback}</p> : null}

      <form className="menu-filter-bar" onSubmit={(event) => void applyFilters(event)}>
        <label>
          <span>Nha hang</span>
          <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
            <option value="">Tat ca nha hang</option>
            {restaurants.map((restaurant) => (
              <option key={restaurant.id} value={restaurant.id}>
                #{restaurant.id} - {restaurant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Danh muc</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">Tat ca danh muc</option>
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                #{category.id} - {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tim mon</span>
          <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Nhap ten mon" />
        </label>
        <label>
          <span>Trang thai</span>
          <select value={availabilityFilter} onChange={(event) => setAvailabilityFilter(event.target.value)}>
            <option value="all">Tat ca</option>
            <option value="true">Dang ban</option>
            <option value="false">Tam dung</option>
          </select>
        </label>
        <button type="submit" className="button-primary" disabled={isLoading}>
          {isLoading ? 'Dang tai...' : 'Loc menu'}
        </button>
      </form>

      <div className="menu-manager-layout">
        <section className="admin-panel menu-list-panel">
          <div className="admin-panel-head">
            <div>
              <h2>Danh sach mon an</h2>
              <p>Ket qua lay tu GET /api/foods voi query filter dang chon.</p>
            </div>
            <button type="button" className="button-secondary" onClick={() => void loadMenuData()} disabled={isLoading}>
              Reload
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
                    className={`menu-admin-card-photo ${foodPhotoStyle(food.imageUrl) ? '' : 'food-photo--placeholder'}`}
                    style={foodPhotoStyle(food.imageUrl)}
                  />
                  <div className="menu-admin-card-head">
                    <div>
                      <span>#{food.id}</span>
                      <h3>{food.name}</h3>
                    </div>
                    <strong>{formatMoney(Number(food.price))} VND</strong>
                  </div>
                  <div className="menu-admin-meta">
                    <span>{restaurant ? restaurant.name : 'Chua gan nha hang'}</span>
                    <span>{category ? category.name : 'Chua co danh muc'}</span>
                    <span>{food.isAvailable ? 'Dang ban' : 'Tam dung'}</span>
                    <span>
                      {food.currentQuantity}/{food.defaultQuantity} mon
                    </span>
                  </div>
                  <div className="admin-actions">
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => {
                        const category = food.categoryId ? categoryById.get(food.categoryId) : null
                        setFoodForm({
                          id: food.id,
                          name: food.name,
                          imageUrl: food.imageUrl ?? '',
                          price: String(food.price),
                          restaurantId: category ? String(category.restaurantId) : '',
                          categoryId: food.categoryId ? String(food.categoryId) : '',
                          defaultQuantity: String(food.defaultQuantity),
                          currentQuantity: String(food.currentQuantity),
                          isAvailable: food.isAvailable,
                        })
                      }}
                    >
                      Edit
                    </button>
                    <button type="button" className="button-danger" onClick={() => void handleDeleteFood(food)}>
                      Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          {!isLoading && foods.length === 0 ? <p className="empty-state">Khong co mon phu hop bo loc.</p> : null}
        </section>

        <aside className="menu-editor-stack">
          <section className="admin-form-panel">
            <div className="driver-control-head">
              <span>{foodForm.id ? `Edit mon #${foodForm.id}` : 'Create food'}</span>
              <h2>Form them/sua mon</h2>
              <p>Gui truc tiep vao POST/PUT /api/foods.</p>
            </div>
            <form className="admin-form" onSubmit={(event) => void handleFoodSubmit(event)}>
              <label className="restaurant-field">
                <span>Ten mon</span>
                <input value={foodForm.name} onChange={(event) => setFoodForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <ImageUrlField
                id="adminFoodImageUrl"
                label="Link hinh anh mon"
                value={foodForm.imageUrl}
                onChange={(value) => setFoodForm((current) => ({ ...current, imageUrl: value }))}
              />
              <label className="restaurant-field">
                <span>Gia</span>
                <input
                  type="number"
                  min="0"
                  value={foodForm.price}
                  onChange={(event) => setFoodForm((current) => ({ ...current, price: event.target.value }))}
                />
              </label>
              <label className="restaurant-field">
                <span>Nha hang</span>
                <select value={foodForm.restaurantId} onChange={(event) => setFoodForm((current) => ({ ...current, restaurantId: event.target.value, categoryId: '' }))}>
                  <option value="">Chon nha hang</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      #{restaurant.id} - {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="restaurant-field">
                <span>Danh muc</span>
                <select value={foodForm.categoryId} onChange={(event) => setFoodForm((current) => ({ ...current, categoryId: event.target.value }))}>
                  <option value="">{foodForm.restaurantId ? 'Chon danh muc' : 'Chon nha hang de hien danh muc'}</option>
                  {categoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      #{category.id} - {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="menu-form-note">
                {foodForm.restaurantId === '' ? (
                  <p>Chon nha hang truoc khi tao mon an.</p>
                ) : categoryOptions.length === 0 ? (
                  <p>Danh muc chua co cho nha hang da chon.</p>
                ) : null}
              </div>
              <div className="checkout-grid">
                <label className="restaurant-field">
                  <span>SL mac dinh</span>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.defaultQuantity}
                    onChange={(event) => setFoodForm((current) => ({ ...current, defaultQuantity: event.target.value }))}
                  />
                </label>
                <label className="restaurant-field">
                  <span>SL hien tai</span>
                  <input
                    type="number"
                    min="0"
                    value={foodForm.currentQuantity}
                    onChange={(event) => setFoodForm((current) => ({ ...current, currentQuantity: event.target.value }))}
                  />
                </label>
              </div>
              <label className="restaurant-checkbox">
                <input
                  type="checkbox"
                  checked={foodForm.isAvailable}
                  onChange={(event) => setFoodForm((current) => ({ ...current, isAvailable: event.target.checked }))}
                />
                <span>Dang ban</span>
              </label>
              <div className="restaurant-form-actions">
                <button type="submit" className="button-primary" disabled={isSavingFood || !canSubmitFood}>
                  {isSavingFood ? 'Saving...' : foodForm.id ? 'Save food' : 'Create food'}
                </button>
                <button type="button" className="button-secondary" onClick={resetFoodForm}>
                  Clear
                </button>
              </div>
            </form>
          </section>

          <section className="admin-form-panel">
            <div className="driver-control-head">
              <span>{categoryForm.id ? `Edit danh muc #${categoryForm.id}` : 'Create category'}</span>
              <h2>Danh muc</h2>
              <p>Tao danh muc cho tung nha hang.</p>
            </div>
            <form className="admin-form" onSubmit={(event) => void handleCategorySubmit(event)}>
              <label className="restaurant-field">
                <span>Nha hang</span>
                <select value={categoryForm.restaurantId} onChange={(event) => setCategoryForm((current) => ({ ...current, restaurantId: event.target.value }))}>
                  <option value="">Chon nha hang</option>
                  {restaurants.map((restaurant) => (
                    <option key={restaurant.id} value={restaurant.id}>
                      #{restaurant.id} - {restaurant.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="restaurant-field">
                <span>Ten danh muc</span>
                <input value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))} />
              </label>
              <div className="restaurant-form-actions">
                <button type="submit" className="button-primary" disabled={isSavingCategory}>
                  {isSavingCategory ? 'Saving...' : categoryForm.id ? 'Save category' : 'Create category'}
                </button>
                <button type="button" className="button-secondary" onClick={resetCategoryForm}>
                  Clear
                </button>
              </div>
            </form>

            <div className="category-mini-list">
              {visibleCategories.map((category) => (
                <div key={category.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setCategoryForm({
                        id: category.id,
                        restaurantId: String(category.restaurantId),
                        name: category.name,
                      })
                    }
                  >
                    #{category.id} {category.name}
                  </button>
                  <button type="button" className="button-danger" onClick={() => void handleDeleteCategory(category)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </section>
        </aside>
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
            onClick={() => selectResource(resource.name)}
          >
            {resource.title}
          </button>
        ))}
      </div>

      {config.name === 'menu-manager' ? (
        <MenuManagerPanel />
      ) : config.name === 'restaurant-manager' ? (
        <AdminRestaurantPanel />
      ) : config.name === 'category-manager' ? (
        <AdminCategoryPanel />
      ) : (
        <AdminResourcePanel key={config.name} config={config} />
      )}
    </section>
  )
}
