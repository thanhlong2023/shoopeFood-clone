import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createCategory, deleteCategory, getCategories, updateCategory } from '../../services/api/categories'
import { getAllRestaurantsForAdmin } from '../../services/api/restaurants'
import type { Category, Restaurant } from '../../types'

type CategoryFormState = {
  id: number | null
  restaurantId: string
  name: string
}

const emptyForm: CategoryFormState = {
  id: null,
  restaurantId: '',
  name: '',
}

type CategoryFormErrors = Partial<Record<'restaurantId' | 'name', string>>

export default function AdminCategoryPanel() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [form, setForm] = useState<CategoryFormState>(emptyForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [formErrors, setFormErrors] = useState<CategoryFormErrors>({})

  const restaurantById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  )

  const visibleCategories = useMemo(() => {
    if (!restaurantFilter) {
      return categories
    }
    return categories.filter((category) => category.restaurantId === Number(restaurantFilter))
  }, [categories, restaurantFilter])

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [restaurantData, categoryData] = await Promise.all([getAllRestaurantsForAdmin(), getCategories()])
      setRestaurants(restaurantData)
      setCategories(categoryData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải danh mục')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setForm((current) => ({
      ...current,
      restaurantId: restaurantFilter || current.restaurantId,
    }))
  }, [restaurantFilter])

  function resetForm() {
    setForm({
      ...emptyForm,
      restaurantId: restaurantFilter,
    })
    setFormErrors({})
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = form.name.trim()
    const restaurantId = Number(form.restaurantId)
    const nextErrors: CategoryFormErrors = {}

    if (!form.restaurantId || !Number.isFinite(restaurantId)) {
      nextErrors.restaurantId = 'Phải chọn nhà hàng'
    }

    if (!name) {
      nextErrors.name = 'Tên danh mục la bat buoc'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors)
      return
    }

    setFormErrors({})

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setFeedback(null)

      if (form.id) {
        await updateCategory(form.id, { name, restaurantId })
        setFeedback(`Da cap nhat danh mục #${form.id}`)
      } else {
        await createCategory({ name, restaurantId })
        setFeedback(`Da tao danh mục "${name}" cho quan #${restaurantId}`)
      }

      resetForm()
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu danh mục')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(category: Category) {
    const confirmed = window.confirm(`Xóa danh mục "${category.name}"?`)
    if (!confirmed) return

    try {
      setErrorMessage(null)
      await deleteCategory(category.id)
      setFeedback(`Da xoa danh mục #${category.id}`)
      if (form.id === category.id) resetForm()
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xóa danh mục')
    }
  }

  return (
    <div className="admin-workspace">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Danh mục mon an</h2>
            <p>Tao danh mục theo dung nhà hàng. Chủ quán se thay ngay tai trang quan ly mon.</p>
          </div>
          <button type="button" className="button-secondary" onClick={() => void loadData()} disabled={isLoading}>
            Reload
          </button>
        </div>

        <div className="menu-filter-bar">
          <label className="restaurant-field">
            <span>Loc theo nhà hàng</span>
            <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
              <option value="">Tất cả nhà hàng</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  #{restaurant.id} - {restaurant.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}
        {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Ten</th>
                <th>Nhà hàng</th>
                <th>Restaurant ID</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCategories.map((category) => {
                const restaurant = restaurantById.get(category.restaurantId)
                return (
                  <tr key={category.id}>
                    <td>{category.id}</td>
                    <td>{category.name}</td>
                    <td>{restaurant ? restaurant.name : '-'}</td>
                    <td>#{category.restaurantId}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setForm({
                              id: category.id,
                              restaurantId: String(category.restaurantId),
                              name: category.name,
                            })
                          }
                        >
                          Sua
                        </button>
                        <button type="button" className="button-danger" onClick={() => void handleDelete(category)}>
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {isLoading ? <p className="empty-state">Đang tải...</p> : null}
          {!isLoading && visibleCategories.length === 0 ? (
            <p className="empty-state">Chưa có danh mục phu hop.</p>
          ) : null}
        </div>
      </section>

      <aside className="admin-form-panel">
        <div className="driver-control-head">
          <span>{form.id ? `Sua #${form.id}` : 'Tao danh mục'}</span>
          <h2>{form.id ? 'Cap nhat danh mục' : 'Them danh mục moi'}</h2>
          <p>Chon dung nhà hàng trước khi tao. Nếu chọn sai ID, chủ quán se khong thay.</p>
        </div>

        <form className="admin-form" noValidate onSubmit={handleSubmit}>
          <label className="restaurant-field">
            <span>Nhà hàng</span>
            <select
              value={form.restaurantId}
              onChange={(event) => {
                setForm((current) => ({ ...current, restaurantId: event.target.value }))
                setFormErrors((current) => ({ ...current, restaurantId: undefined }))
              }}
            >
              <option value="">-- Chon nhà hàng --</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  #{restaurant.id} - {restaurant.name}
                </option>
              ))}
            </select>
            {formErrors.restaurantId ? <p className="field-error">{formErrors.restaurantId}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Tên danh mục</span>
            <input
              value={form.name}
              onChange={(event) => {
                setForm((current) => ({ ...current, name: event.target.value }))
                setFormErrors((current) => ({ ...current, name: undefined }))
              }}
              placeholder="vd: Mon chinh, Đồ uống"
            />
            {formErrors.name ? <p className="field-error">{formErrors.name}</p> : null}
          </label>

          <div className="restaurant-form-actions">
            <button type="submit" className="button-primary" disabled={isSaving}>
              {isSaving ? 'Dang luu...' : form.id ? 'Lưu thay doi' : 'Tao danh mục'}
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
