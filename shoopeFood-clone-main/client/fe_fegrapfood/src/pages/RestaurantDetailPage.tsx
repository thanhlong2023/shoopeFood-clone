import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import ImageUrlField from '../components/common/ImageUrlField'
import AddressAutocomplete from '../components/common/AddressAutocomplete'
import ShippingTypeSelect from '../components/common/ShippingTypeSelect'
import { reverseGeocodeAddress } from '../services/api/addresses'
import { createFood, getFoods, updateFood, type FoodPayload } from '../services/api/foods'
import { createCategory, getCategories } from '../services/api/categories'
import { foodPhotoStyle } from '../utils/foodImage'
import { restaurantCoverStyle } from '../utils/restaurantImage'
import { getCartDraft, saveCartDraft } from '../utils/cartDraft'
import { saveCheckoutDraft } from '../utils/checkoutDraft'
import type { AddressDetail, Restaurant, Food, Category, CreateOrderPayload } from '../types'

type CartState = Record<number, number>

type CheckoutState = {
  receiverAddress: string
  receiverLat: string
  receiverLng: string
  distanceKm: string
  shippingType: NonNullable<CreateOrderPayload['shippingType']>
}

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

const emptyCheckout: CheckoutState = {
  receiverAddress: '',
  receiverLat: '',
  receiverLng: '',
  distanceKm: '',
  shippingType: 'STANDARD',
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

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function calculateDistanceKm(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusKm = 6371
  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(toLat - fromLat)
  const dLng = toRad(toLng - fromLng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(fromLat)) * Math.cos(toRad(toLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2)

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Math.abs(latitude) <= 90 &&
    Math.abs(longitude) <= 180
  )
}

function toNullableCoordinate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const numberValue = Number(value)
  return Number.isFinite(numberValue) ? numberValue : null
}

