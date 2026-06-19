import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import {
  approveRestaurant,
  createRestaurant,
  deleteRestaurant,
  getAllRestaurantsForAdmin,
  rejectRestaurant,
  updateRestaurant,
} from '../../services/api/restaurants'
import ImageUrlField from '../common/ImageUrlField'
import { getMerchants } from '../../services/api/users'
import { getRestaurantImageUrl } from '../../utils/restaurantImage'
import type { AuthUser, Restaurant, RestaurantCreateInput } from '../../types'

type RestaurantFormState = {
  ownerId: string
  name: string
  address: string
  latitude: string
  longitude: string
  openingTime: string
  closingTime: string
  isOpen: boolean
  imageUrl: string
  ratingAvg: string
}

type FormErrors = Partial<Record<keyof RestaurantFormState, string>>

const emptyForm: RestaurantFormState = {
  ownerId: '',
  name: '',
  address: '',
  latitude: '10.7769',
  longitude: '106.7009',
  openingTime: '07:00',
  closingTime: '22:00',
  isOpen: true,
  imageUrl: '',
  ratingAvg: '5',
}

function restaurantToForm(restaurant: Restaurant): RestaurantFormState {
  return {
    ownerId: String(restaurant.ownerId),
    name: restaurant.name,
    address: restaurant.address,
    latitude: String(restaurant.latitude),
    longitude: String(restaurant.longitude),
    openingTime: restaurant.openingTime.slice(0, 5),
    closingTime: restaurant.closingTime.slice(0, 5),
    isOpen: restaurant.isOpen,
    imageUrl: restaurant.imageUrl ?? '',
    ratingAvg: String(restaurant.ratingAvg),
  }
}

function formatApproval(status: Restaurant['approvalStatus']) {
  if (status === 'APPROVED') return 'Da duyệt'
  if (status === 'REJECTED') return 'Từ chối'
  return 'Cho duyệt'
}

