import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import ImageUrlField from '../components/common/ImageUrlField'
import { createFood, getFoods, updateFood, type FoodPayload } from '../services/api/foods'
import { createCategory, getCategories } from '../services/api/categories'
import { foodPhotoStyle } from '../utils/foodImage'
import { restaurantCoverStyle } from '../utils/restaurantImage'
import type { Restaurant, Food, Category } from '../types'

type FoodFormState = {
  id: number | null
  name: string
  imageUrl: string
  categoryId: string
  price: string
  defaultQuantity: string
  currentQuantity: string
  isAvailable: boolean
}

const emptyFoodForm: FoodFormState = {
  id: null,
  name: '',
  imageUrl: '',
  categoryId: '',
  price: '',
  defaultQuantity: '0',
  currentQuantity: '0',
  isAvailable: true,
}

type FoodFormErrors = Partial<Record<'name' | 'price' | 'defaultQuantity' | 'currentQuantity', string>>

function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return '-'
  return timeString.slice(0, 5)
}

function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('vi-VN')
}

function isFoodInStock(food: Food) {
  return food.isAvailable && Number(food.currentQuantity || 0) > 0
}

function RestaurantMap({ restaurant }: { restaurant: Restaurant }) {
  const position: [number, number] = [restaurant.latitude, restaurant.longitude]

  return (
    <MapContainer center={position} zoom={16} scrollWheelZoom={false} className="restaurant-map">
      <MapViewUpdater position={position} />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <CircleMarker
        center={position}
        radius={12}
        pathOptions={{ color: '#007a3d', fillColor: '#00b14f', fillOpacity: 0.85, weight: 3 }}
      >
        <Popup>
          <strong>{restaurant.name}</strong>
          <br />
          {restaurant.address}
        </Popup>
      </CircleMarker>
    </MapContainer>
  )
}

