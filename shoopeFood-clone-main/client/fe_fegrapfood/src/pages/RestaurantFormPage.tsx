import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createRestaurant, getRestaurantById, updateRestaurant } from '../services/api/restaurants'
import { getMerchants } from '../services/api/users'
import type { AuthUser, RestaurantCreateInput } from '../types'

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

const VIETNAM_CENTER_LAT = '10.7769'
const VIETNAM_CENTER_LNG = '106.7009'
const DEFAULT_OPENING_TIME = '07:00'
const DEFAULT_CLOSING_TIME = '22:00'

const initialFormState: RestaurantFormState = {
  ownerId: '',
  name: '',
  address: '',
  latitude: VIETNAM_CENTER_LAT,
  longitude: VIETNAM_CENTER_LNG,
  openingTime: DEFAULT_OPENING_TIME,
  closingTime: DEFAULT_CLOSING_TIME,
  isOpen: true,
  imageUrl: '',
  ratingAvg: '5',
}

export default function RestaurantFormPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { id } = useParams<{ id: string }>()
  const restaurantId = id ? Number(id) : null
  const isEditMode = restaurantId !== null && Number.isFinite(restaurantId)
  const isAdmin = user?.role === 'ADMIN'

  useDocumentTitle(`${APP_NAME} | ${isEditMode ? 'Sửa nhà hàng' : 'Tạo nhà hàng'}`)

  const [merchants, setMerchants] = useState<AuthUser[]>([])
  const [formData, setFormData] = useState<RestaurantFormState>(initialFormState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) {
      return
    }

    let ignore = false

    void (async () => {
      try {
        const items = await getMerchants()
        if (!ignore) {
          setMerchants(items)
        }
      } catch {
        if (!ignore) {
          setMerchants([])
        }
      }
    })()

    return () => {
      ignore = true
    }
  }, [isAdmin])

  useEffect(() => {
    if (!isEditMode || restaurantId === null) {
      return
    }

    const nextRestaurantId = restaurantId
    let ignore = false

    async function loadRestaurant() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const restaurant = await getRestaurantById(nextRestaurantId)

        if (!ignore) {
          setFormData({
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
          })
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải thông tin nhà hàng')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurant()

    return () => {
      ignore = true
    }
  }, [isEditMode, restaurantId])

  function handleFieldChange<K extends keyof RestaurantFormState>(field: K, value: RestaurantFormState[K]) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }))
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  function validateForm(): RestaurantCreateInput | null {
    const nextErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedAddress = formData.address.trim()
    const ownerId = Number(formData.ownerId)
    const latitude = Number(formData.latitude)
    const longitude = Number(formData.longitude)
    const ratingAvg = Number(formData.ratingAvg)

    // Validate name
    if (!trimmedName) {
      nextErrors.name = 'Tên nhà hàng là bắt buộc'
    }

    // Validate address
    if (!trimmedAddress) {
      nextErrors.address = 'Địa chỉ là bắt buộc'
    }

    if (!Number.isFinite(ownerId) || ownerId <= 0) {
      nextErrors.ownerId = isAdmin ? 'Phải chọn chủ quán (MERCHANT)' : 'ID chủ quán phai la so duong'
    }

    // Validate coordinates
    if (!Number.isFinite(latitude)) {
      nextErrors.latitude = 'Vĩ độ phải là số'
    } else if (latitude < -90 || latitude > 90) {
      nextErrors.latitude = 'Vĩ độ phải từ -90 đến 90'
    }

    if (!Number.isFinite(longitude)) {
      nextErrors.longitude = 'Kinh độ phải là số'
    } else if (longitude < -180 || longitude > 180) {
      nextErrors.longitude = 'Kinh độ phải từ -180 đến 180'
    }

    // Validate times
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (!timeRegex.test(formData.openingTime)) {
      nextErrors.openingTime = 'Định dạng giờ mở: HH:mm'
    }
    if (!timeRegex.test(formData.closingTime)) {
      nextErrors.closingTime = 'Định dạng giờ đóng: HH:mm'
    }

    if (timeRegex.test(formData.openingTime) && timeRegex.test(formData.closingTime)) {
      if (formData.openingTime >= formData.closingTime) {
        nextErrors.closingTime = 'Giờ đóng phải sau giờ mở'
      }
    }

    // Validate ratingAvg
    if (!Number.isFinite(ratingAvg)) {
      nextErrors.ratingAvg = 'Đánh giá phải là số'
    } else if (ratingAvg < 0 || ratingAvg > 5) {
      nextErrors.ratingAvg = 'Đánh giá phải từ 0 đến 5'
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return null
    }

    return {
      ownerId,
      name: trimmedName,
      address: trimmedAddress,
      latitude,
      longitude,
      openingTime: formData.openingTime + ':00',
      closingTime: formData.closingTime + ':00',
      isOpen: formData.isOpen,
      imageUrl: formData.imageUrl.trim() || null,
      ratingAvg,
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = validateForm()
    if (!payload) {
      return
    }

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessMessage(null)

      if (isEditMode && restaurantId !== null) {
        await updateRestaurant(restaurantId, payload)
        setSuccessMessage('Đã cập nhật nhà hàng')
      } else {
        await createRestaurant(payload)
        setSuccessMessage('Đã tạo nhà hàng mới')
      }

      setTimeout(() => {
        navigate('/restaurants')
      }, 1000)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể lưu nhà hàng')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-form-card">
        <h1>{isEditMode ? 'Sửa nhà hàng' : 'Tạo quán cho chủ quán'}</h1>
        <p>
          {isAdmin
            ? 'Admin tao quan va gan cho chủ quán (MERCHANT). Quan se duoc tu dong duyệt (APPROVED).'
            : 'Nhập đầy đủ thông tin nhà hàng va gui len backend.'}
        </p>
      </div>

      <div className="restaurant-form-card">
        {isLoading ? <p className="restaurant-status-text">Đang tải dữ liệu nhà hàng...</p> : null}
        {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
        {successMessage ? <p className="restaurant-feedback success">{successMessage}</p> : null}

        {!isLoading ? (
          <form className="restaurant-form" onSubmit={handleSubmit}>
            <div className="restaurant-form-grid">
              {/* Owner */}
              <div className="restaurant-field">
                <label htmlFor="ownerId">Chủ quán (MERCHANT)</label>
                {isAdmin ? (
                  <select
                    id="ownerId"
                    name="ownerId"
                    value={formData.ownerId}
                    onChange={(event) => handleFieldChange('ownerId', event.target.value)}
                    disabled={isEditMode}
                  >
                    <option value="">-- Chon chủ quán --</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        #{merchant.id} - {merchant.fullName} ({merchant.phone})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="ownerId"
                    name="ownerId"
                    type="number"
                    value={formData.ownerId}
                    onChange={(event) => handleFieldChange('ownerId', event.target.value)}
                    disabled={isEditMode}
                    min="1"
                  />
                )}
                {isAdmin && merchants.length === 0 ? (
                  <p className="field-hint">Chưa có chủ quán. Tạo tại Admin &gt; Người dùng (vai tro MERCHANT).</p>
                ) : null}
                {errors.ownerId ? <p className="field-error">{errors.ownerId}</p> : null}
              </div>

              {/* Rating */}
              <div className="restaurant-field">
                <label htmlFor="ratingAvg">Đánh giá (0-5)</label>
                <input
                  id="ratingAvg"
                  name="ratingAvg"
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={formData.ratingAvg}
                  onChange={(event) => handleFieldChange('ratingAvg', event.target.value)}
                />
                {errors.ratingAvg ? <p className="field-error">{errors.ratingAvg}</p> : null}
              </div>

              {/* Name */}
              <div className="restaurant-field full">
                <label htmlFor="name">Tên nhà hàng</label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  placeholder="vd: Cơm Tấm Hàng Mười"
                />
                {errors.name ? <p className="field-error">{errors.name}</p> : null}
              </div>

              {/* Address */}
              <div className="restaurant-field full">
                <label htmlFor="address">Địa chỉ</label>
                <input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                  placeholder="vd: 123 Đường Nguyễn Huệ, TP HCM"
                />
                {errors.address ? <p className="field-error">{errors.address}</p> : null}
              </div>

              {/* Latitude */}
              <div className="restaurant-field">
                <label htmlFor="latitude">Vĩ độ (Latitude)</label>
                <input
                  id="latitude"
                  name="latitude"
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  value={formData.latitude}
                  onChange={(event) => handleFieldChange('latitude', event.target.value)}
                />
                {errors.latitude ? <p className="field-error">{errors.latitude}</p> : null}
              </div>

              {/* Longitude */}
              <div className="restaurant-field">
                <label htmlFor="longitude">Kinh độ (Longitude)</label>
                <input
                  id="longitude"
                  name="longitude"
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  value={formData.longitude}
                  onChange={(event) => handleFieldChange('longitude', event.target.value)}
                />
                {errors.longitude ? <p className="field-error">{errors.longitude}</p> : null}
              </div>

              {/* Opening Time */}
              <div className="restaurant-field">
                <label htmlFor="openingTime">Giờ mở cửa</label>
                <input
                  id="openingTime"
                  name="openingTime"
                  type="time"
                  value={formData.openingTime}
                  onChange={(event) => handleFieldChange('openingTime', event.target.value)}
                />
                {errors.openingTime ? <p className="field-error">{errors.openingTime}</p> : null}
              </div>

              {/* Closing Time */}
              <div className="restaurant-field">
                <label htmlFor="closingTime">Giờ đóng cửa</label>
                <input
                  id="closingTime"
                  name="closingTime"
                  type="time"
                  value={formData.closingTime}
                  onChange={(event) => handleFieldChange('closingTime', event.target.value)}
                />
                {errors.closingTime ? <p className="field-error">{errors.closingTime}</p> : null}
              </div>

              {/* Image URL */}
              <div className="restaurant-field full">
                <label htmlFor="imageUrl">URL ảnh</label>
                <input
                  id="imageUrl"
                  name="imageUrl"
                  type="url"
                  value={formData.imageUrl}
                  onChange={(event) => handleFieldChange('imageUrl', event.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                {formData.imageUrl && (
                  <img
                    src={formData.imageUrl}
                    alt="preview"
                    style={{ marginTop: '0.5rem', maxWidth: '200px', maxHeight: '200px' }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
              </div>

              {/* Status */}
              <div className="restaurant-field full">
                <label className="restaurant-checkbox">
                  <input
                    name="isOpen"
                    type="checkbox"
                    checked={formData.isOpen}
                    onChange={(event) => handleFieldChange('isOpen', event.target.checked)}
                  />
                  <span>{formData.isOpen ? '✓ Đang mở cửa' : '✗ Tạm đóng cửa'}</span>
                </label>
              </div>
            </div>

            <div className="restaurant-form-actions">
              <Link to="/restaurants" className="button-secondary">
                ← Quay lại danh sách
              </Link>

              <button type="submit" className="button-primary" disabled={isSubmitting}>
                {isSubmitting
                  ? 'Đang lưu...'
                  : isEditMode
                    ? 'Cập nhật nhà hàng'
                    : 'Tạo nhà hàng'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
    </section>
  )
}