export default function AdminRestaurantPanel() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [merchants, setMerchants] = useState<AuthUser[]>([])
  const [formData, setFormData] = useState<RestaurantFormState>(emptyForm)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setErrorMessage(null)

    const [restaurantResult, merchantResult] = await Promise.allSettled([
      getAllRestaurantsForAdmin(),
      getMerchants(),
    ])

    if (restaurantResult.status === 'fulfilled') {
      setRestaurants(restaurantResult.value)
    } else {
      setRestaurants([])
      setErrorMessage(
        restaurantResult.reason instanceof Error
          ? restaurantResult.reason.message
          : 'Không thể tải danh sách quán',
      )
    }

    if (merchantResult.status === 'fulfilled') {
      setMerchants(merchantResult.value)
    } else {
      setMerchants([])
      const merchantError =
        merchantResult.reason instanceof Error ? merchantResult.reason.message : 'Không thể tải chủ quán'
      setErrorMessage((current) =>
        current ? `${current}. ${merchantError}` : `${merchantError}. Đăng nhập lai voi role ADMIN (0900000005).`,
      )
    }

    setIsLoading(false)
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    if (searchParams.get('action') === 'create') {
      resetForm()
    }
  }, [searchParams])

  function resetForm() {
    setEditingId(null)
    setFormData(emptyForm)
    setErrors({})
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
  }

  function startCreate() {
    setEditingId(null)
    setFormData(emptyForm)
    setErrors({})
    setFeedback(null)
    const next = new URLSearchParams(searchParams)
    next.set('action', 'create')
    setSearchParams(next, { replace: true })
  }

  function startEdit(restaurant: Restaurant) {
    setEditingId(restaurant.id)
    setFormData(restaurantToForm(restaurant))
    setErrors({})
    setFeedback(null)
    const next = new URLSearchParams(searchParams)
    next.delete('action')
    setSearchParams(next, { replace: true })
  }

  function handleFieldChange<K extends keyof RestaurantFormState>(field: K, value: RestaurantFormState[K]) {
    setFormData((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
  }

  function validateForm(): RestaurantCreateInput | null {
    const nextErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedAddress = formData.address.trim()
    const ownerId = Number(formData.ownerId)
    const latitude = Number(formData.latitude)
    const longitude = Number(formData.longitude)
    const ratingAvg = Number(formData.ratingAvg)

    if (!trimmedName) nextErrors.name = 'Tên quan la bat buoc'
    if (!trimmedAddress) nextErrors.address = 'Dia chi la bat buoc'
    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      nextErrors.ownerId = 'Phải chọn chủ quán (MERCHANT)'
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      nextErrors.latitude = 'Vi do khong hop le'
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      nextErrors.longitude = 'Kinh do khong hop le'
    }

    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(formData.openingTime)) nextErrors.openingTime = 'Dinh dang HH:mm'
    if (!timeRegex.test(formData.closingTime)) nextErrors.closingTime = 'Dinh dang HH:mm'
    if (
      timeRegex.test(formData.openingTime) &&
      timeRegex.test(formData.closingTime) &&
      formData.openingTime >= formData.closingTime
    ) {
      nextErrors.closingTime = 'Gio dong phai sau gio mo'
    }
    if (!Number.isFinite(ratingAvg) || ratingAvg < 0 || ratingAvg > 5) {
      nextErrors.ratingAvg = 'Danh gia tu 0 den 5'
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return null

    return {
      ownerId,
      name: trimmedName,
      address: trimmedAddress,
      latitude,
      longitude,
      openingTime: `${formData.openingTime}:00`,
      closingTime: `${formData.closingTime}:00`,
      isOpen: formData.isOpen,
      imageUrl: formData.imageUrl.trim() || null,
      ratingAvg,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = validateForm()
    if (!payload) return

    try {
      setIsSaving(true)
      setFeedback(null)
      setErrorMessage(null)

      if (editingId !== null) {
        await updateRestaurant(editingId, payload)
        setFeedback(
          payload.imageUrl
            ? `Da cap nhat quan #${editingId} (bao gom hinh anh)`
            : `Da cap nhat quan #${editingId}`,
        )
      } else {
        await createRestaurant(payload)
        setFeedback('Da tao quan moi (tu dong duyệt)')
        resetForm()
      }

      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu quán')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete(restaurant: Restaurant) {
    const confirmed = window.confirm(`Xóa quan "${restaurant.name}"?`)
    if (!confirmed) return

    try {
      setActioningId(restaurant.id)
      await deleteRestaurant(restaurant.id)
      setFeedback(`Da xoa quan #${restaurant.id}`)
      if (editingId === restaurant.id) resetForm()
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xóa quán')
    } finally {
      setActioningId(null)
    }
  }

  async function handleApprove(restaurantId: number) {
    try {
      setActioningId(restaurantId)
      await approveRestaurant(restaurantId, user?.id)
      setFeedback(`Da duyệt quan #${restaurantId}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể duyệt quán')
    } finally {
      setActioningId(null)
    }
  }

  async function handleReject(restaurantId: number) {
    try {
      setActioningId(restaurantId)
      await rejectRestaurant(restaurantId, rejectReason)
      setFeedback(`Da từ chối quan #${restaurantId}`)
      setRejectTargetId(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể từ chối quán')
    } finally {
      setActioningId(null)
    }
  }

  const isCreateMode = editingId === null

  return (
    <div className="admin-workspace">
      <section className="admin-panel">
        <div className="admin-panel-head">
          <div>
            <h2>Nhà hàng</h2>
            <p>Tao quan cho chủ quán, duyệt quan cho, sua hoac xoa. Mot form duy nhat ben phai.</p>
          </div>
          <div className="admin-actions">
            <button type="button" className="button-primary" onClick={startCreate}>
              + Tao quan moi
            </button>
            <button type="button" className="button-secondary" onClick={() => void loadData()} disabled={isLoading}>
              Reload
            </button>
          </div>
        </div>

        {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}
        {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Anh</th>
                <th>Ten</th>
                <th>Chủ quán</th>
                <th>Trạng thái</th>
                <th>Dia chi</th>
                <th>Mo cua</th>
                <th>Danh gia</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td>{restaurant.id}</td>
                  <td>
                    {getRestaurantImageUrl(restaurant.imageUrl) ? (
                      <img
                        className="admin-table-thumb"
                        src={getRestaurantImageUrl(restaurant.imageUrl) || ''}
                        alt={restaurant.name}
                      />
                    ) : (
                      <span className="admin-table-thumb admin-table-thumb--empty">-</span>
                    )}
                  </td>
                  <td>{restaurant.name}</td>
                  <td>#{restaurant.ownerId}</td>
                  <td>
                    <span className={`approval-tag approval-${(restaurant.approvalStatus || 'pending').toLowerCase()}`}>
                      {formatApproval(restaurant.approvalStatus)}
                    </span>
                  </td>
                  <td>{restaurant.address || '-'}</td>
                  <td>{restaurant.isOpen ? 'Yes' : 'No'}</td>
                  <td>{restaurant.ratingAvg.toFixed(2)}</td>
                  <td>
                    <div className="admin-actions">
                      <Link to={`/restaurants/${restaurant.id}`} className="button-secondary">
                        Xem
                      </Link>
                      <button type="button" className="button-secondary" onClick={() => startEdit(restaurant)}>
                        Sua
                      </button>
                      {restaurant.approvalStatus === 'PENDING' ? (
                        <>
                          <button
                            type="button"
                            className="button-primary"
                            onClick={() => void handleApprove(restaurant.id)}
                            disabled={actioningId === restaurant.id}
                          >
                            Duyệt
                          </button>
                          <button
                            type="button"
                            className="button-danger"
                            onClick={() => setRejectTargetId(restaurant.id)}
                            disabled={actioningId === restaurant.id}
                          >
                            Từ chối
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => void handleDelete(restaurant)}
                        disabled={actioningId === restaurant.id}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {isLoading ? <p className="empty-state">Đang tải du lieu...</p> : null}
          {!isLoading && restaurants.length === 0 ? <p className="empty-state">Chưa có quán nào.</p> : null}
        </div>

        {rejectTargetId !== null ? (
          <div className="restaurant-form-card" style={{ marginTop: '1rem' }}>
            <h3>Từ chối quan #{rejectTargetId}</h3>
            <label className="restaurant-field">
              <span>Lý do</span>
              <input value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
            </label>
            <div className="restaurant-form-actions">
              <button type="button" className="button-danger" onClick={() => void handleReject(rejectTargetId)}>
                Xác nhận từ chối
              </button>
              <button type="button" className="button-secondary" onClick={() => setRejectTargetId(null)}>
                Huy
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <aside className="admin-form-panel">
        <div className="driver-control-head">
          <span>{editingId ? `Sua quan #${editingId}` : 'Tao quan moi'}</span>
          <h2>{isCreateMode ? 'Tao quan cho chủ quán' : 'Cap nhat quan'}</h2>
          <p>
            {isCreateMode
              ? 'Chon chủ quán MERCHANT. Quan admin tao se tu dong duyệt (APPROVED).'
              : 'Cap nhat thông tin quan, bao gom link hinh anh ben duoi.'}
          </p>
        </div>

        <form className="admin-form" onSubmit={handleSubmit}>
          <label className="restaurant-field">
            <span>Chủ quán (MERCHANT)</span>
            <select
              value={formData.ownerId}
              onChange={(event) => handleFieldChange('ownerId', event.target.value)}
              disabled={editingId !== null}
            >
              <option value="">-- Chon chủ quán --</option>
              {merchants.map((merchant) => (
                <option key={merchant.id} value={merchant.id}>
                  #{merchant.id} - {merchant.fullName} ({merchant.phone})
                </option>
              ))}
            </select>
            {merchants.length === 0 ? (
              <p className="field-hint">
                Chưa có chủ quán. Tạo tại tab <strong>Người dùng</strong> (vai tro MERCHANT) hoặc đăng nhập lại
                ADMIN: <strong>0900000005</strong> / 123456.
              </p>
            ) : null}
            {errors.ownerId ? <p className="field-error">{errors.ownerId}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Tên quan</span>
            <input value={formData.name} onChange={(event) => handleFieldChange('name', event.target.value)} />
            {errors.name ? <p className="field-error">{errors.name}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Dia chi</span>
            <input value={formData.address} onChange={(event) => handleFieldChange('address', event.target.value)} />
            {errors.address ? <p className="field-error">{errors.address}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Latitude</span>
            <input
              type="number"
              step="0.000001"
              value={formData.latitude}
              onChange={(event) => handleFieldChange('latitude', event.target.value)}
            />
            {errors.latitude ? <p className="field-error">{errors.latitude}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Longitude</span>
            <input
              type="number"
              step="0.000001"
              value={formData.longitude}
              onChange={(event) => handleFieldChange('longitude', event.target.value)}
            />
            {errors.longitude ? <p className="field-error">{errors.longitude}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Gio mo cua</span>
            <input
              type="time"
              value={formData.openingTime}
              onChange={(event) => handleFieldChange('openingTime', event.target.value)}
            />
            {errors.openingTime ? <p className="field-error">{errors.openingTime}</p> : null}
          </label>

          <label className="restaurant-field">
            <span>Gio dong cua</span>
            <input
              type="time"
              value={formData.closingTime}
              onChange={(event) => handleFieldChange('closingTime', event.target.value)}
            />
            {errors.closingTime ? <p className="field-error">{errors.closingTime}</p> : null}
          </label>

          <ImageUrlField
            id="restaurantImageUrl"
            label={editingId ? 'Sua link hinh anh quan' : 'Link hinh anh quan'}
            value={formData.imageUrl}
            hint={
              editingId
                ? 'Dan URL anh moi va bam Lưu thay doi. Anh hien ngay tren trang dat mon.'
                : 'Dan link anh cong khai (URL). Chi hien anh ban gan.'
            }
            onChange={(value) => handleFieldChange('imageUrl', value)}
          />

          <label className="restaurant-field">
            <span>Danh gia (0-5)</span>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={formData.ratingAvg}
              onChange={(event) => handleFieldChange('ratingAvg', event.target.value)}
            />
            {errors.ratingAvg ? <p className="field-error">{errors.ratingAvg}</p> : null}
          </label>

          <label className="restaurant-checkbox">
            <input
              type="checkbox"
              checked={formData.isOpen}
              onChange={(event) => handleFieldChange('isOpen', event.target.checked)}
            />
            <span>Dang mo cua</span>
          </label>

          <div className="restaurant-form-actions">
            <button type="submit" className="button-primary" disabled={isSaving}>
              {isSaving ? 'Dang luu...' : editingId ? 'Lưu thay doi' : 'Tao quan'}
            </button>
            <button type="button" className="button-secondary" onClick={resetForm}>
              {editingId ? 'Huy sua' : 'Xóa form'}
            </button>
          </div>
        </form>
      </aside>
    </div>
  )
}
