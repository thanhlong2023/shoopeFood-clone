import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import ImageUrlField from '../components/common/ImageUrlField'
import AddressAutocomplete from '../components/common/AddressAutocomplete'
import ShippingTypeSelect from '../components/common/ShippingTypeSelect'
import { reverseGeocodeAddress } from '../services/api/addresses'
import { createFood, getFoods, updateFood, deleteFood, type FoodPayload } from '../services/api/foods'
import { createCategory, getCategories } from '../services/api/categories'
import { createTopping, updateTopping, deleteTopping, getRestaurantToppings, assignToFood } from '../services/api/toppings'
import { foodPhotoStyle } from '../utils/foodImage'
import { restaurantCoverStyle } from '../utils/restaurantImage'
import { getCartDraft, saveCartDraft, type CartState } from '../utils/cartDraft'
import { calculateDistanceKm } from '../utils/geoUtils'
import { ErrorModal } from '../components/ErrorModal'
import { setLastOrderId } from '../utils/orderStorage'
import { saveCheckoutDraft } from '../utils/checkoutDraft'
import { ToppingModal } from '../components/common/ToppingModal'
import type { AddressDetail, Restaurant, Food, Category, CreateOrderPayload, Order, Topping } from '../types'

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
  toppingIds: number[]
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
  toppingIds: [],
}

const emptyCheckout: CheckoutState = {
  receiverAddress: '',
  receiverLat: '',
  receiverLng: '',
  distanceKm: '',
  shippingType: 'STANDARD',
}

