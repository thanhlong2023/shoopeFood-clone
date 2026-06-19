import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import { createOrder } from '../services/api/orders'
import ImageUrlField from '../components/common/ImageUrlField'
import AddressAutocomplete from '../components/common/AddressAutocomplete'
import { createFood, getFoods, updateFood, type FoodPayload } from '../services/api/foods'
import { createCategory, getCategories } from '../services/api/categories'
import { foodPhotoStyle } from '../utils/foodImage'
import { restaurantCoverStyle } from '../utils/restaurantImage'
import { getCartDraft, saveCartDraft } from '../utils/cartDraft'
import { setLastOrderId } from '../utils/orderStorage'
import type { AddressDetail, Restaurant, Food, Category, CreateOrderPayload, Order } from '../types'

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
        pathOptions={{ color: '#007a3d', fillColor: 'brand', fillOpacity: 0.85, weight: 3 }}
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
  const { user, isAuthenticated } = useAuth()
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
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false)
  const [orderFeedback, setOrderFeedback] = useState<Order | null>(null)

  const isAdmin = user?.role === 'ADMIN'
  const isMerchantOwner = Boolean(
    restaurant && user && user.role === 'MERCHANT' && restaurant.ownerId === user.id,
  )
  const backPath = isMerchantOwner ? '/merchant/menu' : isAdmin ? '/admin?tab=restaurants' : '/'
  const backLabel = isMerchantOwner ? 'Quay lai thuc don' : isAdmin ? 'Quay lai quan ly' : 'Quay lai dat mon'
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
    const receiverLat = Number(checkout.receiverLat)
    const receiverLng = Number(checkout.receiverLng)

    if (
      !restaurant ||
      !Number.isFinite(receiverLat) ||
      !Number.isFinite(receiverLng) ||
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
    setOrderFeedback(null)
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
    const receiverLat = Number(address.latitude)
    const receiverLng = Number(address.longitude)
    const hasValidCoordinates = isValidCoordinate(receiverLat, receiverLng)
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
    setMenuError(hasValidCoordinates ? null : 'Dia chi da chon chua co toa do hop le')
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMenuError('Trinh duyet khong ho tro lay vi tri')
      return
    }

    setIsLocating(true)
    setMenuError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const receiverLat = position.coords.latitude
        const receiverLng = position.coords.longitude
        const nextDistance = restaurant
          ? calculateDistanceKm(restaurant.latitude, restaurant.longitude, receiverLat, receiverLng)
          : Number(checkout.distanceKm)

        setCheckout((current) => ({
          ...current,
          receiverAddress: 'Vi tri hien tai da chon',
          receiverLat: receiverLat.toFixed(6),
          receiverLng: receiverLng.toFixed(6),
          distanceKm: Number.isFinite(nextDistance) ? nextDistance.toFixed(2) : current.distanceKm,
        }))
        setSelectedDeliveryAddress(null)
        setIsDeliveryAddressConfirmed(true)
        setIsLocating(false)
      },
      (error) => {
        setMenuError(error.message || 'Khong the lay vi tri hien tai')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function validateOrder() {
    if (!restaurant) return 'Khong tim thay nha hang'
    if (!canOrder) return 'Nhà hàng hien chua nhan don'
    if (!isAuthenticated || user?.role !== 'CUSTOMER') return 'Vui long dang nhap tai khoan khach hang de dat mon'
    if (cartItems.length === 0) return 'Gio hang dang trong'
    if (!checkout.receiverAddress.trim()) return 'Vui long nhap dia chi giao hang'
    if (!isDeliveryAddressConfirmed) return 'Vui long chon dia chi giao hang tu danh sach goi y'
    if (!isValidCoordinate(Number(checkout.receiverLat), Number(checkout.receiverLng))) {
      return 'Toa do giao hang khong hop le'
    }
    if (!Number.isFinite(Number(checkout.distanceKm)) || Number(checkout.distanceKm) <= 0) {
      return 'Khoang cach giao hang khong hop le'
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

    try {
      setIsSubmittingOrder(true)
      setMenuError(null)
      setOrderFeedback(null)

      const createdOrder = await createOrder({
        restaurantId: restaurant.id,
        receiverAddress: checkout.receiverAddress.trim(),
        receiverLat: Number(checkout.receiverLat),
        receiverLng: Number(checkout.receiverLng),
        distanceKm: Number(checkout.distanceKm),
        shippingType: checkout.shippingType,
        discountAmount,
        taxAmount: 0,
        idempotencyKey: `RESTAURANT-${restaurant.id}-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`,
        items: cartItems.map((item) => ({
          foodId: item.food.id,
          quantity: item.quantity,
        })),
      })

      setOrderFeedback(createdOrder)
      setLastOrderId(createdOrder.id)
      setCart({})
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Khong the tao don hang')
    } finally {
      setIsSubmittingOrder(false)
    }
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
          {orderFeedback ? (
            <p className="restaurant-feedback success">
              Da dat don {orderFeedback.orderCode}. <Link to={`/tracking?orderId=${orderFeedback.id}`}>Theo doi don</Link>
            </p>
          ) : null}

          {!canManageFoods ? (
            <form className="restaurant-order-panel" onSubmit={handleOrderSubmit}>
              <div className="section-heading-row">
                <h3>Giỏ hàng từ quán này</h3>
                <span className="owner-note">{cartCount} món</span>
              </div>

              <div className="restaurant-cart-lines">
                {cartItems.map((item) => (
                  <div key={item.food.id} className="restaurant-cart-line">
                    <span>{item.food.name}</span>
                    <strong>
                      {item.quantity} x {formatMoney(Number(item.food.price))} d
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
                  <span className={isDeliveryAddressConfirmed ? 'address-status success' : 'address-status'}>
                    {isDeliveryAddressConfirmed
                      ? selectedDeliveryAddress
                        ? 'Đã chọn địa chỉ giao hàng'
                        : 'Đã chọn vị trí hiện tại'
                      : 'Vui lòng chọn một địa chỉ trong danh sách gợi ý'}
                  </span>
                </div>

                <div className="restaurant-field">
                  <label>Khoảng cách</label>
                  <span className="address-distance">
                    {Number(checkout.distanceKm) > 0 ? `${Number(checkout.distanceKm).toFixed(2)} km` : 'Tính sau khi chọn địa chỉ'}
                  </span>
                </div>

                <div className="restaurant-field">
                  <label htmlFor="restaurantShippingType">Giao hàng</label>
                  <select
                    id="restaurantShippingType"
                    value={checkout.shippingType}
                    onChange={(event) =>
                      setCheckout((current) => ({
                        ...current,
                        shippingType: event.target.value as CheckoutState['shippingType'],
                      }))
                    }
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="FAST">Fast</option>
                    <option value="ECO">Eco</option>
                  </select>
                </div>
              </div>

              <div className="restaurant-order-summary">
                <span>Tạm tính: {formatMoney(subtotal)} d</span>
                <span>Ship: {formatMoney(shippingFee)} d</span>
                <span>Ưu đãi: -{formatMoney(discountAmount)} d</span>
                <strong>Tổng: {formatMoney(totalAmount)} d</strong>
              </div>

              <div className="restaurant-form-actions">
                <button type="button" className="button-secondary" onClick={useCurrentLocation} disabled={isLocating}>
                  {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
                </button>
                <button type="submit" className="button-primary" disabled={isSubmittingOrder || cartItems.length === 0}>
                  {isSubmittingOrder ? 'Đang đặt hàng...' : 'Đặt hàng'}
                </button>
              </div>
            </form>
          ) : null}

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
                      <div className="food-grid">
                        {categoryFoods.map((food) => (
                          <div key={food.id} className="restaurant-food-card">
                            <div
                              className={`food-card-photo ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                              style={foodPhotoStyle(food.imageUrl, food.id)}
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

                            {canOrder ? (
                              <div className="restaurant-order-actions">
                                {(cart[food.id] || 0) > 0 ? (
                                  <button type="button" className="button-secondary" onClick={() => updateCart(food, (cart[food.id] || 0) - 1)}>
                                    -
                                  </button>
                                ) : null}
                                {(cart[food.id] || 0) > 0 ? <strong>{cart[food.id]}</strong> : null}
                                <button
                                  type="button"
                                  className="button-primary"
                                  onClick={() => updateCart(food, (cart[food.id] || 0) + 1)}
                                  disabled={!isFoodInStock(food) || (cart[food.id] || 0) >= Number(food.currentQuantity || 0)}
                                >
                                  Thêm
                                </button>
                              </div>
                            ) : null}

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
                          className={`food-card-photo ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                          style={foodPhotoStyle(food.imageUrl, food.id)}
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
                        {canOrder ? (
                          <div className="restaurant-order-actions">
                            {(cart[food.id] || 0) > 0 ? (
                              <button type="button" className="button-secondary" onClick={() => updateCart(food, (cart[food.id] || 0) - 1)}>
                                -
                              </button>
                            ) : null}
                            {(cart[food.id] || 0) > 0 ? <strong>{cart[food.id]}</strong> : null}
                            <button
                              type="button"
                              className="button-primary"
                              onClick={() => updateCart(food, (cart[food.id] || 0) + 1)}
                              disabled={!isFoodInStock(food) || (cart[food.id] || 0) >= Number(food.currentQuantity || 0)}
                            >
                              Thêm
                            </button>
                          </div>
                        ) : null}

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
