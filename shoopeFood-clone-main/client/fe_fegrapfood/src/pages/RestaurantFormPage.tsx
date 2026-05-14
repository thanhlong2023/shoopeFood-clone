<<<<<<< HEAD
import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createRestaurant, getRestaurantById, updateRestaurant } from '../services/api/restaurants'
import type { RestaurantCreateInput } from '../types'

type FormState = {
=======
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createRestaurant, getRestaurantById, updateRestaurant } from '../services/api/restaurants'
import type { RestaurantPayload } from '../types'

type RestaurantFormState = {
>>>>>>> origin/main
  ownerId: string
  name: string
  address: string
  latitude: string
  longitude: string
<<<<<<< HEAD
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
=======
  isOpen: boolean
  imageUrl: string
  ratingAvg: string
}

type FormErrors = Partial<Record<keyof RestaurantFormState, string>>

const initialFormState: RestaurantFormState = {
  ownerId: '1',
  name: '',
  address: '',
  latitude: '0',
  longitude: '0',
  isOpen: true,
  imageUrl: '',
  ratingAvg: '5',
>>>>>>> origin/main
}

export default function RestaurantFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
<<<<<<< HEAD
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
=======
  const restaurantId = id ? Number(id) : null
  const isEditMode = restaurantId !== null && Number.isFinite(restaurantId)

  useDocumentTitle(`${APP_NAME} | ${isEditMode ? 'Edit restaurant' : 'Create restaurant'}`)

  const [formData, setFormData] = useState<RestaurantFormState>(initialFormState)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(isEditMode)
  const [isSubmitting, setIsSubmitting] = useState(false)
>>>>>>> origin/main
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isEditMode || restaurantId === null) {
<<<<<<< HEAD
      setForm({
        ...emptyForm,
        ownerId: user ? String(user.id) : emptyForm.ownerId,
      })
      setIsLoading(false)
      return
    }

    const currentRestaurantId = restaurantId
=======
      setFormData(initialFormState)
      return
    }

    const nextRestaurantId = restaurantId
>>>>>>> origin/main
    let ignore = false

    async function loadRestaurant() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
<<<<<<< HEAD
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
=======
        const restaurant = await getRestaurantById(nextRestaurantId)

        if (!ignore) {
          setFormData({
            ownerId: String(restaurant.ownerId),
            name: restaurant.name,
            address: restaurant.address,
            latitude: String(restaurant.latitude),
            longitude: String(restaurant.longitude),
            isOpen: restaurant.isOpen,
            imageUrl: restaurant.imageUrl ?? '',
            ratingAvg: String(restaurant.ratingAvg),
>>>>>>> origin/main
          })
        }
      } catch (error) {
        if (!ignore) {
<<<<<<< HEAD
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai du lieu nha hang')
=======
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai chi tiet restaurant')
>>>>>>> origin/main
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
<<<<<<< HEAD
  }, [isAdmin, isEditMode, isMerchant, restaurantId, user])

  function handleInputChange(field: keyof FormState) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const value = field === 'isOpen' ? event.target.checked : event.target.value
      setForm((current) => ({ ...current, [field]: value }))
      setErrors((current) => ({ ...current, [field]: undefined }))
      setSubmitMessage(null)
      setErrorMessage(null)