type FoodFormErrors = Partial<Record<'name' | 'price' | 'defaultQuantity' | 'currentQuantity', string>>
type ToppingFormErrors = Partial<Record<'name' | 'price' | 'defaultQuantity' | 'currentQuantity' | 'startDate' | 'endDate', string>>

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
  const navigate = useNavigate()
  const restaurantId = Number(id)

  useDocumentTitle(`${APP_NAME} | Chi tiết nhà hàng`)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [foods, setFoods] = useState<Food[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [restaurantToppings, setRestaurantToppings] = useState<Topping[]>([])
  const [foodForm, setFoodForm] = useState<FoodFormState>(emptyFoodForm)
  const [isRestaurantLoading, setIsRestaurantLoading] = useState(true)
  const [isFoodsLoading, setIsFoodsLoading] = useState(false)
  const [isSavingFood, setIsSavingFood] = useState(false)
  const [isSavingCategory, setIsSavingCategory] = useState(false)
  const [isSavingTopping, setIsSavingTopping] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [toppingForm, setToppingForm] = useState<{ id?: number; name: string; price: string; defaultQuantity: string; currentQuantity: string; startDate: string; endDate: string }>({ name: '', price: '', defaultQuantity: '', currentQuantity: '', startDate: '', endDate: '' })
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [menuError, setMenuError] = useState<string | null>(null)
  const [foodErrors, setFoodErrors] = useState<FoodFormErrors>({})
  const [categoryNameError, setCategoryNameError] = useState<string | null>(null)
  const [toppingErrors, setToppingErrors] = useState<ToppingFormErrors>({})
  const [foodFeedback, setFoodFeedback] = useState<string | null>(null)
  const [categoryFeedback, setCategoryFeedback] = useState<string | null>(null)
  const [toppingFeedback, setToppingFeedback] = useState<string | null>(null)
  
  const [cart, setCart] = useState<CartState>(() => {
    const draft = getCartDraft()
    if (draft?.restaurantId === restaurantId && draft.cart) {
      return draft.cart
    }
    return {}
  })

  const [activeFood, setActiveFood] = useState<Food | null>(null)

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
    const [foodsData, categoriesData, toppingsData] = await Promise.all([
      getFoods({ restaurantId }),
      getCategories({ restaurantId }),
      getRestaurantToppings(restaurantId),
    ])

    setFoods(foodsData)
    setCategories(categoriesData)
    setRestaurantToppings(toppingsData)
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
      Object.entries(cart)
        .map(([key, item]) => {
          const food = foods.find((f) => f.id === item.foodId)
          if (!food) return null
          const today = new Date()
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          const validToppings = (item.toppings || []).filter(tCart => {
            const tDef = food.toppings?.find(t => t.id === tCart.id);
            if (!tDef || !tDef.isAvailable) return false;
            if (tDef.startDate && tDef.startDate > todayStr) return false;
            if (tDef.endDate && tDef.endDate < todayStr) return false;
            return true;
          })
          return {
            key,
            food,
            quantity: item.quantity,
            toppings: validToppings,
          }
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.quantity > 0),
    [cart, foods],
  )
  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => {
      let toppingTotal = 0;
      if (item.food.toppings && item.toppings.length > 0) {
        toppingTotal = item.toppings.reduce((sum, tCart) => {
          const toppingDef = item.food.toppings?.find(t => t.id === tCart.id);
          return sum + (toppingDef ? Number(toppingDef.price) * tCart.quantity : 0);
        }, 0);
      }
      return total + (Number(item.food.price || 0) + toppingTotal) * item.quantity;
    }, 0),
    [cartItems],
  )
  const distanceKm = Number(checkout.distanceKm) || 0
  const roundedDistance = Math.ceil(distanceKm * 10) / 10

  const shippingPrices = useMemo(() => {
    const hasCartItems = cartItems.length > 0
    if (!hasCartItems || distanceKm <= 0) return undefined
    const standardFee = roundedDistance <= 2 ? 16000 : 16000 + (roundedDistance - 2) * 5000
    return {
      STANDARD: standardFee,
      FAST: standardFee + 5000,
      ECO: Math.max(12000, standardFee - 4000),
    }
  }, [cartItems.length, distanceKm, roundedDistance])

  const shippingFee = shippingPrices ? shippingPrices[checkout.shippingType] : 0
  const discountAmount = 0
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

  function updateCart(food: Food, nextQuantity: number, toppings: { id: number; quantity: number }[] = [], existingKey?: string) {
    const maxQuantity = Math.max(0, Number(food.currentQuantity || 0))
    const normalizedQuantity = Math.max(0, Math.min(nextQuantity, maxQuantity))
    const itemKey = existingKey || (toppings.length > 0 ? `${food.id}-${toppings.map(t => `${t.id}x${t.quantity}`).sort().join(',')}` : String(food.id))

    setCart((current) => {
      const nextCart = { ...current }

      if (normalizedQuantity === 0) {
        delete nextCart[itemKey]
      } else {
        nextCart[itemKey] = {
          foodId: food.id,
          quantity: normalizedQuantity,
          toppings,
        }
      }

      return nextCart
    })
  }

  function handleAddFoodClick(food: Food) {
    if (food.toppings && food.toppings.length > 0) {
      setActiveFood(food)
    } else {
      const currentQuantity = Object.values(cart)
        .filter(item => item.foodId === food.id)
        .reduce((sum, item) => sum + item.quantity, 0)
      
      updateCart(food, currentQuantity + 1, [])
    }
  }

  function handleToppingModalConfirm(food: Food, quantity: number, toppings: { id: number; quantity: number }[]) {
    const itemKey = toppings.length > 0 ? `${food.id}-${toppings.map(t => `${t.id}x${t.quantity}`).sort().join(',')}` : String(food.id)
    const existingQuantity = cart[itemKey]?.quantity || 0
    updateCart(food, existingQuantity + quantity, toppings)
    setActiveFood(null)
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
      items: cartItems.map((item) => {
        const toppingNames = item.toppings
          .map(tCart => {
             const tDef = item.food.toppings?.find(t => t.id === tCart.id);
             return tDef ? `${tDef.name} x${tCart.quantity} (+${formatMoney(Number(tDef.price) * tCart.quantity)} đ)` : null;
          })
          .filter(Boolean)
          .join(', ')
        return {
          foodId: item.food.id,
          name: item.food.name,
          imageUrl: item.food.imageUrl,
          price: Number(item.food.price),
          quantity: item.quantity,
          toppings: item.toppings,
          toppingNames,
          lineTotal: (Number(item.food.price) + item.toppings.reduce((sum, tCart) => {
            const t = item.food.toppings?.find(x => x.id === tCart.id);
            return sum + (t ? Number(t.price) * tCart.quantity : 0);
          }, 0)) * item.quantity,
        }
      }),
    })

    navigate('/payment')
  }

  function editFood(food: Food) {
    setFoodFeedback(null)
    setFoodForm({
      id: food.id,
      name: food.name,
      imageUrl: food.imageUrl || '',
      categoryId: food.categoryId ? String(food.categoryId) : '',
      price: String(food.price),
      defaultQuantity: String(food.defaultQuantity),
      currentQuantity: String(food.currentQuantity),
      isAvailable: Boolean(food.isAvailable),
      toppingIds: food.toppings?.map(t => t.id) || [],
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
      setCategoryFeedback('Đã thêm danh mục mới')
      setCategoryName('')
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể lưu danh mục')
    } finally {
      setIsSavingCategory(false)
    }
  }

  async function handleToppingSubmit(event: FormEvent) {
    event.preventDefault()
    
    const trimmedName = toppingForm.name.trim()
    const parsedPrice = Number(toppingForm.price)
    const defaultQuantity = Number(toppingForm.defaultQuantity)
    const currentQuantity = toppingForm.currentQuantity === '' ? defaultQuantity : Number(toppingForm.currentQuantity)
    const startDate = toppingForm.startDate || undefined
    const endDate = toppingForm.endDate || undefined
    
    const nextErrors: ToppingFormErrors = {}

    if (!trimmedName) {
      nextErrors.name = 'Tên Topping là bắt buộc'
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
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

    const todayStr = new Date().toISOString().split('T')[0]
    if (startDate && startDate < todayStr) {
      nextErrors.startDate = 'Ngày bắt đầu không được ở trong quá khứ'
    }

    if (endDate && endDate < todayStr) {
      nextErrors.endDate = 'Ngày kết thúc không được ở trong quá khứ'
    }

    if (startDate && endDate && startDate > endDate) {
      nextErrors.endDate = 'Ngày kết thúc phải sau ngày bắt đầu'
    }

    if (Object.keys(nextErrors).length > 0) {
      setToppingErrors(nextErrors)
      return
    }

    try {
      setIsSavingTopping(true)
      setToppingErrors({})
      setFoodFeedback(null)
      setCategoryFeedback(null)
      setToppingFeedback(null)

      let savedTopping: Topping;
      if (toppingForm.id) {
        savedTopping = await updateTopping(toppingForm.id, {
          name: trimmedName,
          price: parsedPrice,
          isAvailable: true,
          defaultQuantity,
          currentQuantity,
          startDate,
          endDate,
        })
        setRestaurantToppings(prev => prev.map(t => t.id === savedTopping.id ? savedTopping : t))
        setToppingFeedback('Đã cập nhật Topping')
      } else {
        savedTopping = await createTopping(restaurantId, {
          name: trimmedName,
          price: parsedPrice,
          isAvailable: true,
          defaultQuantity,
          currentQuantity,
          startDate,
          endDate,
        })
        setRestaurantToppings(prev => [...prev, savedTopping])
        setToppingFeedback('Đã thêm Topping mới')
      }
      
      setToppingForm({ name: '', price: '', defaultQuantity: '', currentQuantity: '', startDate: '', endDate: '' })
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể lưu Topping')
    } finally {
      setIsSavingTopping(false)
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
        if (foodForm.toppingIds.length >= 0) {
          await assignToFood(foodForm.id, foodForm.toppingIds)
        }
        setFoodFeedback(`Đã cập nhật món #${foodForm.id}`)
      } else {
        const newFood = await createFood(payload)
        if (foodForm.toppingIds.length > 0 && newFood.id) {
          await assignToFood(newFood.id, foodForm.toppingIds)
        }
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

  async function handleDeleteFood() {
    if (!foodForm.id) return
    if (!window.confirm('Bạn có chắc chắn muốn xóa món ăn này? Hành động này không thể hoàn tác.')) return

    try {
      setIsSavingFood(true)
      setFoodFeedback(null)
      await deleteFood(foodForm.id)
      setFoodFeedback('Đã xóa món ăn thành công')
      setFoodForm(emptyFoodForm)
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể xóa món ăn')
    } finally {
      setIsSavingFood(false)
    }
  }

  async function handleDeleteTopping() {
    if (!toppingForm.id) return
    if (!window.confirm('Bạn có chắc chắn muốn xóa Topping này? Hành động này không thể hoàn tác.')) return

    try {
      setIsSavingTopping(true)
      setToppingFeedback(null)
      await deleteTopping(toppingForm.id)
      setToppingFeedback('Đã xóa Topping thành công')
      setToppingForm({ name: '', price: '', defaultQuantity: '', currentQuantity: '', startDate: '', endDate: '' })
      await loadMenu()
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : 'Không thể xóa Topping')
    } finally {
      setIsSavingTopping(false)
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
      <ErrorModal isOpen={!!menuError} message={menuError || ''} onClose={() => setMenuError(null)} />
      <ToppingModal
        isOpen={activeFood !== null}
        food={activeFood}
        onClose={() => setActiveFood(null)}
        onConfirm={handleToppingModalConfirm}
      />
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
            <div className="category-owner-panel mb-6 bg-blue-50/30 border-blue-100">
              <div className="section-heading-row">
                <h3>Quản lý Topping</h3>
              </div>

              {restaurantToppings.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {restaurantToppings.map((topping) => (
                    <button
                      key={topping.id} 
                      type="button"
                      onClick={() => {
                        setToppingForm({ 
                          id: topping.id, 
                          name: topping.name, 
                          price: String(topping.price), 
                          defaultQuantity: String(topping.defaultQuantity || 0),
                          currentQuantity: String(topping.currentQuantity || 0),
                          startDate: topping.startDate || '',
                          endDate: topping.endDate || ''
                        });
                        setToppingErrors({});
                        setToppingFeedback(null);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 shadow-sm cursor-pointer transition-colors"
                    >
                      <span className="font-medium">{topping.name}</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-brand font-bold">+{topping.price.toLocaleString('vi-VN')}đ</span>
                      <span className="text-gray-400">|</span>
                      <span className="text-xs text-gray-500 font-bold">Kho: {topping.currentQuantity}/{topping.defaultQuantity}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="empty-state">Chưa có Topping. Thêm Topping trước khi áp dụng cho món ăn.</p>
              )}

              <form className="category-owner-form" noValidate onSubmit={handleToppingSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="restaurant-field">
                    <label htmlFor="toppingName">{toppingForm.id ? 'Cập nhật tên Topping' : 'Tên Topping mới'}</label>
                    <input
                      id="toppingName"
                      value={toppingForm.name}
                      onChange={(event) => {
                        setToppingForm(prev => ({ ...prev, name: event.target.value }))
                        setToppingErrors(prev => ({ ...prev, name: undefined }))
                      }}
                      placeholder="Ví dụ: Trân châu, Trứng thêm"
                    />
                    {toppingErrors.name ? <p className="field-error">{toppingErrors.name}</p> : null}
                  </div>
                  <div className="restaurant-field">
                    <label htmlFor="toppingPrice">Giá Topping (VNĐ)</label>
                    <input
                      id="toppingPrice"
                      type="number"
                      step="1000"
                      value={toppingForm.price}
                      onChange={(event) => setToppingForm(prev => ({ ...prev, price: event.target.value }))}
                      placeholder="Ví dụ: 5000"
                    />
                    {toppingErrors.price ? <p className="field-error">{toppingErrors.price}</p> : null}
                  </div>
                  <div className="restaurant-field">
                    <label htmlFor="toppingQty">Tồn kho ban đầu</label>
                    <input
                      id="toppingQty"
                      type="number"
                      value={toppingForm.defaultQuantity}
                      onChange={(event) => setToppingForm(prev => ({ ...prev, defaultQuantity: event.target.value }))}
                      placeholder="Ví dụ: 100"
                    />
                    {toppingErrors.defaultQuantity ? <p className="field-error">{toppingErrors.defaultQuantity}</p> : null}
                  </div>
                  <div className="restaurant-field">
                    <label htmlFor="toppingCurrentQty">Số lượng hiện có</label>
                    <input
                      id="toppingCurrentQty"
                      type="number"
                      value={toppingForm.currentQuantity}
                      onChange={(event) => setToppingForm(prev => ({ ...prev, currentQuantity: event.target.value }))}
                      placeholder="Số lượng thực tế còn"
                    />
                    {toppingErrors.currentQuantity ? <p className="field-error">{toppingErrors.currentQuantity}</p> : null}
                  </div>
                  <div className="restaurant-field">
                    <label htmlFor="toppingStartDate">Ngày bắt đầu</label>
                    <input
                      id="toppingStartDate"
                      type="date"
                      value={toppingForm.startDate}
                      onChange={(event) => setToppingForm(prev => ({ ...prev, startDate: event.target.value }))}
                    />
                    {toppingErrors.startDate ? <p className="field-error">{toppingErrors.startDate}</p> : null}
                  </div>
                  <div className="restaurant-field">
                    <label htmlFor="toppingEndDate">Ngày kết thúc</label>
                    <input
                      id="toppingEndDate"
                      type="date"
                      value={toppingForm.endDate}
                      onChange={(event) => setToppingForm(prev => ({ ...prev, endDate: event.target.value }))}
                    />
                    {toppingErrors.endDate ? <p className="field-error">{toppingErrors.endDate}</p> : null}
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="submit" className="button-secondary flex-1" disabled={isSavingTopping}>
                    {isSavingTopping ? 'Đang lưu...' : (toppingForm.id ? 'Cập nhật Topping' : 'Thêm Topping')}
                  </button>
                  {toppingForm.id && (
                    <>
                      <button 
                        type="button" 
                        className="button-outline text-red-600 border-red-200 hover:bg-red-50"
                        onClick={handleDeleteTopping}
                        disabled={isSavingTopping}
                      >
                        Xóa
                      </button>
                      <button 
                        type="button" 
                        className="button-outline"
                        onClick={() => {
                          setToppingForm({ name: '', price: '', defaultQuantity: '', currentQuantity: '', startDate: '', endDate: '' });
                          setToppingErrors({});
                          setToppingFeedback(null);
                        }}
                      >
                        Hủy
                      </button>
                    </>
                  )}
                </div>
                {Object.keys(toppingErrors).length > 0 ? <p className="field-error mt-2">Vui lòng kiểm tra lại thông tin</p> : null}
                {toppingFeedback ? <p className="field-success mt-2">{toppingFeedback}</p> : null}
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

              {restaurantToppings.length > 0 && (
                <div className="mt-6 mb-2">
                  <label className="block text-sm font-bold text-gray-700 mb-3">Chọn Topping áp dụng cho món này:</label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {restaurantToppings.map(topping => {
                      const isSelected = foodForm.toppingIds.includes(topping.id)
                      return (
                        <label key={topping.id} className={`flex items-center gap-2 p-2 border rounded-md cursor-pointer transition-colors ${isSelected ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-brand/50'}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const checked = e.target.checked
                              setFoodForm(prev => ({
                                ...prev,
                                toppingIds: checked 
                                  ? [...prev.toppingIds, topping.id]
                                  : prev.toppingIds.filter(id => id !== topping.id)
                              }))
                            }}
                            className="w-4 h-4 text-brand rounded border-gray-300 focus:ring-brand"
                          />
                          <span className="text-sm font-medium text-gray-700">{topping.name} (+{topping.price.toLocaleString()}đ)</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mb-4 mt-6">
                {foodForm.id && (
                  <div className="flex gap-2">
                    <button type="button" className="button-secondary" onClick={resetFoodForm}>
                      Hủy sửa
                    </button>
                    <button
                      type="button"
                      className="button-outline text-red-600 border-red-200 hover:bg-red-50"
                      onClick={handleDeleteFood}
                      disabled={isSavingFood}
                    >
                      Xóa món
                    </button>
                  </div>
                )}
                <button type="submit" className="button-primary ml-auto" disabled={isSavingFood || categories.length === 0}>
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
                                        {isFoodInStock(food) ? `Còn ${food.currentQuantity || 0}` : 'Hết'}
                                      </span>
                                    </div>
                                    <div className="tw-food-body p-3 flex flex-col gap-1">
                                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1 m-0" title={food.name}>{food.name}</h3>
                                      <div className="flex justify-between items-center mt-1">
                                        <span className="font-extrabold text-[gray-900] text-sm">{food.price.toLocaleString('vi-VN')} đ</span>
                                        {canManageFoods ? (
                                          <span className="text-[10px] text-gray-500 font-medium">Kho: {food.currentQuantity}/{food.defaultQuantity}</span>
                                        ) : (
                                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${!isFoodInStock(food) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                            {!isFoodInStock(food) ? 'Hết món' : `Còn ${food.currentQuantity || 0}`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="tw-quantity-row p-3 pt-0 flex flex-wrap items-center justify-between gap-2 mt-auto">
                                    {canOrder && (
                                      <>
                                        {Object.values(cart).filter(c => c.foodId === food.id).length > 0 ? (
                                          <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                                            <strong className="text-xs font-bold text-gray-800 text-center px-2">
                                              {Object.values(cart).filter(c => c.foodId === food.id).reduce((sum, c) => sum + c.quantity, 0)} trong giỏ
                                            </strong>
                                          </div>
                                        ) : <span />}
                                        <button
                                          type="button"
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full text-[11px] font-bold transition-all cursor-pointer border-0 shadow-sm"
                                          onClick={() => handleAddFoodClick(food)}
                                          disabled={!isFoodInStock(food)}
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
                                    {Object.values(cart).filter(c => c.foodId === food.id).length > 0 ? (
                                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                                        <strong className="text-xs font-bold text-gray-800 text-center px-2">
                                          {Object.values(cart).filter(c => c.foodId === food.id).reduce((sum, c) => sum + c.quantity, 0)} trong giỏ
                                        </strong>
                                      </div>
                                    ) : <span />}
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full text-[11px] font-bold transition-all cursor-pointer border-0 shadow-sm"
                                      onClick={() => handleAddFoodClick(food)}
                                      disabled={!isFoodInStock(food)}
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
                    {cartItems.map((item) => {
                      const toppingNames = item.toppings
                        .map(tCart => {
                           const tDef = item.food.toppings?.find(t => t.id === tCart.id);
                           return tDef ? `${tDef.name} x${tCart.quantity} (+${formatMoney(Number(tDef.price) * tCart.quantity)} đ)` : null;
                        })
                        .filter(Boolean)
                        .join(', ')

                      let toppingTotal = 0;
                      if (item.food.toppings && item.toppings.length > 0) {
                        toppingTotal = item.toppings.reduce((sum, tCart) => {
                          const tDef = item.food.toppings?.find(x => x.id === tCart.id);
                          return sum + (tDef ? Number(tDef.price) * tCart.quantity : 0);
                        }, 0);
                      }

                      return (
                        <div key={item.key} className="restaurant-cart-line flex justify-between items-start mb-2 group">
                          <div className="flex items-start gap-2 max-w-[70%]">
                            <div className="flex items-center gap-1 mt-0.5 shrink-0 bg-gray-50 rounded-full px-1 border border-gray-100">
                              <button
                                type="button"
                                className="w-5 h-5 rounded-full bg-white hover:bg-gray-200 text-gray-600 border-0 cursor-pointer flex items-center justify-center transition-colors shadow-sm"
                                onClick={() => updateCart(item.food, item.quantity - 1, item.toppings, item.key)}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M20 12H4" /></svg>
                              </button>
                              <span className="text-xs font-bold w-4 text-center select-none">{item.quantity}</span>
                              <button
                                type="button"
                                className="w-5 h-5 rounded-full bg-brand hover:bg-brand-dark text-white border-0 cursor-pointer flex items-center justify-center transition-colors shadow-sm disabled:opacity-50"
                                onClick={() => updateCart(item.food, item.quantity + 1, item.toppings, item.key)}
                                disabled={item.quantity >= Number(item.food.currentQuantity || 0)}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                              </button>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 leading-snug">{item.food.name}</span>
                              {toppingNames && <span className="text-xs text-gray-500">{toppingNames}</span>}
                            </div>
                          </div>
                          <strong className="text-sm">
                            {formatMoney((Number(item.food.price) + toppingTotal) * item.quantity)} đ
                          </strong>
                        </div>
                      )
                    })}
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
                        prices={shippingPrices}
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
