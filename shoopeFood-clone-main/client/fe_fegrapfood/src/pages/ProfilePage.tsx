import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { APP_NAME } from '../constants/app'
import { AUTH_USER_STORAGE_KEY } from '../constants/auth'
import ImageUrlField from '../components/common/ImageUrlField'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { updateProfile } from '../services/api/auth'
import { getMyRestaurants, updateRestaurant } from '../services/api/restaurants'
import { getRestaurantImageUrl, restaurantThumbStyle } from '../utils/restaurantImage'
import type { Restaurant } from '../types'

export default function ProfilePage() {
  useDocumentTitle(`${APP_NAME} | Ho so`)
  const { user, refreshUser } = useAuth()
  const isMerchant = user?.role === 'MERCHANT'

  const [fullName, setFullName] = useState(user?.fullName || '')
  const [phone, setPhone] = useState(user?.phone || '')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [imageUrls, setImageUrls] = useState<Record<number, string>>({})
  const [isLoadingRestaurants, setIsLoadingRestaurants] = useState(false)
  const [savingRestaurantId, setSavingRestaurantId] = useState<number | null>(null)

  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [restaurantFeedback, setRestaurantFeedback] = useState<string | null>(null)
  const [restaurantError, setRestaurantError] = useState<string | null>(null)

  useEffect(() => {
    if (user) {
      setFullName(user.fullName)
      setPhone(user.phone)
    }
  }, [user])

  const loadRestaurants = useCallback(async () => {
    if (!isMerchant) {
      return
    }

    try {
      setIsLoadingRestaurants(true)
      setRestaurantError(null)
      const items = await getMyRestaurants()
      setRestaurants(items)
      setImageUrls(
        items.reduce<Record<number, string>>((map, restaurant) => {
          map[restaurant.id] = restaurant.imageUrl ?? ''
          return map
        }, {}),
      )
    } catch (error) {
      setRestaurantError(error instanceof Error ? error.message : 'Khong the tai quan cua ban')
    } finally {
      setIsLoadingRestaurants(false)
    }
  }, [isMerchant])

  useEffect(() => {
    void loadRestaurants()
  }, [loadRestaurants])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()

    if (!trimmedName || !trimmedPhone) {
      setErrorMessage('Ho ten va so dien thoai la bat buoc')
      return
    }

    try {
      setIsSaving(true)
      setErrorMessage(null)
      setFeedback(null)

      const updated = await updateProfile({ fullName: trimmedName, phone: trimmedPhone })
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(updated))
      await refreshUser()
      setFeedback('Da cap nhat thong tin ca nhan')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the cap nhat ho so')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSaveRestaurantImage(restaurant: Restaurant) {
    try {
      setSavingRestaurantId(restaurant.id)
      setRestaurantError(null)
      setRestaurantFeedback(null)

      const imageUrl = (imageUrls[restaurant.id] ?? '').trim() || null
      await updateRestaurant(restaurant.id, { imageUrl })

      setRestaurantFeedback(`Da cap nhat hinh anh cho "${restaurant.name}"`)
      await loadRestaurants()
    } catch (error) {
      setRestaurantError(error instanceof Error ? error.message : 'Khong the cap nhat hinh anh quan')
    } finally {
      setSavingRestaurantId(null)
    }
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-form-card">
        <span className="hero-badge">Tai khoan</span>
        <h1>Thong tin ca nhan</h1>
        <p>Cap nhat ho ten va so dien thoai. Khong doi mat khau hay vai tro tai day.</p>
      </div>

      <div className="restaurant-form-card">
        {user ? (
          <div className="profile-summary">
            <p>
              <strong>ID:</strong> #{user.id}
            </p>
            <p>
              <strong>Vai tro dang nhap:</strong> {user.role}
            </p>
            <p>
              <strong>Danh gia:</strong> {user.ratingAvg.toFixed(2)}
            </p>
          </div>
        ) : null}

        {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}
        {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}

        <form className="restaurant-form" onSubmit={handleSubmit}>
          <div className="restaurant-form-grid">
            <div className="restaurant-field full">
              <label htmlFor="profileFullName">Ho ten</label>
              <input
                id="profileFullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nhap ho ten"
              />
            </div>

            <div className="restaurant-field full">
              <label htmlFor="profilePhone">So dien thoai</label>
              <input
                id="profilePhone"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0900000001"
              />
            </div>
          </div>

          <div className="restaurant-form-actions">
            <button type="submit" className="button-primary" disabled={isSaving}>
              {isSaving ? 'Dang luu...' : 'Luu thong tin'}
            </button>
          </div>
        </form>
      </div>

      {isMerchant ? (
        <div className="restaurant-form-card">
          <span className="hero-badge">Chu quan</span>
          <h2>Hinh anh quan cua toi</h2>
          <p>Dan link URL hinh anh cho tung quan. Anh hien tren trang dat mon sau khi luu.</p>

          {restaurantFeedback ? <p className="restaurant-feedback success">{restaurantFeedback}</p> : null}
          {restaurantError ? <p className="restaurant-feedback error">{restaurantError}</p> : null}
          {isLoadingRestaurants ? <p className="empty-state">Dang tai quan...</p> : null}

          {!isLoadingRestaurants && restaurants.length === 0 ? (
            <p className="empty-state">Chua co quan nao duoc gan. Lien he admin de duoc tao quan.</p>
          ) : null}

          <div className="profile-restaurant-list">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="profile-restaurant-card">
                <div className="profile-restaurant-card-head">
                  <div
                    className={`profile-restaurant-thumb ${restaurantThumbStyle(restaurant.imageUrl) ? '' : 'restaurant-thumb--placeholder'}`}
                    style={restaurantThumbStyle(getRestaurantImageUrl(imageUrls[restaurant.id]) ?? restaurant.imageUrl)}
                  />
                  <div>
                    <h3>{restaurant.name}</h3>
                    <p>#{restaurant.id} · {restaurant.address || 'Chua co dia chi'}</p>
                  </div>
                </div>

                <ImageUrlField
                  id={`merchantRestaurantImage-${restaurant.id}`}
                  label="Link hinh anh quan"
                  value={imageUrls[restaurant.id] ?? ''}
                  hint="Dan URL anh cong khai (jpg, png, webp...)."
                  onChange={(value) =>
                    setImageUrls((current) => ({
                      ...current,
                      [restaurant.id]: value,
                    }))
                  }
                />

                <div className="restaurant-form-actions">
                  <button
                    type="button"
                    className="button-primary"
                    disabled={savingRestaurantId === restaurant.id}
                    onClick={() => void handleSaveRestaurantImage(restaurant)}
                  >
                    {savingRestaurantId === restaurant.id ? 'Dang luu...' : 'Luu hinh anh quan'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
