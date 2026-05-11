import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createRestaurant, getRestaurantById, updateRestaurant } from '../services/api/restaurants'
import type { RestaurantCreateInput } from '../types'

type FormState = {
  ownerId: string
  name: string
  address: string
  latitude: string
  longitude: string
  openingTime: string
  closingTime: string
  imageUrl: string
  ratingAvg: string
  isOpen: boolean
}

type FormErrors = Partial<Record<'name' | 'ownerId' | 'latitude' | 'longitude' | 'openingTime' | 'closingTime' | 'ratingAvg', string>>

const emptyForm: FormState = {
  ownerId: '1',
  name: '',
  address: '',
  latitude: '10.7769',
  longitude: '106.7009',
  openingTime: '07:00',
  closingTime: '22:00',
  imageUrl: '',
  ratingAvg: '5',
  isOpen: true,
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value
}

function trimSeconds(value: string) {
  return value?.slice(0, 5) || ''
}

function validateForm(form: FormState) {
  const nextErrors: FormErrors = {}
  const ownerId = Number(form.ownerId)
  const latitude = Number(form.latitude)
  const longitude = Number(form.longitude)
  const ratingAvg = Number(form.ratingAvg)

  if (!Number.isFinite(ownerId) || ownerId <= 0) {
    nextErrors.ownerId = 'Owner ID phai la so duong'
  }

  if (!form.name.trim()) {
    nextErrors.name = 'Ten nha hang la bat buoc'
  }

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    nextErrors.latitude = 'Latitude phai nam trong khoang -90 den 90'
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    nextErrors.longitude = 'Longitude phai nam trong khoang -180 den 180'
  }

  if (!form.openingTime) {
    nextErrors.openingTime = 'Gio mo cua la bat buoc'
  }

  if (!form.closingTime || form.openingTime >= form.closingTime) {
    nextErrors.closingTime = 'Gio dong cua phai sau gio mo cua'
  }

  if (!Number.isFinite(ratingAvg) || ratingAvg < 0 || ratingAvg > 5) {
    nextErrors.ratingAvg = 'Rating phai trong khoang 0 den 5'
  }

  return nextErrors
}

function buildPayload(form: FormState): RestaurantCreateInput {
  return {
    ownerId: Number(form.ownerId),
    name: form.name.trim(),
    address: form.address.trim(),
    latitude: Number(form.latitude),
    longitude: Number(form.longitude),
    openingTime: normalizeTime(form.openingTime),
    closingTime: normalizeTime(form.closingTime),
    imageUrl: form.imageUrl.trim() || null,
    ratingAvg: Number(form.ratingAvg),
    isOpen: form.isOpen,
  }
}