=======
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

  function validateForm(): RestaurantPayload | null {
    const nextErrors: FormErrors = {}
    const trimmedName = formData.name.trim()
    const trimmedAddress = formData.address.trim()
    const ownerId = Number(formData.ownerId)
    const latitude = Number(formData.latitude)
    const longitude = Number(formData.longitude)
    const ratingAvg = Number(formData.ratingAvg)

    if (!trimmedName) {
      nextErrors.name = 'Name la bat buoc'
    }

    if (!trimmedAddress) {
      nextErrors.address = 'Address la bat buoc'
    }

    if (!Number.isFinite(ownerId)) {
      nextErrors.ownerId = 'OwnerId phai la so'
    }

    if (!Number.isFinite(latitude)) {
      nextErrors.latitude = 'Latitude phai parse duoc sang number'
    }

    if (!Number.isFinite(longitude)) {
      nextErrors.longitude = 'Longitude phai parse duoc sang number'
    }

    if (!Number.isFinite(ratingAvg)) {
      nextErrors.ratingAvg = 'RatingAvg phai parse duoc sang number'
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
      isOpen: formData.isOpen,
      imageUrl: formData.imageUrl.trim() || null,
      ratingAvg,
>>>>>>> origin/main
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
<<<<<<< HEAD
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    setSubmitMessage(null)
    setErrorMessage(null)

    if (Object.keys(nextErrors).length > 0) {
=======
    const payload = validateForm()
    if (!payload) {
>>>>>>> origin/main
      return
    }

    try {
<<<<<<< HEAD
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
=======
      setIsSubmitting(true)
      setErrorMessage(null)

      if (isEditMode && restaurantId !== null) {
        await updateRestaurant(restaurantId, payload)
      } else {
        await createRestaurant(payload)
      }

      navigate('/restaurants')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the luu restaurant')
    } finally {
      setIsSubmitting(false)
>>>>>>> origin/main
    }
  }

  return (
    <section className="restaurant-page">
<<<<<<< HEAD
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
=======
      <div className="restaurant-form-card">
        <h1>{isEditMode ? 'Edit restaurant' : 'Create restaurant'}</h1>
        <p>Nhap day du thong tin restaurant va submit truc tiep len backend.</p>
      </div>

      <div className="restaurant-form-card">
        {isLoading ? <p className="restaurant-status-text">Dang tai du lieu restaurant...</p> : null}
        {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}

        {!isLoading ? (
          <form className="restaurant-form" onSubmit={handleSubmit}>
            <div className="restaurant-form-grid">
              <div className="restaurant-field">
                <label htmlFor="ownerId">Owner ID</label>
                <input
                  id="ownerId"
                  name="ownerId"
                  value={formData.ownerId}
                  onChange={(event) => handleFieldChange('ownerId', event.target.value)}
                />
                {errors.ownerId ? <p className="field-error">{errors.ownerId}</p> : null}
              </div>

              <div className="restaurant-field">
                <label htmlFor="ratingAvg">Rating Avg</label>
                <input
                  id="ratingAvg"
                  name="ratingAvg"
                  value={formData.ratingAvg}
                  onChange={(event) => handleFieldChange('ratingAvg', event.target.value)}
                />
                {errors.ratingAvg ? <p className="field-error">{errors.ratingAvg}</p> : null}
              </div>

              <div className="restaurant-field full">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                />
                {errors.name ? <p className="field-error">{errors.name}</p> : null}
              </div>

              <div className="restaurant-field full">
                <label htmlFor="address">Address</label>
                <input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                />
                {errors.address ? <p className="field-error">{errors.address}</p> : null}
              </div>

              <div className="restaurant-field">
                <label htmlFor="latitude">Latitude</label>
                <input
                  id="latitude"
                  name="latitude"
                  value={formData.latitude}
                  onChange={(event) => handleFieldChange('latitude', event.target.value)}
                />
                {errors.latitude ? <p className="field-error">{errors.latitude}</p> : null}
              </div>

              <div className="restaurant-field">
                <label htmlFor="longitude">Longitude</label>
                <input
                  id="longitude"
                  name="longitude"
                  value={formData.longitude}
                  onChange={(event) => handleFieldChange('longitude', event.target.value)}
                />
                {errors.longitude ? <p className="field-error">{errors.longitude}</p> : null}
              </div>

              <div className="restaurant-field full">
                <label htmlFor="imageUrl">Image URL</label>
                <input
                  id="imageUrl"
                  name="imageUrl"
                  value={formData.imageUrl}
                  onChange={(event) => handleFieldChange('imageUrl', event.target.value)}
                />
              </div>

              <div className="restaurant-field full">
                <label htmlFor="isOpen">Trang thai mo cua</label>
                <label className="restaurant-checkbox" htmlFor="isOpen">
                  <input
                    id="isOpen"
                    name="isOpen"
                    type="checkbox"
                    checked={formData.isOpen}
                    onChange={(event) => handleFieldChange('isOpen', event.target.checked)}
                  />
                  <span>{formData.isOpen ? 'Dang mo cua' : 'Tam dong cua'}</span>
                </label>
              </div>
            </div>

            <div className="restaurant-form-actions">
              <Link to="/restaurants" className="button-secondary">
                Back to list
              </Link>

              <button type="submit" className="button-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : isEditMode ? 'Update restaurant' : 'Create restaurant'}
              </button>
            </div>
          </form>
        ) : null}
      </div>
>>>>>>> origin/main
    </section>
  )
}
