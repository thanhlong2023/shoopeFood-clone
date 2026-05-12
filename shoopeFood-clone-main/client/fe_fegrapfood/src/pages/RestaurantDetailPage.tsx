import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import { getFoods } from '../services/api/foods'
import { getCategories } from '../services/api/categories'
import type { Category, Food, Restaurant } from '../types'

const fallbackRestaurantImage =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85'

const foodImages = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=560&q=80',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=560&q=80',
]

function getFoodImage(foodId: number, index: number) {
  return foodImages[(foodId + index) % foodImages.length]
}

function formatTime(value: string) {
  return value?.slice(0, 5) || '--:--'
}

function approvalLabel(status: Restaurant['approvalStatus']) {
  if (status === 'APPROVED') return 'Da duyet'
  if (status === 'REJECTED') return 'Bi tu choi'
  return 'Cho duyet'
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const restaurantId = Number(id)
  const { hasRole, user } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const isMerchant = hasRole(['MERCHANT'])

  useDocumentTitle(`${APP_NAME} | Restaurant detail`)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFoodsLoading, setIsFoodsLoading] = useState(true)
  const [isCategoriesLoading, setIsCategoriesLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [foodError, setFoodError] = useState<string | null>(null)
  const [categoryError, setCategoryError] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadRestaurant() {
      if (!Number.isFinite(restaurantId)) {
        setErrorMessage('Restaurant ID khong hop le')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)
        const item = await getRestaurantById(restaurantId)
        if (!ignore) {
          const isOwner = user ? item.ownerId === user.id : false
          const canViewDetail = isAdmin || (isMerchant && isOwner) || item.approvalStatus === 'APPROVED'

          if (!canViewDetail) {
            setRestaurant(null)
            setErrorMessage('Ban khong co quyen xem nha hang nay')
            return
          }

          setRestaurant(item)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai chi tiet nha hang')
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
  }, [isAdmin, isMerchant, restaurantId, user])

  useEffect(() => {
    let ignore = false

    async function loadFoods() {
      if (!Number.isFinite(restaurantId)) {
        setFoodError('Restaurant ID khong hop le')
        setFoods([])
        setIsFoodsLoading(false)
        return
      }

      try {
        setIsFoodsLoading(true)
        setFoodError(null)
        const items = await getFoods({ restaurantId })
        if (!ignore) {
          setFoods(items)
        }
      } catch (error) {
        if (!ignore) {
          setFoodError(error instanceof Error ? error.message : 'Khong the tai danh sach mon')
          setFoods([])
        }
      } finally {
        if (!ignore) {
          setIsFoodsLoading(false)
        }
      }
    }

    void loadFoods()

    return () => {
      ignore = true
    }
  }, [restaurantId])

  useEffect(() => {
    let ignore = false

    async function loadCategories() {
      if (!Number.isFinite(restaurantId)) {
        setCategoryError('Restaurant ID khong hop le')
        setCategories([])
        setIsCategoriesLoading(false)
        return
      }

      try {
        setIsCategoriesLoading(true)
        setCategoryError(null)
        const items = await getCategories({ restaurantId })
        if (!ignore) {
          setCategories(items)
        }
      } catch (error) {
        if (!ignore) {
          setCategoryError(error instanceof Error ? error.message : 'Khong the tai danh sach danh muc')
          setCategories([])
        }
      } finally {
        if (!ignore) {
          setIsCategoriesLoading(false)
        }
      }
    }

    void loadCategories()

    return () => {
      ignore = true
    }
  }, [restaurantId])

  const position = useMemo<[number, number]>(() => {
    if (!restaurant) {
      return [10.77689, 106.70081]
    }

    return [restaurant.latitude, restaurant.longitude]
  }, [restaurant])

  const canManageRestaurant = Boolean(restaurant && (isAdmin || (isMerchant && user?.id === restaurant.ownerId)))

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <h1>{restaurant?.name || 'Chi tiet nha hang'}</h1>
          <p>{restaurant?.address || 'Thong tin nha hang lay truc tiep tu API backend.'}</p>
        </div>
        <div className="restaurant-actions">
          <Link to="/restaurants" className="button-secondary">
            Quay lai
          </Link>
          {restaurant && canManageRestaurant ? (
            <Link to={`/restaurants/edit/${restaurant.id}`} className="button-primary">
              Sua nha hang
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? <p className="empty-state">Dang tai chi tiet nha hang...</p> : null}
      {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}

      {restaurant ? (
        <>
          <div className="restaurant-detail-grid">
            <article className="restaurant-detail-card">
              <img src={restaurant.imageUrl || fallbackRestaurantImage} alt={restaurant.name} className="restaurant-detail-image" />

              <div className="restaurant-detail-info">
                <div className="restaurant-card-meta">
                  <strong>{restaurant.ratingAvg.toFixed(1)} sao</strong>
                  <span className={`status-tag ${restaurant.isOpen && restaurant.isOpenToday ? 'open' : 'closed'}`}>
                    {restaurant.isOpen && restaurant.isOpenToday ? 'Dang mo cua' : 'Da dong cua'}
                  </span>
                  {canManageRestaurant ? (
                    <span className={`approval-tag ${restaurant.approvalStatus.toLowerCase()}`}>{approvalLabel(restaurant.approvalStatus)}</span>
                  ) : null}
                </div>

                <dl className="restaurant-detail-list">
                  {canManageRestaurant ? (
                    <div>
                      <dt>Owner ID</dt>
                      <dd>{restaurant.ownerId}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Dia chi</dt>
                    <dd>{restaurant.address || 'Chua co dia chi'}</dd>
                  </div>
                  <div>
                    <dt>Gio mo cua</dt>
                    <dd>
                      {formatTime(restaurant.openingTime)} - {formatTime(restaurant.closingTime)}
                    </dd>
                  </div>
                  {canManageRestaurant ? (
                    <div>
                      <dt>Trang thai hom nay</dt>
                      <dd>{restaurant.isOpenToday ? 'Mo trong hom nay' : restaurant.temporaryClosedReason || 'Dong trong hom nay'}</dd>
                    </div>
                ) : null}
                {canManageRestaurant && restaurant.temporaryClosedUntil ? (
                  <div>
                    <dt>Dong den</dt>
                    <dd>{new Date(restaurant.temporaryClosedUntil).toLocaleString('vi-VN')}</dd>
                  </div>
                ) : null}
                {canManageRestaurant ? (
                  <div>
                    <dt>Duyet hien thi</dt>
                    <dd>{approvalLabel(restaurant.approvalStatus)}</dd>
                  </div>
                ) : null}
                {canManageRestaurant && restaurant.rejectReason ? (
                  <div>
                    <dt>Ly do tu choi</dt>
                    <dd>{restaurant.rejectReason}</dd>
                  </div>
                ) : null}
                {canManageRestaurant ? (
                  <div>
                    <dt>Toa do</dt>
                    <dd>
                      {restaurant.latitude}, {restaurant.longitude}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </article>

          <aside className="restaurant-map-card">
            <h2>Vi tri nha hang</h2>
            <div className="map-wrap" role="img" aria-label={`Ban do cua ${restaurant.name}`}>
              <MapContainer center={position} zoom={15} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={position}>
                  <Popup>
                    <strong>{restaurant.name}</strong>
                    <br />
                    {restaurant.address || 'Chua co dia chi'}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </aside>
        </div>

        <section className="restaurant-food-list">
          <div className="restaurant-food-list-header">
            <h2>Menu mon an</h2>
            <p>{`Mon an cua ${restaurant.name}`}</p>
          </div>
          {isFoodsLoading ? (
            <p className="empty-state">Dang tai menu mon...</p>
          ) : foodError ? (
            <p className="restaurant-feedback error">{foodError}</p>
          ) : foods.length === 0 ? (
            <p className="empty-state">Chua co mon nao cho nha hang nay.</p>
          ) : (
            <div className="restaurant-food-grid">
              {foods.map((food, index) => {
                const categoryName = categories.find((category) => category.id === food.categoryId)?.name
                return (
                  <article key={food.id} className="restaurant-food-card">
                    <img src={getFoodImage(food.id, index)} alt={food.name} className="restaurant-food-card-photo" />
                    <div className="restaurant-food-card-head">
                      <h3>{food.name}</h3>
                      <strong>{Number(food.price).toLocaleString('vi-VN')} VND</strong>
                    </div>
                    <div className="restaurant-food-card-details">
                      <p className="restaurant-food-category">
                        <strong>Danh mục:</strong> {categoryName || (isCategoriesLoading ? 'Dang tai...' : 'Chua co danh muc')}
                      </p>
                      <p>
                        <strong>Tình trạng:</strong> {food.isAvailable ? 'Đang bán' : 'Tạm dừng'}
                      </p>
                      <p>
                        <strong>Tồn kho:</strong> {food.currentQuantity} / {food.defaultQuantity}
                      </p>
                      {food.quantityResetDate ? (
                        <p>
                          <strong>Làm mới kho:</strong> {new Date(food.quantityResetDate).toLocaleDateString('vi-VN')}
                        </p>
                      ) : null}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>
        </>
      ) : null}
    </section>
  )
}