export default function RestaurantFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { hasRole, user } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const isMerchant = hasRole(['MERCHANT'])
  const restaurantId = id ? Number(id) : null
  const isEditMode = useMemo(() => restaurantId !== null && Number.isFinite(restaurantId), [restaurantId])

  useDocumentTitle(`${APP_NAME} | ${isEditMode ? 'Edit restaurant' : 'Create restaurant'}`)

  const [form, setForm] = useState<FormState>(emptyForm)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [submitMessage, setSubmitMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditMode || restaurantId === null) {
      setForm({
        ...emptyForm,
        ownerId: user ? String(user.id) : emptyForm.ownerId,
      })
      setIsLoading(false)
      return
    }

    const currentRestaurantId = restaurantId
    let ignore = false

    async function loadRestaurant() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const data = await getRestaurantById(currentRestaurantId)
        if (!ignore) {
          if (isMerchant && !isAdmin && user?.id !== data.ownerId) {
            setErrorMessage('Ban chi duoc sua nha hang thuoc tai khoan dang dang nhap')
            setIsLoading(false)
            return
          }

          setForm({
            ownerId: String(data.ownerId),
            name: data.name,
            address: data.address || '',
            latitude: String(data.latitude),
            longitude: String(data.longitude),
            openingTime: trimSeconds(data.openingTime),
            closingTime: trimSeconds(data.closingTime),
            imageUrl: data.imageUrl || '',
            ratingAvg: String(data.ratingAvg),
            isOpen: data.isOpen,
          })
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai du lieu nha hang')
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
  }, [isAdmin, isEditMode, isMerchant, restaurantId, user])

  function handleInputChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === 'isOpen' ? event.target.checked : event.target.value
      setForm((current) => ({ ...current, [field]: value }))
      setErrors((current) => ({ ...current, [field]: undefined }))
      setSubmitMessage(null)
      setErrorMessage(null)
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    setSubmitMessage(null)
    setErrorMessage(null)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    try {
      setIsLoading(true)
      const payload = {
        ...buildPayload(form),
        ownerId: isAdmin ? Number(form.ownerId) : user?.id || Number(form.ownerId),
      }

      if (isEditMode && restaurantId !== null) {
        const result = await updateRestaurant(restaurantId, payload)
        setSubmitMessage(
          result.changeRequest
            ? 'Da luu phan duoc phep sua va gui thay doi nhay cam cho admin duyet'
            : 'Cap nhat nha hang thanh cong',
        )
        navigate(`/restaurants/${result.restaurant.id}`)
        return
      }

      const savedRestaurant = await createRestaurant(payload)
      navigate(`/restaurants/${savedRestaurant.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Luu nha hang that bai')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <h1>{isEditMode ? 'Chinh sua nha hang' : 'Tao nha hang moi'}</h1>
          <p>
            {isEditMode
              ? 'Gio mo cua va trang thai van hanh cap nhat ngay; ten, dia chi, toa do, hinh anh va rating can admin duyet.'
              : 'Nha hang moi se o trang thai PENDING truoc khi admin duyet.'}
          </p>
        </div>
        <Link to="/restaurants" className="button-secondary">
          Quay lai
        </Link>
      </div>

      <form className="restaurant-form-card" onSubmit={handleSubmit}>
        {submitMessage ? <p className="restaurant-feedback success">{submitMessage}</p> : null}
        {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
        {isLoading ? <p className="restaurant-status-text">Dang xu ly...</p> : null}

        <div className="restaurant-form-grid">
          <label className="restaurant-field">
            <span>Owner ID</span>
            <input type="number" min="1" value={form.ownerId} onChange={handleInputChange('ownerId')} required readOnly={!isAdmin} />
            {errors.ownerId ? <small className="field-error">{errors.ownerId}</small> : null}
          </label>

          <label className="restaurant-field">
            <span>Rating Avg</span>
            <input type="number" min="0" max="5" step="0.1" value={form.ratingAvg} onChange={handleInputChange('ratingAvg')} required />
            {errors.ratingAvg ? <small className="field-error">{errors.ratingAvg}</small> : null}
          </label>

          <label className="restaurant-field full">
            <span>Ten nha hang</span>
            <input type="text" value={form.name} onChange={handleInputChange('name')} required />
            {errors.name ? <small className="field-error">{errors.name}</small> : null}
          </label>

          <label className="restaurant-field full">
            <span>Dia chi</span>
            <input type="text" value={form.address} onChange={handleInputChange('address')} />
          </label>

          <label className="restaurant-field">
            <span>Latitude</span>
            <input type="number" step="0.000001" value={form.latitude} onChange={handleInputChange('latitude')} required />
            {errors.latitude ? <small className="field-error">{errors.latitude}</small> : null}
          </label>

          <label className="restaurant-field">
            <span>Longitude</span>
            <input type="number" step="0.000001" value={form.longitude} onChange={handleInputChange('longitude')} required />
            {errors.longitude ? <small className="field-error">{errors.longitude}</small> : null}
          </label>

          <label className="restaurant-field">
            <span>Gio mo cua</span>
            <input type="time" value={form.openingTime} onChange={handleInputChange('openingTime')} required />
            {errors.openingTime ? <small className="field-error">{errors.openingTime}</small> : null}
          </label>

          <label className="restaurant-field">
            <span>Gio dong cua</span>
            <input type="time" value={form.closingTime} onChange={handleInputChange('closingTime')} required />
            {errors.closingTime ? <small className="field-error">{errors.closingTime}</small> : null}
          </label>

          <label className="restaurant-field full">
            <span>Image URL</span>
            <input type="url" value={form.imageUrl} onChange={handleInputChange('imageUrl')} placeholder="https://example.com/restaurant.jpg" />
          </label>

          <label className="restaurant-checkbox">
            <input type="checkbox" checked={form.isOpen} onChange={handleInputChange('isOpen')} />
            <span>Nha hang dang mo cua</span>
          </label>
        </div>

        <div className="restaurant-form-actions">
          <button type="submit" className="button-primary" disabled={isLoading}>
            {isLoading ? 'Dang luu...' : isEditMode ? 'Cap nhat nha hang' : 'Tao nha hang'}
          </button>
          <Link to="/restaurants" className="button-secondary">
            Huy
          </Link>
        </div>
      </form>
    </section>
  )
}