function MapViewUpdater({ position }: { position: [number, number] }) {
  const map = useMap()

  useEffect(() => {
    map.setView(position, map.getZoom())
  }, [map, position])

  return null
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const restaurantId = Number(id)

  useDocumentTitle(`${APP_NAME} | Chi tiết nhà hàng`)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm)
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(true)
  const [isFoodsLoading, setIsFoodsLoading] = useState(false)
  const [isSavingFood, setIsSavingFood] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [foodErrors, setFoodErrors] = useState<FoodFormErrors>({})
  const [categoryNameError, setCategoryNameError] = useState<string | null>(null)
  const [foodFeedback, setFoodFeedback] = useState<string | null>(null)
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null)

  const isAdmin = user?.role === 'ADMIN'
  const isMerchantOwner = Boolean(
    restaurant && user && user.role === 'MERCHANT' && restaurant.ownerId === user.id,
  )
  const backPath = isMerchantOwner ? '/merchant/menu' : isAdmin ? '/admin?tab=restaurants' : '/'
  const backLabel = isMerchantOwner ? 'Quay lai thuc don' : isAdmin ? 'Quay lai quan ly' : 'Quay lai dat mon'
  const canManageFoods = Boolean(
    restaurant && user && (user.role === 'ADMIN' || isMerchantOwner),
  )

  const loadMenu = useCallback(async () => {
    const [foodsData, categoriesData] = await Promise.all([
      getFoods({ restaurantId }),
      getCategories({ restaurantId }),
    ])

    setFoods(foodsData)
    setCategories(categoriesData)
  }, [restaurantId])

  useEffect(() => {
    if (!Number.isFinite(restaurantId)) {
      setErrorMessage('ID nhà hàng không hợp lệ')
      setIsRestaurantLoading(false)
      return
    }

    let ignore = false

    async function loadData() {
      try {
        setIsRestaurantLoading(true)
        setIsFoodsLoading(true)
        setErrorMessage(null)
        setMenuError(null)

        const restaurantData = await getRestaurantById(restaurantId)

        if (!ignore) {
          setRestaurant(restaurantData)
          try {
            await loadMenu()
          } catch (error) {
            if (!ignore) {
              setMenuError(error instanceof Error ? error.message : 'Không thể tải danh sách món ăn')
            }
          }
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải thông tin nhà hàng')
        }
      } finally {
        if (!ignore) {
          setIsRestaurantLoading(false)
          setIsFoodsLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      ignore = true
    }
  }, [loadMenu, restaurantId])

  useEffect(() => {
    if (!foodForm.categoryId && categories.length > 0) {
      setFoodForm((current) => ({ ...current, categoryId: String(categories[0].id) }))
    }
  }, [categories, foodForm.categoryId])

  const foodsByCategory = useMemo(() => {
    return foods.reduce<Record<number, Food[]>>((groups, food) => {
      const categoryId = food.categoryId || 0
      groups[categoryId] = [...(groups[categoryId] || []), food]
      return groups
    }, {})
  }, [foods])

  function editFood(food: Food) {
    setFoodFeedback(null)
    setFoodForm({
      id: food.id,
      name: food.name,
      imageUrl: food.imageUrl ?? '',
      categoryId: food.categoryId ? String(food.categoryId) : '',
      price: String(food.price),
      defaultQuantity: String(food.defaultQuantity),
      currentQuantity: String(food.currentQuantity),
      isAvailable: food.isAvailable,
    })
  }

  function resetFoodForm() {
    setFoodForm({
      ...emptyFoodForm,
      categoryId: categories[0] ? String(categories[0].id) : '',
    })
    setFoodErrors({})
  }

  function updateFoodField<K extends keyof FoodFormState>(field: K, value: FoodFormState[K]) {
    setFoodForm((current) => ({ ...current, [field]: value }))
    setFoodErrors((current) => {
      if (!(field in current)) return current
      return { ...current, [field]: undefined }
    })
  }

  function buildFoodPayload(): FoodPayload | null {
    const name = foodForm.name.trim()
    const categoryId = foodForm.categoryId ? Number(foodForm.categoryId) : null
    const price = Number(foodForm.price)
    const defaultQuantity = Number(foodForm.defaultQuantity)
    const currentQuantity = Number(foodForm.currentQuantity)
    const nextErrors: FoodFormErrors = {}

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
      nextErrors.currentQuantity = 'Số lượng hiện có phải là số nguyên không âm'
    } else if (Number.isInteger(defaultQuantity) && defaultQuantity >= 0 && currentQuantity > defaultQuantity) {
      nextErrors.currentQuantity = 'Số lượng hiện có không được lớn hơn số lượng mặc định'
    }

    if (Object.keys(nextErrors).length > 0) {
      setFoodErrors(nextErrors)
      return null
    }

    setFoodErrors({})

    return {
      name,
      imageUrl: foodForm.imageUrl.trim() || null,
      categoryId,
      price,
      defaultQuantity,
      currentQuantity,
      isAvailable: foodForm.isAvailable,
    }
  }

  async function handleCategorySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const name = categoryName.trim()
    if (!name) {
      setCategoryNameError('Tên danh mục là bắt buộc')
      return
    }

    try {
      setIsSavingCategory(true)
      setCategoryNameError(null)
      setCategoryFeedback(null)

      await createCategory({ name, restaurantId })
      setCategoryFeedback(`Đã thêm danh mục "${name}"`)
      setCategoryName('')
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể tạo danh mục')
    } finally {
      setIsSavingCategory(false)
    }
  }

  async function handleFoodSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const payload = buildFoodPayload()
    if (!payload) return

    try {
      setIsSavingFood(true)
      setFoodFeedback(null)

      if (foodForm.id) {
        await updateFood(foodForm.id, payload)
        setFoodFeedback(`Đã cập nhật món #${foodForm.id}`)
      } else {
        await createFood(payload)
        setFoodFeedback('Đã thêm món ăn mới')
      }

      await loadMenu()
      resetFoodForm()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể lưu món ăn')
    } finally {
      setIsSavingFood(false)
    }
  }

  if (isRestaurantLoading) {
    return (
      <section className="restaurant-page">
        <div className="loading-state">
          <p>Đang tải thông tin nhà hàng...</p>
        </div>
      </section>
    )
  }

  if (errorMessage || !restaurant) {
    return (
      <section className="restaurant-page">
        <div className="error-state">
          <p>{errorMessage || 'Không tìm thấy nhà hàng'}</p>

          <Link to={backPath} className="button-secondary">
            {backLabel}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <Link to={backPath} className="button-secondary">
          {backLabel}
        </Link>
        {isMerchantOwner ? (
          <Link to="/merchant/orders" className="button-secondary">
            Don hang
          </Link>
        ) : null}
      </div>

      <div className="restaurant-detail-card">
        <div className="restaurant-detail-hero" style={restaurantCoverStyle(restaurant.imageUrl)}>
          <div className="restaurant-detail-info">
            <h1>{restaurant.name}</h1>

            <div className="detail-status-badges">
              <span className={`status-badge ${restaurant.approvalStatus.toLowerCase()}`}>
                {restaurant.approvalStatus === 'PENDING'
                  ? 'Chờ phê duyệt'
                  : restaurant.approvalStatus === 'APPROVED'
                    ? 'Đã duyệt'
                    : 'Bị từ chối'}
              </span>
              <span className={`status-badge ${restaurant.isOpen ? 'open' : 'closed'}`}>
                {restaurant.isOpen ? 'Mở cửa' : 'Đóng cửa'}
              </span>
              <span className={`status-badge ${restaurant.isOpenToday ? 'open' : 'closed'}`}>
                {restaurant.isOpenToday ? 'Mở hôm nay' : 'Đóng hôm nay'}
              </span>
            </div>

            <p className="restaurant-detail-address">Vị trí: {restaurant.address}</p>

            <div className="restaurant-detail-metrics">
              <span>Đánh giá {restaurant.ratingAvg.toFixed(2)}</span>
              <span>
                {formatTime(restaurant.openingTime)} - {formatTime(restaurant.closingTime)}
              </span>
              <span>ID: #{restaurant.id}</span>
            </div>

            {restaurant.isOpenToday === false && restaurant.temporaryClosedReason && (
              <div className="alert alert-warning">
                <strong>Đóng tạm thời:</strong> {restaurant.temporaryClosedReason}
                {restaurant.temporaryClosedUntil && <p>Hết lý do lúc: {formatDateTime(restaurant.temporaryClosedUntil)}</p>}
              </div>
            )}

            {restaurant.approvalStatus === 'REJECTED' && restaurant.rejectReason && (
              <div className="alert alert-error">
                <strong>Lý do từ chối:</strong> {restaurant.rejectReason}
              </div>
            )}

            {restaurant.approvalStatus === 'APPROVED' && (
              <p className="detail-meta">
                Phê duyệt bởi Admin #{restaurant.approvedBy} vào {formatDateTime(restaurant.approvedAt)}
              </p>
            )}
          </div>
        </div>

        {!isMerchantOwner ? (
          <div className="restaurant-map-section">
            <h2>Vị trí địa lý</h2>

            <div className="restaurant-coordinates">
              <span>
                Vĩ độ: <strong>{restaurant.latitude.toFixed(6)}</strong>
              </span>
              <span>
                Kinh độ: <strong>{restaurant.longitude.toFixed(6)}</strong>
              </span>
            </div>

            <RestaurantMap restaurant={restaurant} />
          </div>
        ) : null}

        <div className="restaurant-foods-section">
          <div className="section-heading-row">
            <h2>Danh sách món ăn</h2>
            {canManageFoods ? <span className="owner-note">Them / sua mon cho quan</span> : null}
          </div>

          {menuError ? <p className="restaurant-feedback error">{menuError}</p> : null}
          {foodFeedback ? <p className="restaurant-feedback success">{foodFeedback}</p> : null}
          {categoryFeedback ? <p className="restaurant-feedback success">{categoryFeedback}</p> : null}

          {canManageFoods ? (
            <div className="category-owner-panel">
              <div className="section-heading-row">
                <h3>Danh mục món</h3>
                <button type="button" className="button-secondary" onClick={() => void loadMenu()}>
                  Tải lại
                </button>
              </div>

              {categories.length > 0 ? (
                <div className="category-chip-list">
                  {categories.map((category) => (
                    <span key={category.id} className="category-chip">
                      {category.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Chưa có danh mục. Thêm danh mục trước khi tạo món.</p>
              )}

              <form className="category-owner-form" noValidate onSubmit={handleCategorySubmit}>
                <div className="restaurant-field">
                  <label htmlFor="categoryName">Thêm danh mục mới</label>
                  <input
                    id="categoryName"
                    value={categoryName}
                    onChange={(event) => {
                      setCategoryName(event.target.value)
                      setCategoryNameError(null)
                    }}
                    placeholder="Ví dụ: Món chính, Đồ uống"
                  />
                  {categoryNameError ? <p className="field-error">{categoryNameError}</p> : null}
                </div>
                <button type="submit" className="button-secondary" disabled={isSavingCategory}>
                  {isSavingCategory ? 'Đang lưu...' : 'Thêm danh mục'}
                </button>
              </form>
            </div>
          ) : null}

          {canManageFoods ? (
            <form className="food-owner-form" noValidate onSubmit={handleFoodSubmit}>
              <div className="restaurant-form-grid">
                <div className="restaurant-field">
                  <label htmlFor="foodName">Tên món</label>
                  <input
                    id="foodName"
                    value={foodForm.name}
                    onChange={(event) => updateFoodField('name', event.target.value)}
                    placeholder="Ví dụ: Bún bò"
                  />
                  {foodErrors.name ? <p className="field-error">{foodErrors.name}</p> : null}
                </div>

                <div className="restaurant-field full">
                  <ImageUrlField
                    id="foodImageUrl"
                    label="Link hinh anh mon"
                    value={foodForm.imageUrl}
                    placeholder="https://example.com/mon-an.jpg"
                    hint="Dan link anh mon an de hien thi cho khach dat hang."
                    onChange={(value) => updateFoodField('imageUrl', value)}
                  />
                </div>

                <div className="restaurant-field">
                  <label htmlFor="foodCategory">Danh mục</label>
                  <select
                    id="foodCategory"
                    value={foodForm.categoryId}
                    onChange={(event) => updateFoodField('categoryId', event.target.value)}
                  >
                    {categories.length === 0 ? <option value="">Chưa có danh mục</option> : null}
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="restaurant-field">
                  <label htmlFor="foodPrice">Giá</label>
                  <input
                    id="foodPrice"
                    type="number"
                    step="1000"
                    value={foodForm.price}
                    onChange={(event) => updateFoodField('price', event.target.value)}
                  />
                  {foodErrors.price ? <p className="field-error">{foodErrors.price}</p> : null}
                </div>

                <div className="restaurant-field">
                  <label htmlFor="foodDefaultQuantity">Số lượng mặc định</label>
                  <input
                    id="foodDefaultQuantity"
                    type="number"
                    step="1"
                    value={foodForm.defaultQuantity}
                    onChange={(event) => updateFoodField('defaultQuantity', event.target.value)}
                  />
                  {foodErrors.defaultQuantity ? <p className="field-error">{foodErrors.defaultQuantity}</p> : null}
                </div>

                <div className="restaurant-field">
                  <label htmlFor="foodCurrentQuantity">Số lượng hiện có</label>
                  <input
                    id="foodCurrentQuantity"
                    type="number"
                    step="1"
                    value={foodForm.currentQuantity}
                    onChange={(event) => updateFoodField('currentQuantity', event.target.value)}
                  />
                  {foodErrors.currentQuantity ? <p className="field-error">{foodErrors.currentQuantity}</p> : null}
                </div>

                <div className="restaurant-field">
                  <label className="restaurant-checkbox compact">
                    <input
                      type="checkbox"
                      checked={foodForm.isAvailable}
                      onChange={(event) => updateFoodField('isAvailable', event.target.checked)}
                    />
                    <span>{foodForm.isAvailable ? 'Đang bán' : 'Ngưng bán'}</span>
                  </label>
                </div>
              </div>

              <div className="restaurant-form-actions">
                {foodForm.id ? (
                  <button type="button" className="button-secondary" onClick={resetFoodForm}>
                    Hủy sửa
                  </button>
                ) : null}
                <button type="submit" className="button-primary" disabled={isSavingFood || categories.length === 0}>
                  {isSavingFood ? 'Đang lưu...' : foodForm.id ? 'Cập nhật món' : 'Thêm món ăn'}
                </button>
              </div>
            </form>
          ) : null}

          {isFoodsLoading ? (
            <p className="loading-state">Đang tải danh sách món ăn...</p>
          ) : categories.length === 0 && foods.length === 0 ? (
            <p className="empty-state">Chưa có danh mục và món ăn nào</p>
          ) : (
            <div className="foods-by-category">
              {categories.map((category) => {
                const categoryFoods = foodsByCategory[category.id] || []

                return (
                  <div key={category.id} className="food-category-group">
                    <h3>{category.name}</h3>

                    {categoryFoods.length === 0 ? (
                      <p className="empty-state">Chưa có món trong danh mục này</p>
                    ) : (
                      <div className="food-grid">
                        {categoryFoods.map((food) => (
                          <div key={food.id} className="restaurant-food-card">
                            <div
                              className={`food-card-photo ${foodPhotoStyle(food.imageUrl) ? '' : 'food-photo--placeholder'}`}
                              style={foodPhotoStyle(food.imageUrl)}
                            />
                            <div className="food-card-header">
                              <h4>{food.name}</h4>
                              <span className={`availability-badge ${isFoodInStock(food) ? 'available' : 'unavailable'}`}>
                                {isFoodInStock(food) ? 'Còn' : 'Hết'}
                              </span>
                            </div>

                            <div className="food-card-details">
                              <p>
                                <strong>{food.price.toLocaleString('vi-VN')} đ</strong>
                              </p>
                              <p>
                                Hiện có: {food.currentQuantity}/{food.defaultQuantity}
                              </p>
                              {food.quantityResetDate ? <p>Reset lúc: {formatDateTime(food.quantityResetDate)}</p> : null}
                            </div>

                            {canManageFoods ? (
                              <div className="food-card-actions">
                                <button type="button" className="button-secondary" onClick={() => editFood(food)}>
                                  Sửa món
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              {(foodsByCategory[0] || []).length > 0 ? (
                <div className="food-category-group">
                  <h3>Không có danh mục</h3>
                  <div className="food-grid">
                    {(foodsByCategory[0] || []).map((food) => (
                      <div key={food.id} className="restaurant-food-card">
                        <div
                          className={`food-card-photo ${foodPhotoStyle(food.imageUrl) ? '' : 'food-photo--placeholder'}`}
                          style={foodPhotoStyle(food.imageUrl)}
                        />
                        <div className="food-card-header">
                          <h4>{food.name}</h4>
                          <span className={`availability-badge ${isFoodInStock(food) ? 'available' : 'unavailable'}`}>
                            {isFoodInStock(food) ? 'Còn' : 'Hết'}
                          </span>
                        </div>
                        <div className="food-card-details">
                          <p>
                            <strong>{food.price.toLocaleString('vi-VN')} đ</strong>
                          </p>
                        </div>
                        {canManageFoods ? (
                          <div className="food-card-actions">
                            <button type="button" className="button-secondary" onClick={() => editFood(food)}>
                              Sửa món
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