function isFoodInStock(food: Food) {
  return food.isAvailable && Number(food.currentQuantity || 0) > 0
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, isAuthenticated } = useAuth()
  const navigate = useNavigate()
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
  
  const [cart, setCart] = useState<CartState>(() => {
    const draft = getCartDraft()
    if (draft?.restaurantId === restaurantId) {
      return draft.cart
    }
    return {}
  })

  useEffect(() => {
    if (Object.keys(cart).length > 0 || getCartDraft()?.restaurantId === restaurantId) {
      saveCartDraft({ restaurantId, cart })
    }
  }, [cart, restaurantId])

  const [checkout, setCheckout] = useState<CheckoutState>(emptyCheckout)
  const [isDeliveryAddressConfirmed, setIsDeliveryAddressConfirmed] = useState(false)
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<AddressDetail | null>(null)
  const [isLocating, setIsLocating] = useState(false)

  const isAdmin = user?.role === 'ADMIN'
  const isMerchantOwner = Boolean(
    restaurant && user && user.role === 'MERCHANT' && restaurant.ownerId === user.id,
  )
  const backPath = isMerchantOwner ? '/merchant/menu' : isAdmin ? '/admin?tab=restaurants' : '/'
  const backLabel = isMerchantOwner ? 'Quay lai thực đơn' : isAdmin ? 'Quay lai quan ly' : 'Quay lai dat mon'
  const canManageFoods = Boolean(
    restaurant && user && (user.role === 'ADMIN' || isMerchantOwner),
  )
  const canOrder = Boolean(
    restaurant &&
      !canManageFoods &&
      restaurant.approvalStatus === 'APPROVED' &&
      restaurant.isOpen &&
      restaurant.isOpenToday,
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

  const cartItems = useMemo(
    () =>
      foods
        .map((food) => ({
          food,
          quantity: cart[food.id] || 0,
        }))
        .filter((item) => item.quantity > 0),
    [cart, foods],
  )
  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + Number(item.food.price || 0) * item.quantity, 0),
    [cartItems],
  )
  const distanceKm = Number(checkout.distanceKm) || 0
  const shippingFee = cartItems.length > 0 ? distanceKm * 3500 : 0
  const discountAmount = cartItems.length > 0 && subtotal >= 100000 ? 15000 : 0
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount)
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  useEffect(() => {
    const receiverLat = toNullableCoordinate(checkout.receiverLat)
    const receiverLng = toNullableCoordinate(checkout.receiverLng)

    if (
      !restaurant ||
      receiverLat === null ||
      receiverLng === null ||
      !Number.isFinite(Number(restaurant.latitude)) ||
      !Number.isFinite(Number(restaurant.longitude))
    ) {
      return
    }

    const nextDistance = calculateDistanceKm(restaurant.latitude, restaurant.longitude, receiverLat, receiverLng)
    setCheckout((current) => ({ ...current, distanceKm: nextDistance.toFixed(2) }))
  }, [restaurant, checkout.receiverLat, checkout.receiverLng])

  function updateCart(food: Food, nextQuantity: number) {
    const maxQuantity = Math.max(0, Number(food.currentQuantity || 0))
    const normalizedQuantity = Math.max(0, Math.min(nextQuantity, maxQuantity))

    setCart((current) => {
      const nextCart = { ...current }

      if (normalizedQuantity === 0) {
        delete nextCart[food.id]
      } else {
        nextCart[food.id] = normalizedQuantity
      }

      return nextCart
    })
  }

  function updateReceiverAddress(value: string) {
    setCheckout((current) => ({
      ...current,
      receiverAddress: value,
      receiverLat: '',
      receiverLng: '',
      distanceKm: '',
    }))
    setSelectedDeliveryAddress(null)
    setIsDeliveryAddressConfirmed(false)
  }

  function selectDeliveryAddress(address: AddressDetail) {
    const receiverLat = toNullableCoordinate(address.latitude)
    const receiverLng = toNullableCoordinate(address.longitude)
    const hasValidCoordinates = receiverLat !== null && receiverLng !== null && isValidCoordinate(receiverLat, receiverLng)
    const nextDistance =
      restaurant && hasValidCoordinates
        ? calculateDistanceKm(restaurant.latitude, restaurant.longitude, receiverLat, receiverLng)
        : Number(checkout.distanceKm)

    setCheckout((current) => ({
      ...current,
      receiverAddress: address.formattedAddress,
      receiverLat: hasValidCoordinates ? receiverLat.toFixed(6) : '',
      receiverLng: hasValidCoordinates ? receiverLng.toFixed(6) : '',
      distanceKm: Number.isFinite(nextDistance) ? nextDistance.toFixed(2) : current.distanceKm,
    }))
    setSelectedDeliveryAddress(address)
    setIsDeliveryAddressConfirmed(hasValidCoordinates)
    setMenuError(hasValidCoordinates ? null : 'Địa chỉ đã chọn chưa có tọa độ hợp lệ')
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMenuError('Trình duyệt không hỗ trợ lấy vị trí')
      return
    }

    setIsLocating(true)
    setMenuError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
        const receiverLat = position.coords.latitude
        const receiverLng = position.coords.longitude
        const nextDistance = restaurant
          ? calculateDistanceKm(restaurant.latitude, restaurant.longitude, receiverLat, receiverLng)
          : Number(checkout.distanceKm)
        const resolvedAddress = await reverseGeocodeAddress(receiverLat, receiverLng)

        if (!resolvedAddress.formattedAddress) {
          throw new Error('Không thể suy ra địa chỉ từ vị trí hiện tại')
        }

        setCheckout((current) => ({
          ...current,
          receiverAddress: resolvedAddress.formattedAddress,
          receiverLat: receiverLat.toFixed(6),
          receiverLng: receiverLng.toFixed(6),
          distanceKm: Number.isFinite(nextDistance) ? nextDistance.toFixed(2) : current.distanceKm,
        }))
        setSelectedDeliveryAddress({
          ...resolvedAddress,
          latitude: receiverLat,
          longitude: receiverLng,
        })
        setIsDeliveryAddressConfirmed(true)
        setIsLocating(false)
        })().catch((error) => {
          setMenuError(error instanceof Error ? error.message : 'Không thể suy ra địa chỉ từ vị trí hiện tại')
          setIsDeliveryAddressConfirmed(false)
          setIsLocating(false)
        })
      },
      (error) => {
        setMenuError(error.message || 'Không thể lấy vị trí hiện tại')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function validateOrder() {
    if (!restaurant) return 'Không tìm thấy nhà hàng'
    if (!canOrder) return 'Nhà hàng hiện chưa nhận đơn'
    if (!isAuthenticated || user?.role !== 'CUSTOMER') return 'Vui lòng đăng nhập tài khoản khách hàng để đặt món'
    if (cartItems.length === 0) return 'Giỏ hàng đang trống'
    if (!checkout.receiverAddress.trim()) return 'Vui lòng nhập địa chỉ giao hàng'
    if (!isDeliveryAddressConfirmed) return 'Vui lòng chọn địa chỉ giao hàng từ danh sách gợi ý'
    const receiverLat = toNullableCoordinate(checkout.receiverLat)
    const receiverLng = toNullableCoordinate(checkout.receiverLng)

    if (receiverLat === null || receiverLng === null || !isValidCoordinate(receiverLat, receiverLng)) {
      return 'Tọa độ giao hàng không hợp lệ'
    }
    if (!Number.isFinite(Number(checkout.distanceKm)) || Number(checkout.distanceKm) <= 0) {
      return 'Khoảng cách giao hàng không hợp lệ'
    }

    return null
  }

  async function handleOrderSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const validationError = validateOrder()

    if (validationError || !restaurant) {
      setMenuError(validationError)
      return
    }

    const idempotencyKey = `WEB-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

    saveCheckoutDraft({
      id: idempotencyKey,
      createdAt: new Date().toISOString(),
      idempotencyKey,
      restaurant: {
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        imageUrl: restaurant.imageUrl,
        ratingAvg: restaurant.ratingAvg,
      },
      receiver: {
        address: checkout.receiverAddress.trim(),
        lat: Number(checkout.receiverLat),
        lng: Number(checkout.receiverLng),
        distanceKm: Number(checkout.distanceKm),
        placeId: selectedDeliveryAddress?.placeId,
        formattedAddress: selectedDeliveryAddress?.formattedAddress,
        province: selectedDeliveryAddress?.province,
        district: selectedDeliveryAddress?.district,
        ward: selectedDeliveryAddress?.ward,
        street: selectedDeliveryAddress?.street,
        houseNumber: selectedDeliveryAddress?.houseNumber,
        provider: selectedDeliveryAddress?.provider || 'BROWSER_GEOLOCATION',
      },
      shippingType: checkout.shippingType,
      pricing: {
        subtotalAmount: subtotal,
        shippingFee,
        discountAmount,
        taxAmount: 0,
        totalAmount,
      },
      items: cartItems.map((item) => ({
        foodId: item.food.id,
        name: item.food.name,
        imageUrl: item.food.imageUrl,
        price: Number(item.food.price),
        quantity: item.quantity,
        lineTotal: Number(item.food.price) * item.quantity,
      })),
    })

    navigate('/payment')
  }

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
      setMenuError(null)
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

  // Strict check: MERCHANTS can only access their own restaurant
  if (user?.role === 'MERCHANT' && restaurant.ownerId !== user.id) {
    return (
      <section className="restaurant-page">
        <div className="error-state">
          <p>Bạn không có quyền truy cập cửa hàng của đối tác khác.</p>
          <Link to="/merchant/menu" className="button-primary">
            Quay về cửa hàng của bạn
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
            Đơn hàng
          </Link>
        ) : null}
      </div>

      <div className="restaurant-detail-card">
        <div className="restaurant-detail-hero" style={restaurantCoverStyle(restaurant.imageUrl, restaurant.id)}>
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



        <div className="restaurant-foods-section">
          <div className="section-heading-row">
            <h2>Danh sách món ăn</h2>
            {canManageFoods ? <span className="owner-note">Them / sua mon cho quan</span> : null}
          </div>


          {foodFeedback ? <p className="restaurant-feedback success">{foodFeedback}</p> : null}
          {categoryFeedback ? <p className="restaurant-feedback success">{categoryFeedback}</p> : null}

          <div className="flex flex-col lg:flex-row gap-6 items-start mt-6">
            <div className="flex-1 min-w-0 w-full">

          {canManageFoods ? (
            <div className="category-owner-panel mb-6">
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
            <form className="food-owner-form mb-6" noValidate onSubmit={handleFoodSubmit}>
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
                    label="Link hình ảnh món ăn"
                    value={foodForm.imageUrl}
                    placeholder="https://example.com/mon-an.jpg"
                    hint="Dán link hình ảnh món ăn để hiển thị cho khách đặt hàng."
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
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                              {categoryFoods.map((food) => (
                                <article key={food.id} className={`tw-food-card bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between ${!isFoodInStock(food) ? 'opacity-60' : ''}`}>
                                  <div>
                                    <div
                                      className={`tw-food-photo h-[120px] relative bg-cover bg-center ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                                      style={foodPhotoStyle(food.imageUrl, food.id)}
                                    >
                                      <span className="absolute left-3 bottom-3 bg-black/60 text-white rounded-full text-[10px] px-2.5 py-1 font-semibold z-10">
                                        {isFoodInStock(food) ? 'Còn' : 'Hết'}
                                      </span>
                                    </div>
                                    <div className="tw-food-body p-3 flex flex-col gap-1">
                                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1 m-0" title={food.name}>{food.name}</h3>
                                      <div className="flex justify-between items-center mt-1">
                                        <span className="font-extrabold text-[gray-900] text-sm">{food.price.toLocaleString('vi-VN')} đ</span>
                                        {canManageFoods && (
                                          <span className="text-[10px] text-gray-500 font-medium">Kho: {food.currentQuantity}/{food.defaultQuantity}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="tw-quantity-row p-3 pt-0 flex flex-wrap items-center justify-between gap-2 mt-auto">
                                    {canOrder && (
                                      <>
                                        {(cart[food.id] || 0) > 0 ? (
                                          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                                            <button
                                              type="button"
                                              className="w-6 h-6 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center cursor-pointer text-gray-600 border border-gray-200 transition-colors"
                                              onClick={() => updateCart(food, (cart[food.id] || 0) - 1)}
                                            >
                                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
                                            </button>
                                            <strong className="text-xs font-bold text-gray-800 w-4 text-center">{cart[food.id]}</strong>
                                          </div>
                                        ) : <span />}
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full text-[11px] font-bold transition-all cursor-pointer border-0 shadow-sm"
                                          onClick={() => updateCart(food, (cart[food.id] || 0) + 1)}
                                          disabled={!isFoodInStock(food) || (cart[food.id] || 0) >= Number(food.currentQuantity || 0)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                          Thêm
                                        </button>
                                      </>
                                    )}
                                    {canManageFoods && (
                                      <button type="button" className="text-xs text-brand hover:underline font-bold ml-auto bg-transparent border-0 cursor-pointer" onClick={() => editFood(food)}>
                                        Sửa món
                                      </button>
                                    )}
                                  </div>
                                </article>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {(foodsByCategory[0] || []).length > 0 ? (
                      <div className="food-category-group">
                        <h3>Không có danh mục</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                          {(foodsByCategory[0] || []).map((food) => (
                            <article key={food.id} className={`tw-food-card bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between ${!isFoodInStock(food) ? 'opacity-60' : ''}`}>
                              <div>
                                <div
                                  className={`tw-food-photo h-[120px] relative bg-cover bg-center ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                                  style={foodPhotoStyle(food.imageUrl, food.id)}
                                >
                                  <span className="absolute left-3 bottom-3 bg-black/60 text-white rounded-full text-[10px] px-2.5 py-1 font-semibold z-10">
                                    {isFoodInStock(food) ? 'Còn' : 'Hết'}
                                  </span>
                                </div>
                                <div className="tw-food-body p-3 flex flex-col gap-1">
                                  <h3 className="font-bold text-gray-900 text-sm line-clamp-1 m-0" title={food.name}>{food.name}</h3>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className="font-extrabold text-[gray-900] text-sm">{food.price.toLocaleString('vi-VN')} đ</span>
                                    {canManageFoods && (
                                      <span className="text-[10px] text-gray-500 font-medium">Kho: {food.currentQuantity}/{food.defaultQuantity}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className="tw-quantity-row p-3 pt-0 flex flex-wrap items-center justify-between gap-2 mt-auto">
                                {canOrder && (
                                  <>
                                    {(cart[food.id] || 0) > 0 ? (
                                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                                        <button
                                          type="button"
                                          className="w-6 h-6 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center cursor-pointer text-gray-600 border border-gray-200 transition-colors"
                                          onClick={() => updateCart(food, (cart[food.id] || 0) - 1)}
                                        >
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
                                        </button>
                                        <strong className="text-xs font-bold text-gray-800 w-4 text-center">{cart[food.id]}</strong>
                                      </div>
                                    ) : <span />}
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full text-[11px] font-bold transition-all cursor-pointer border-0 shadow-sm"
                                      onClick={() => updateCart(food, (cart[food.id] || 0) + 1)}
                                      disabled={!isFoodInStock(food) || (cart[food.id] || 0) >= Number(food.currentQuantity || 0)}
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                                      Thêm
                                    </button>
                                  </>
                                )}
                                {canManageFoods && (
                                  <button type="button" className="text-xs text-brand hover:underline font-bold ml-auto bg-transparent border-0 cursor-pointer" onClick={() => editFood(food)}>
                                    Sửa món
                                  </button>
                                )}
                              </div>
                            </article>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
            </div>

            {!canManageFoods ? (
              <aside className="w-full lg:w-[360px] shrink-0 sticky top-24 relative">
                {menuError ? (
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%]">
                    <div className="bg-red-50 text-red-600 p-4 rounded-xl border-2 border-red-200 shadow-[0_10px_40px_rgba(239,68,68,0.3)] text-base font-bold text-center">
                      {menuError}
                    </div>
                  </div>
                ) : null}
                <form className="restaurant-order-panel !m-0" onSubmit={handleOrderSubmit}>
                  <div className="section-heading-row">
                    <h3>Giỏ hàng từ quán này</h3>
                    <span className="owner-note">{cartCount} món</span>
                  </div>

                  <div className="restaurant-cart-lines">
                    {cartItems.map((item) => (
                      <div key={item.food.id} className="restaurant-cart-line">
                        <span>{item.food.name}</span>
                        <strong>
                          {item.quantity} x {formatMoney(Number(item.food.price))} đ
                        </strong>
                      </div>
                    ))}
                    {cartItems.length === 0 ? <p className="empty-state">Chọn món bên dưới để đặt hàng.</p> : null}
                  </div>

                  <div className="restaurant-form-grid">
                    <div className="restaurant-field full">
                      <label htmlFor="restaurantReceiverAddress">Địa chỉ giao hàng</label>
                      <AddressAutocomplete
                        id="restaurantReceiverAddress"
                        value={checkout.receiverAddress}
                        onTextChange={updateReceiverAddress}
                        onSelect={selectDeliveryAddress}
                        isSelectionConfirmed={isDeliveryAddressConfirmed}
                        placeholder="Nhập địa chỉ giao hàng"
                        inputClassName=""
                      />
                      <div className="flex flex-col gap-2 mt-2">
                        <span className={isDeliveryAddressConfirmed ? 'address-status success !mt-0' : 'address-status !mt-0'}>
                          {isDeliveryAddressConfirmed
                            ? selectedDeliveryAddress
                              ? 'Đã chọn địa chỉ giao hàng'
                              : 'Đã chọn vị trí hiện tại'
                            : 'Vui lòng chọn một địa chỉ'}
                        </span>
                        <button type="button" className="flex items-center justify-center gap-2 border border-gray-200 rounded-lg py-2 w-full text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer bg-white mt-1" onClick={useCurrentLocation} disabled={isLocating}>
                          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                          {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
                        </button>
                      </div>
                    </div>

                    <div className="restaurant-field full">
                      <label>Khoảng cách</label>
                      <span className="address-distance">
                        {Number(checkout.distanceKm) > 0 ? `${Number(checkout.distanceKm).toFixed(2)} km` : 'Tính sau'}
                      </span>
                    </div>

                    <div className="restaurant-field full">
                      <label htmlFor="restaurantShippingType">Giao hàng</label>
                      <ShippingTypeSelect
                        id="restaurantShippingType"
                        value={checkout.shippingType}
                        compact
                        onChange={(shippingType) =>
                          setCheckout((current) => ({
                            ...current,
                            shippingType,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 mt-4 mb-4">
                    <div className="flex justify-between items-center text-sm font-medium text-gray-600">
                      <span>Tạm tính</span>
                      <span className="text-gray-900">{formatMoney(subtotal)} đ</span>
                    </div>
                    <div className="flex justify-between items-start text-sm font-medium text-gray-600">
                      <div className="flex flex-col">
                        <span>Phí giao hàng</span>
                        {Number(checkout.distanceKm) > 0 && (
                          <span className="text-[11px] text-gray-400 font-normal">Khoảng cách: {Number(checkout.distanceKm).toFixed(2)} km</span>
                        )}
                      </div>
                      <span className="text-gray-900">{formatMoney(shippingFee)} đ</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between items-center text-sm font-bold text-[#00b14f]">
                        <span>Ưu đãi</span>
                        <span>-{formatMoney(discountAmount)} đ</span>
                      </div>
                    )}
                    <div className="h-[1px] bg-gray-100 w-full my-1"></div>
                    <div className="flex justify-between items-center mt-1">
                      <span className="font-bold text-[#333]">Tổng thanh toán</span>
                      <strong className="text-2xl text-[#00b14f]">{formatMoney(totalAmount)} đ</strong>
                    </div>
                  </div>

                  <div className="restaurant-form-actions">
                    <button type="submit" className="button-primary w-full" disabled={cartItems.length === 0}>
                      Đặt hàng
                    </button>
                  </div>
                </form>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
