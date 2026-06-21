import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTrackableOrder } from '../hooks/useTrackableOrder'
import AddressAutocomplete from '../components/common/AddressAutocomplete'
import ShippingTypeSelect from '../components/common/ShippingTypeSelect'
import { reverseGeocodeAddress } from '../services/api/addresses'
import { getCategories } from '../services/api/categories'
import { getFoods } from '../services/api/foods'
import { getRestaurants } from '../services/api/restaurants'
import { foodPhotoStyle } from '../utils/foodImage'
import { saveCheckoutDraft, getCheckoutDraft } from '../utils/checkoutDraft'
import { getCartDraft, saveCartDraft } from '../utils/cartDraft'
import { restaurantCoverStyle, restaurantThumbStyle } from '../utils/restaurantImage'
import type { AddressDetail, Category, CreateOrderPayload, Food, Order, Restaurant } from '../types'

import { ToppingModal } from '../components/common/ToppingModal'
import type { CartState } from '../utils/cartDraft'

type CheckoutState = {
  receiverAddress: string
  receiverLat: string
  receiverLng: string
  distanceKm: string
  shippingType: NonNullable<CreateOrderPayload['shippingType']>
}

type DeliveryLocationSource = 'default' | 'current' | 'address'

type DeliveryPoint = {
  latitude: number
  longitude: number
}

type IconName = 'search' | 'location' | 'cart' | 'plus' | 'minus' | 'trash' | 'store' | 'clock' | 'star' | 'receipt' | 'check'

const quickFilters = ['Cơm trưa', 'Bún phở', 'Đồ uống', 'Ăn vặt', 'Chay', 'Giảm giá']
const initialCheckoutState: CheckoutState = {
  receiverAddress: '',
  receiverLat: '',
  receiverLng: '',
  distanceKm: '',
  shippingType: 'STANDARD',
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    search: 'M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z',
    location: 'M12 21s7-5.2 7-11a7 7 0 10-14 0c0 5.8 7 11 7 11z M12 10.5h.01',
    cart: 'M6 6h15l-1.6 8.2a2 2 0 01-2 1.6H9.2a2 2 0 01-2-1.6L6 6z M6 6L5.3 3H3 M9 20h.01 M18 20h.01',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 14h10l1-14 M9 7V4h6v3',
    store: 'M4 10h16l-1-5H5l-1 5z M6 10v10h12V10 M9 20v-6h6v6',
    clock: 'M12 6v6l4 2 M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    star: 'M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1-4.4-4.3 6.1-.9L12 3z',
    receipt: 'M7 3h10v18l-2-1-2 1-2-1-2 1-2-1V3z M9 8h6 M9 12h6 M9 16h4',
    check: 'M5 13l4 4L19 7',
  }

  return (
    <svg className="icon w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  )
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫'
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

function getRestaurantDistanceKm(restaurant: Restaurant, deliveryPoint: DeliveryPoint | null) {
  if (
    !deliveryPoint ||
    !isValidCoordinate(deliveryPoint.latitude, deliveryPoint.longitude) ||
    !isValidCoordinate(Number(restaurant.latitude), Number(restaurant.longitude))
  ) {
    return null
  }

  return calculateDistanceKm(deliveryPoint.latitude, deliveryPoint.longitude, restaurant.latitude, restaurant.longitude)
}

function formatDistanceKm(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return ''
  }

  return value < 1 ? `${Math.round(value * 1000)} m` : `${value.toFixed(1)} km`
}

function toEtaFromDistance(distanceKm: number | null, restaurantId: number) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return toEta(restaurantId)
  }

  const baseMinute = Math.max(12, Math.round(10 + distanceKm * 4))
  return `${baseMinute}-${baseMinute + 7} phút`
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function toEta(restaurantId: number) {
  const baseMinute = 18 + (restaurantId % 4) * 3
  return `${baseMinute}-${baseMinute + 7} phút`
}

function toCuisine(categories: Category[], restaurantId: number) {
  const names = categories.filter((item) => item.restaurantId === restaurantId).map((item) => item.name)
  return names.slice(0, 2).join(' · ') || 'Món ngon mỗi ngày'
}

function toPromotion(restaurantId: number) {
  const promotions = ['Giảm 20% đến 40k', 'Freeship 3km', 'Combo trưa tiết kiệm', 'Tặng món từ 99k']
  return promotions[restaurantId % promotions.length]
}

function getPromotionBadges(restaurant: Restaurant) {
  const badges = []
  if (restaurant.id % 2 === 0) badges.push('Freeship')
  if (restaurant.ratingAvg >= 4.8) badges.push('Giảm 20%')
  if (restaurant.id % 3 === 0) badges.push('Combo trưa')
  if (restaurant.id >= 6) badges.push('Quán mới')
  return badges.slice(0, 3)
}

function getDailySeed() {
  const today = new Date()
  return Number(`${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`)
}

export default function HomePage() {
  useDocumentTitle(`${APP_NAME} | Đặt món`)
  const { isAuthenticated, user } = useAuth()
  const { hasTrackableOrder, lastOrderId } = useTrackableOrder()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [activeFood, setActiveFood] = useState<Food | null>(null)
  const [activeRestaurantId, setActiveRestaurantId] = useState<number | null>(() => {
    const draft = getCartDraft()
    return draft?.restaurantId || null
  })
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all')
  const [cart, setCart] = useState<CartState>(() => {
    const draft = getCartDraft()
    return draft?.cart || {}
  })

  useEffect(() => {
    saveCartDraft({ restaurantId: activeRestaurantId, cart })
  }, [activeRestaurantId, cart])

  const [checkout, setCheckout] = useState<CheckoutState>(() => {
    const draft = getCheckoutDraft()
    if (draft) {
      return {
        receiverAddress: draft.receiver.address,
        receiverLat: String(draft.receiver.lat),
        receiverLng: String(draft.receiver.lng),
        distanceKm: String(draft.receiver.distanceKm),
        shippingType: draft.shippingType,
      }
    }
    return initialCheckoutState
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isLocating, setIsLocating] = useState(false)
  const [deliveryLocationSource, setDeliveryLocationSource] = useState<DeliveryLocationSource>(() => getCheckoutDraft() ? 'address' : 'default')
  const [isDeliveryAddressConfirmed, setIsDeliveryAddressConfirmed] = useState(() => !!getCheckoutDraft())
  const [selectedDeliveryAddress, setSelectedDeliveryAddress] = useState<AddressDetail | null>(null)
  const [shouldFollowDeliveryLocation, setShouldFollowDeliveryLocation] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successOrder, setSuccessOrder] = useState<Order | null>(null)

  // Search term synced with URL
  const searchTerm = searchParams.get('q') || ''
  const setSearchTerm = (val: string) => {
    setSearchParams((prev) => {
      if (!val) {
        prev.delete('q')
      } else {
        prev.set('q', val)
      }
      return prev
    })
  }

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const [restaurantData, categoryData, foodData] = await Promise.all([getRestaurants(), getCategories(), getFoods()])

        if (!ignore) {
          setRestaurants(restaurantData)
          setCategories(categoryData)
          setFoods(foodData)
          setActiveRestaurantId((current) => current ?? restaurantData[0]?.id ?? null)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể kết nối API')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      ignore = true
    }
  }, [])

  const categoryNameById = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])
  const restaurantIdByCategoryId = useMemo(
    () => new Map(categories.map((category) => [category.id, category.restaurantId])),
    [categories],
  )
  const restaurantById = useMemo(() => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])), [restaurants])
  const normalizedSearch = normalizeSearchText(searchTerm)
  const restaurantSearchMatches = useMemo(() => {
    if (!normalizedSearch) {
      return new Set(restaurants.map((restaurant) => restaurant.id))
    }

    const matchingRestaurantIds = new Set<number>()

    restaurants.forEach((restaurant) => {
      const restaurantCategories = categories.filter((category) => category.restaurantId === restaurant.id)
      const categoryIds = new Set(restaurantCategories.map((category) => category.id))
      const restaurantFoods = foods.filter((food) => food.categoryId !== null && categoryIds.has(food.categoryId))
      const searchableValues = [
        restaurant.name,
        restaurant.address,
        toCuisine(categories, restaurant.id),
        toPromotion(restaurant.id),
        ...restaurantCategories.map((category) => category.name),
        ...restaurantFoods.map((food) => food.name),
      ]

      if (searchableValues.some((value) => normalizeSearchText(value || '').includes(normalizedSearch))) {
        matchingRestaurantIds.add(restaurant.id)
      }
    })

    return matchingRestaurantIds
  }, [categories, foods, normalizedSearch, restaurants])
  const visibleRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurantSearchMatches.has(restaurant.id)),
    [restaurantSearchMatches, restaurants],
  )
  const deliveryPoint = useMemo(() => {
    const latitude = toNullableCoordinate(checkout.receiverLat)
    const longitude = toNullableCoordinate(checkout.receiverLng)

    return latitude !== null && longitude !== null && isValidCoordinate(latitude, longitude) ? { latitude, longitude } : null
  }, [checkout.receiverLat, checkout.receiverLng])
  const rankedRestaurants = useMemo(
    () =>
      visibleRestaurants
        .map((restaurant) => ({
          restaurant,
          distanceKm: getRestaurantDistanceKm(restaurant, deliveryPoint),
        }))
        .sort((left, right) => {
          const leftClosed = left.restaurant.isOpen && left.restaurant.isOpenToday ? 0 : 1
          const rightClosed = right.restaurant.isOpen && right.restaurant.isOpenToday ? 0 : 1
          if (leftClosed !== rightClosed) return leftClosed - rightClosed

          const leftDistance = left.distanceKm ?? Number.POSITIVE_INFINITY
          const rightDistance = right.distanceKm ?? Number.POSITIVE_INFINITY
          if (leftDistance !== rightDistance) return leftDistance - rightDistance

          return right.restaurant.ratingAvg - left.restaurant.ratingAvg
        }),
    [deliveryPoint, visibleRestaurants],
  )
  const previewRestaurants = useMemo(() => rankedRestaurants.slice(0, 6), [rankedRestaurants])
  const hasCartQuantities = useMemo(() => Object.values(cart).some((item) => item.quantity > 0), [cart])
  const featuredRestaurants = useMemo(
    () =>
      restaurants
        .filter((restaurant) => restaurant.isOpen && restaurant.isOpenToday)
        .sort((left, right) => right.ratingAvg - left.ratingAvg)
        .slice(0, 3),
    [restaurants],
  )
  const activeRestaurant = useMemo(
    () => restaurants.find((restaurant) => restaurant.id === activeRestaurantId) ?? restaurants[0] ?? null,
    [activeRestaurantId, restaurants],
  )

  const activeCategories = useMemo(() => {
    if (!activeRestaurant) {
      return []
    }

    return categories.filter((category) => category.restaurantId === activeRestaurant.id)
  }, [activeRestaurant, categories])

  const activeCategoryIds = useMemo(() => new Set(activeCategories.map((category) => category.id)), [activeCategories])

  const menuFoods = useMemo(() => {
    if (!activeRestaurant) {
      return []
    }

    return foods.filter((food) => food.categoryId !== null && activeCategoryIds.has(food.categoryId))
  }, [activeCategoryIds, activeRestaurant, foods])

  const visibleFoods = useMemo(() => {
    const restaurantMatchesSearch = activeRestaurant ? restaurantSearchMatches.has(activeRestaurant.id) : false
    const restaurantDirectlyMatches =
      Boolean(activeRestaurant) &&
      [activeRestaurant?.name, activeRestaurant?.address, activeRestaurant ? toPromotion(activeRestaurant.id) : ''].some((value) =>
        normalizeSearchText(value || '').includes(normalizedSearch),
      )

    return menuFoods.filter((food) => {
      const matchesCategory = activeCategoryId === 'all' || food.categoryId === activeCategoryId
      const categoryName = categoryNameById.get(food.categoryId ?? 0) || ''
      const matchesSearch =
        !normalizedSearch ||
        restaurantDirectlyMatches ||
        normalizeSearchText(food.name).includes(normalizedSearch) ||
        normalizeSearchText(categoryName).includes(normalizedSearch)

      if (normalizedSearch && !restaurantMatchesSearch) {
        return false
      }

      return matchesCategory && matchesSearch
    })
  }, [activeCategoryId, activeRestaurant, categoryNameById, menuFoods, normalizedSearch, restaurantSearchMatches])

  const todaysFoods = useMemo(
    () =>
      foods
        .filter((food) => food.isAvailable && Number(food.currentQuantity || 0) > 0 && food.categoryId !== null)
        .sort((left, right) => ((left.id * 17 + getDailySeed()) % 31) - ((right.id * 17 + getDailySeed()) % 31))
        .slice(0, 8),
    [foods],
  )

  function selectFoodRestaurant(food: Food) {
    const restaurantId = restaurantIdByCategoryId.get(food.categoryId ?? 0)
    if (!restaurantId) return

    setActiveRestaurantId(restaurantId)
    setActiveCategoryId(food.categoryId ?? 'all')
    setSearchTerm('')
    setSuccessOrder(null)
    setShouldFollowDeliveryLocation(false)
  }

  const cartItems = useMemo(
    () =>
      Object.entries(cart)
        .map(([key, item]) => {
          const food = menuFoods.find(f => f.id === item.foodId)
          if (!food) return null
          const today = new Date()
          const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
          const validToppings = item.toppings.filter(tCart => {
            const tDef = food.toppings?.find(t => t.id === tCart.id);
            if (!tDef || !tDef.isAvailable) return false;
            if (tDef.startDate && tDef.startDate > todayStr) return false;
            if (tDef.endDate && tDef.endDate < todayStr) return false;
            return true;
          })
          return { key, food, quantity: item.quantity, toppings: validToppings }
        })
        .filter(Boolean) as { key: string; food: Food; quantity: number; toppings: { id: number; quantity: number }[] }[],
    [cart, menuFoods],
  )

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => {
      let toppingTotal = 0;
      if (item.food.toppings && item.toppings.length > 0) {
        toppingTotal = item.toppings.reduce((sum, tCart) => {
          const tDef = item.food.toppings?.find(x => x.id === tCart.id);
          return sum + (tDef ? Number(tDef.price) * tCart.quantity : 0);
        }, 0);
      }
      return total + (Number(item.food.price) + toppingTotal) * item.quantity;
    }, 0),
    [cartItems],
  )
  const distanceKm = Number(checkout.distanceKm) || 0
  const hasCartItems = cartItems.length > 0
  
  const roundedDistance = Math.ceil(distanceKm * 10) / 10
  const shippingPrices = useMemo(() => {
    if (!hasCartItems || distanceKm <= 0) return undefined
    const standardFee = roundedDistance <= 2 ? 16000 : 16000 + (roundedDistance - 2) * 5000
    return {
      STANDARD: standardFee,
      FAST: standardFee + 5000,
      ECO: Math.max(12000, standardFee - 4000),
    }
  }, [hasCartItems, distanceKm, roundedDistance])

  const shippingFee = shippingPrices ? shippingPrices[checkout.shippingType] : 0

  const discountAmount = 0
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount)
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  // Dispatch custom event to sync with Navbar Cart badge
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: cartCount } }))
  }, [cartCount])

  useEffect(() => {
    const receiverLat = toNullableCoordinate(checkout.receiverLat)
    const receiverLng = toNullableCoordinate(checkout.receiverLng)

    if (
      !activeRestaurant ||
      receiverLat === null ||
      receiverLng === null ||
      !Number.isFinite(Number(activeRestaurant.latitude)) ||
      !Number.isFinite(Number(activeRestaurant.longitude))
    ) {
      return
    }

    const nextDistance = calculateDistanceKm(activeRestaurant.latitude, activeRestaurant.longitude, receiverLat, receiverLng)
    setCheckout((current) => ({ ...current, distanceKm: nextDistance.toFixed(2) }))
  }, [activeRestaurant, checkout.receiverLat, checkout.receiverLng])

  useEffect(() => {
    if (!shouldFollowDeliveryLocation || hasCartQuantities) {
      return
    }

    const nearestRestaurantId = rankedRestaurants[0]?.restaurant.id
    if (!nearestRestaurantId) {
      return
    }

    setActiveRestaurantId((current) => (current === nearestRestaurantId ? current : nearestRestaurantId))
  }, [hasCartQuantities, rankedRestaurants, shouldFollowDeliveryLocation])

  function handleRestaurantSelect(restaurantId: number) {
    if (activeRestaurantId !== restaurantId) {
      setCart({})
    }
    setActiveRestaurantId(restaurantId)
    setActiveCategoryId('all')
    setSearchTerm('')
    setSuccessOrder(null)
    setShouldFollowDeliveryLocation(false)
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
      activeRestaurant && hasValidCoordinates
        ? calculateDistanceKm(activeRestaurant.latitude, activeRestaurant.longitude, receiverLat, receiverLng)
        : Number(checkout.distanceKm)

    setCheckout((current) => ({
      ...current,
      receiverAddress: address.formattedAddress,
      receiverLat: hasValidCoordinates ? receiverLat.toFixed(6) : '',
      receiverLng: hasValidCoordinates ? receiverLng.toFixed(6) : '',
      distanceKm: Number.isFinite(nextDistance) ? nextDistance.toFixed(2) : current.distanceKm,
    }))
    setSelectedDeliveryAddress(address)
    setDeliveryLocationSource('address')
    setIsDeliveryAddressConfirmed(hasValidCoordinates)
    setShouldFollowDeliveryLocation(true)
    setErrorMessage(hasValidCoordinates ? null : 'Dia chi da chon chua co toa do hop le')
  }

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

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage('Trình duyệt không hỗ trợ lấy vị trí')
      return
    }

    setIsLocating(true)
    setErrorMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        void (async () => {
        const receiverLat = position.coords.latitude
        const receiverLng = position.coords.longitude
        const nextDistance = activeRestaurant
          ? calculateDistanceKm(activeRestaurant.latitude, activeRestaurant.longitude, receiverLat, receiverLng)
          : Number(checkout.distanceKm)
        const resolvedAddress = await reverseGeocodeAddress(receiverLat, receiverLng)

        if (!resolvedAddress.formattedAddress) {
          throw new Error('Khong the suy ra dia chi tu vi tri hien tai')
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
        setDeliveryLocationSource('current')
        setIsDeliveryAddressConfirmed(true)
        setShouldFollowDeliveryLocation(true)
        setIsLocating(false)
        })().catch((error) => {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the suy ra dia chi tu vi tri hien tai')
          setIsDeliveryAddressConfirmed(false)
          setIsLocating(false)
        })
      },
      (error) => {
        setErrorMessage(error.message || 'Không thể lấy vị trí hiện tại')
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  function validateCheckout() {
    if (!activeRestaurant) {
      return 'Vui lòng chọn nhà hàng'
    }

    if (cartItems.length === 0) {
      return 'Giỏ hàng đang trống'
    }

    if (!checkout.receiverAddress.trim()) {
      return 'Vui lòng nhập địa chỉ giao hàng'
    }

    if (!isDeliveryAddressConfirmed) {
      return 'Vui lòng chọn địa chỉ giao hàng từ danh sách gợi ý'
    }

    if (!isAuthenticated || user?.role !== 'CUSTOMER') {
      return 'Vui lòng đăng nhập tài khoản khách hàng để đặt món'
    }

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

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const checkoutError = validateCheckout()

    if (checkoutError || !activeRestaurant) {
      setErrorMessage(checkoutError)
      return
    }

    if (!isAuthenticated || user?.role !== 'CUSTOMER') {
      setErrorMessage('Vui lòng đăng nhập tài khoản khách hàng để đặt món')
      return
    }

    const idempotencyKey = `WEB-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`

    saveCheckoutDraft({
      id: idempotencyKey,
      createdAt: new Date().toISOString(),
      idempotencyKey,
      restaurant: {
        id: activeRestaurant.id,
        name: activeRestaurant.name,
        address: activeRestaurant.address,
        imageUrl: activeRestaurant.imageUrl,
        ratingAvg: activeRestaurant.ratingAvg,
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
             return tDef ? `${tDef.name} x${tCart.quantity} (+${formatPrice(Number(tDef.price) * tCart.quantity).replace(' ₫', ' đ')})` : null;
          })
          .filter(Boolean)
          .join(', ')
        return {
          foodId: item.food.id,
          name: item.food.name,
          imageUrl: item.food.imageUrl ?? null,
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

  useEffect(() => {
    if (errorMessage) {
      const timer = setTimeout(() => {
        setErrorMessage(null)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [errorMessage])

  return (
    <section className="order-page bg-slate-50 min-h-screen">
      {/* Premium Search Hero Banner */}
      <div className="market-hero rounded-2xl overflow-hidden mb-6 shadow-sm">
        <div className="hero-copy p-8 md:p-12">
          <span className="hero-badge bg-white/20 border border-white/30 text-white rounded-full text-xs px-3 py-1 font-bold">GrabFood</span>
          <h1 className="text-4xl md:text-5xl font-black text-white mt-4 leading-tight">Đặt món ngon quanh bạn</h1>
          <p className="text-white/80 font-medium mt-2">Giao tới: {checkout.receiverAddress || 'Chua chon dia chi'}</p>

          <div className="flex h-[58px] items-center gap-2.5 bg-white rounded-full px-4 shadow-[0_14px_30px_rgba(6,33,19,0.2)] mt-6 w-full max-w-[620px] md:hidden">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm tên quán, món ăn..."
              className="w-full min-w-0 bg-transparent border-0 outline-none pl-1 text-sm text-gray-800 focus:ring-0 focus:outline-none"
              aria-label="Tìm tên quán, món ăn"
            />
          </div>

          <div className="quick-row flex flex-wrap gap-2 mt-4" aria-label="Danh mục nhanh">
            {quickFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                className="px-4 py-1.5 rounded-full border border-white/20 bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer"
                onClick={() => setSearchTerm(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-plate hidden md:grid place-items-center p-8" aria-hidden="true">
          <div className="plate-photo w-[280px] h-[280px] rounded-full border-8 border-white/80 shadow-2xl" />
          <div className="floating-ticket absolute bottom-8 right-8 bg-white p-4 rounded-xl shadow-lg flex flex-col min-w-[120px]">
            <strong className="text-2xl font-black text-brand">{cartCount}</strong>
            <span className="text-xs text-gray-500 font-bold">món trong giỏ</span>
          </div>
        </div>
      </div>



      {isAuthenticated && hasTrackableOrder ? (
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-brand-light bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">Đơn đang theo dõi</p>
            <h2 className="mt-1 text-lg font-black text-gray-900">Bạn có đơn #{lastOrderId} đang hoạt động</h2>
            <p className="text-sm font-semibold text-gray-500">Mở trang theo dõi để xem trạng thái và vị trí tài xế realtime.</p>
          </div>
          <Link to={`/tracking?orderId=${lastOrderId}`} className="rounded-full bg-brand px-5 py-3 text-center text-sm font-black text-white no-underline shadow-sm">
            Theo dõi đơn
          </Link>
        </div>
      ) : null}

      <div className="order-layout">
        {/* Left: Restaurant Rail */}
        <aside className="tw-restaurant-rail bg-white border-0 rounded-2xl shadow-sm p-4 sticky top-20" aria-label="Nhà hàng">
          <div className="tw-rail-head flex items-center justify-between border-b border-gray-100 pb-3 mb-3">
            <div className="flex items-center gap-2 text-gray-800 font-extrabold text-sm">
              <Icon name="store" />
              <span>{isLoading ? 'Đang tải...' : 'Nhà hàng gần bạn'}</span>
            </div>
            <span className="text-[11px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-bold">
              {visibleRestaurants.length} quán
            </span>
          </div>
          {deliveryPoint ? (
            <p className="mb-2 px-1 text-[10px] font-semibold text-gray-400">
              {deliveryLocationSource === 'current'
                ? 'Theo vị trí hiện tại'
                : deliveryLocationSource === 'address'
                  ? 'Theo địa chỉ đã chọn'
                  : 'Theo toa do da chon'}
            </p>
          ) : null}

          <div className="tw-restaurant-stack flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto px-1 pt-[20px]">
            {previewRestaurants.map(({ restaurant, distanceKm }) => {
              const isActive = activeRestaurant?.id === restaurant.id
              const thumbStyle = restaurantThumbStyle(restaurant.imageUrl, restaurant.id)

              return (
                <button
                  key={restaurant.id}
                  type="button"
                  className={`w-full flex items-center gap-3 p-3 border-0 bg-white hover:bg-gray-50 rounded-xl transition-all duration-200 text-left focus:outline-none ${
                    isActive ? 'ring-2 ring-brand bg-green-50/20' : 'shadow-sm'
                  }`}
                  onClick={() => handleRestaurantSelect(restaurant.id)}
                >
                  <span
                    className={`w-[60px] h-[60px] rounded-xl shrink-0 bg-cover bg-center ${thumbStyle ? '' : 'restaurant-thumb--placeholder'}`}
                    style={thumbStyle}
                    aria-hidden="true"
                  />
                  <span className="tw-restaurant-info flex-1 min-w-0 flex flex-col gap-1">
                    <strong className="font-bold text-gray-900 text-sm truncate">{restaurant.name}</strong>
                    <small className="text-[11px] text-gray-500 truncate">{toCuisine(categories, restaurant.id)}</small>
                    <span className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold mt-0.5">
                      <span className="flex items-center gap-0.5 text-yellow-500">
                        ★ {restaurant.ratingAvg.toFixed(1)}
                      </span>
                      <span>·</span>
                      {distanceKm !== null ? (
                        <>
                          <span>{formatDistanceKm(distanceKm)}</span>
                          <span>·</span>
                        </>
                      ) : null}
                      <span>{toEtaFromDistance(distanceKm, restaurant.id)}</span>
                    </span>
                  </span>
                </button>
              )
            })}
            {!isLoading && visibleRestaurants.length === 0 ? <p className="text-gray-400 text-xs text-center py-6 font-medium">Không tìm thấy quán phù hợp.</p> : null}
          </div>

          <Link
            to={searchTerm ? `/restaurants?q=${encodeURIComponent(searchTerm)}` : '/restaurants'}
            className="mt-3 flex items-center justify-center rounded-full bg-brand px-4 py-2 text-xs font-black text-white no-underline shadow-sm"
          >
            Xem tất cả nhà hàng
          </Link>
        </aside>

        {/* Center: Menu Panel */}
        <main className="tw-menu-panel bg-white border-0 rounded-2xl shadow-sm p-5">
          {activeRestaurant ? (
            <div className="tw-restaurant-cover rounded-xl overflow-hidden relative min-h-[160px] flex items-end p-6 mb-6 shadow-sm" style={restaurantCoverStyle(activeRestaurant.imageUrl, activeRestaurant.id)}>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 w-full">
                <div className="flex-1">
                  <span className={`inline-flex items-center text-[10px] font-black rounded-full px-2.5 py-0.5 mb-2 ${
                    activeRestaurant.isOpen ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {activeRestaurant.isOpen ? 'ĐANG MỞ CỬA' : 'TẠM ĐÓNG CỬA'}
                  </span>
                  <h2 className="text-2xl font-bold text-white leading-tight m-0">{activeRestaurant.name}</h2>
                  <p className="flex items-center gap-1.5 text-xs text-white/80 font-medium mt-1.5">
                    <Icon name="location" />
                    {activeRestaurant.address || 'Địa chỉ đang cập nhật'}
                  </p>
                </div>
                <div className="cover-meta shrink-0 flex flex-col items-start md:items-end gap-1.5">
                  <span className="flex items-center gap-1 text-xs text-white/90 font-bold bg-black/40 rounded-full px-3 py-1">
                    <Icon name="clock" />
                    {toEta(activeRestaurant.id)}
                  </span>
                  <div className="flex flex-wrap justify-start gap-1.5 md:justify-end">
                    {getPromotionBadges(activeRestaurant).map((badge) => (
                      <strong key={badge} className="bg-[#ffb000] text-gray-900 rounded-full text-xs font-extrabold px-3 py-1.5 shadow-sm">
                        {badge}
                      </strong>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {featuredRestaurants.length > 0 ? (
            <div className="mb-6 rounded-2xl bg-gray-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand">Gợi ý nhanh</p>
                  <h2 className="text-base font-black text-gray-900">Nhà hàng nổi bật</h2>
                </div>
                <Link to="/restaurants" className="text-xs font-black text-brand no-underline">
                  Xem tất cả
                </Link>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {featuredRestaurants.map((restaurant) => (
                  <button
                    key={restaurant.id}
                    type="button"
                    onClick={() => handleRestaurantSelect(restaurant.id)}
                    className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <span
                      className={`h-14 w-14 shrink-0 rounded-xl bg-cover bg-center ${restaurantThumbStyle(restaurant.imageUrl, restaurant.id) ? '' : 'restaurant-thumb--placeholder'}`}
                      style={restaurantThumbStyle(restaurant.imageUrl, restaurant.id)}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-black text-gray-900">{restaurant.name}</strong>
                      <span className="mt-1 block text-[11px] font-bold text-gray-500">
                        ★ {restaurant.ratingAvg.toFixed(1)} · {toEta(restaurant.id)}
                      </span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {getPromotionBadges(restaurant).slice(0, 2).map((badge) => (
                          <span key={badge} className="rounded-full bg-brand-light px-2 py-0.5 text-[9px] font-black text-brand">
                            {badge}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {todaysFoods.length > 0 ? (
            <div className="mb-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-900">Random hôm nay</p>
                  <h2 className="text-base font-black text-gray-900">Món ngon hôm nay</h2>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {todaysFoods.map((food) => {
                  const restaurant = restaurantById.get(restaurantIdByCategoryId.get(food.categoryId ?? 0) ?? 0)
                  return (
                    <button
                      key={food.id}
                      type="button"
                      onClick={() => selectFoodRestaurant(food)}
                      className="w-[180px] shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <span
                        className={`block h-24 bg-cover bg-center ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                        style={foodPhotoStyle(food.imageUrl, food.id)}
                        aria-hidden="true"
                      />
                      <span className="block p-3">
                        <strong className="block truncate text-xs font-black text-gray-900">{food.name}</strong>
                        <span className="mt-1 block truncate text-[10px] font-bold text-gray-500">{restaurant?.name || 'Nhà hàng'}</span>
                        <div className="flex justify-between items-center mt-2">
                          <span className="block text-xs font-black text-[gray-900]">{formatPrice(Number(food.price))}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${(!food.isAvailable || Number(food.currentQuantity) <= 0) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                            {(!food.isAvailable || Number(food.currentQuantity) <= 0) ? 'Hết' : `Còn ${food.currentQuantity || 0}`}
                          </span>
                        </div>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Category Navigation Tabs */}
          <div className="tw-category-tabs flex gap-2 overflow-x-auto pb-2 border-b border-gray-100 mb-6" aria-label="Danh mục món">
            <button
              type="button"
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-0 ${
                activeCategoryId === 'all' ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={() => setActiveCategoryId('all')}
            >
              Tất cả
            </button>
            {activeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all border-0 whitespace-nowrap ${
                  activeCategoryId === category.id ? 'bg-brand text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          {/* Responsive Food Grid (No border, rounded-2xl, shadow-sm, hover:shadow-md) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {visibleFoods.map((food) => {
              const quantity = cart[food.id] || 0
              const remaining = Number(food.currentQuantity || 0)
              const isSoldOut = !food.isAvailable || remaining <= 0

              return (
                <article key={food.id} className={`tw-food-card bg-white border-0 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between ${isSoldOut ? 'opacity-60' : ''}`}>
                  <div>
                    <div
                      className={`tw-food-photo h-[150px] relative bg-cover bg-center ${foodPhotoStyle(food.imageUrl, food.id) ? '' : 'food-photo--placeholder'}`}
                      style={foodPhotoStyle(food.imageUrl, food.id)}
                    >
                      <span className="absolute left-3 bottom-3 bg-black/60 text-white rounded-full text-[10px] px-2.5 py-1 font-semibold z-10">
                        {categoryNameById.get(food.categoryId ?? 0) || 'Món ngon'}
                      </span>
                    </div>
                    <div className="tw-food-body p-4 flex flex-col gap-1">
                      <h3 className="font-bold text-gray-900 text-sm line-clamp-1 m-0">{food.name}</h3>
                      <div className="flex justify-between items-center mt-2">
                        <span className="font-extrabold text-[gray-900] text-sm">{formatPrice(Number(food.price))} đ</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSoldOut ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                          {isSoldOut ? 'Hết món' : `Còn ${remaining}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="tw-quantity-row p-4 pt-0 flex items-center justify-between gap-2 mt-auto">
                    {Object.values(cart).filter(c => c.foodId === food.id).length > 0 ? (
                      <div className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-2 py-1">
                        <strong className="text-xs font-bold text-gray-800 text-center px-2">
                          {Object.values(cart).filter(c => c.foodId === food.id).reduce((sum, c) => sum + c.quantity, 0)} trong giỏ
                        </strong>
                      </div>
                    ) : <span />}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 px-4 py-1.5 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white rounded-full text-xs font-bold transition-all cursor-pointer border-0 shadow-sm"
                      onClick={() => handleAddFoodClick(food)}
                      disabled={isSoldOut}
                    >
                      <Icon name="plus" />
                      Thêm
                    </button>
                  </div>
                </article>
              )
            })}

            {!isLoading && visibleFoods.length === 0 ? <p className="text-gray-400 text-center py-10 col-span-full font-medium">Chưa có món phù hợp.</p> : null}
          </div>
        </main>

        {/* Right: Checkout Panel */}
        <aside className="tw-checkout-panel bg-white border-0 rounded-2xl shadow-sm p-4 sticky top-20 relative" id="checkout" aria-label="Giỏ hàng">
          {errorMessage ? (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%]">
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border-2 border-red-200 shadow-[0_10px_40px_rgba(239,68,68,0.3)] text-base font-bold text-center">
                {errorMessage}
              </div>
            </div>
          ) : null}
          <div className="tw-checkout-head flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
            <div>
              <span className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Giỏ hàng của bạn</span>
              <h2 className="text-base font-extrabold text-gray-800 m-0">{cartCount} món</h2>
            </div>
            <div className="p-2 bg-brand-light text-brand rounded-full">
              <Icon name="cart" />
            </div>
          </div>

          <div className="tw-cart-list flex flex-col gap-3 max-h-[30vh] overflow-y-auto mb-4 pr-1">
            {cartItems.map((item) => (
              <div key={item.key} className="tw-cart-item flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="min-w-0 flex-1">
                  <strong className="block text-xs font-bold text-gray-800 truncate">{item.food.name}</strong>
                  {item.toppings && item.toppings.length > 0 && (
                    <span className="text-[10px] text-gray-500 block truncate mt-0.5">
                      {item.toppings.map(t => {
                        const tDef = item.food.toppings?.find(x => x.id === t.id)
                        return tDef ? `${tDef.name} x${t.quantity}` : ''
                      }).filter(Boolean).join(', ')}
                    </span>
                  )}
                  <span className="text-[11px] text-gray-500 font-semibold mt-0.5 block">
                    {item.quantity} x {formatPrice(Number(item.food.price) + item.toppings.reduce((sum, tCart) => {
                      const t = item.food.toppings?.find(x => x.id === tCart.id);
                      return sum + (t ? Number(t.price) * tCart.quantity : 0);
                    }, 0))}
                  </span>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors border-0 bg-transparent cursor-pointer"
                  onClick={() => updateCart(item.food, 0, item.toppings, item.key)}
                  aria-label="Xóa món"
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))}

            {cartItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                  <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-xs font-bold">Giỏ hàng trống</p>
                <p className="text-gray-400 text-[10px] mt-1">Hãy chọn món bạn yêu thích để đặt hàng nhé!</p>
              </div>
            ) : null}
          </div>

          <form className="tw-checkout-form flex flex-col gap-4 border-t border-gray-100 pt-4" onSubmit={handleSubmitOrder}>
            {!isAuthenticated ? (
              <p className="bg-brand-light text-brand-dark text-xs p-3 rounded-xl border border-brand-light font-semibold leading-relaxed">
                Vui lòng <Link to="/login" className="underline font-bold hover:text-brand-dark">đăng nhập khách hàng</Link> để đặt món.
              </p>
            ) : null}
            
            {/* Delivery Address Panel Card */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm flex items-start gap-3">
              <div className="text-gray-900 mt-1 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xs font-bold text-gray-800 mb-2">Thông tin giao hàng</h3>
                <div className="text-[11px] text-gray-600 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Người nhận:</span>
                    <span className="text-gray-900 font-bold">{user?.fullName || 'Khách hàng'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 font-semibold">Số điện thoại:</span>
                    <span className="text-gray-900 font-bold">{user?.phone || 'Chưa cung cấp'}</span>
                  </div>
                  <div className="mt-2 flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400">Địa chỉ giao hàng</label>
                    <AddressAutocomplete
                      value={checkout.receiverAddress}
                      onTextChange={updateReceiverAddress}
                      onSelect={selectDeliveryAddress}
                      isSelectionConfirmed={isDeliveryAddressConfirmed}
                      inputMode="textarea"
                      rows={2}
                      inputClassName="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-medium bg-gray-50 resize-none"
                      placeholder="Nhập địa chỉ giao hàng..."
                    />
                  </div>
                  <p className={`text-[10px] font-bold ${isDeliveryAddressConfirmed ? 'text-green-600' : 'text-amber-600'}`}>
                    {isDeliveryAddressConfirmed
                      ? selectedDeliveryAddress
                        ? 'Da chon dia chi giao hang'
                        : 'Da chon vi tri hien tai'
                      : 'Vui long chon mot dia chi trong danh sach goi y'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              onClick={useCurrentLocation}
              disabled={isLocating}
            >
              <Icon name="location" />
              {isLocating ? 'Đang lấy vị trí...' : 'Dùng vị trí hiện tại'}
            </button>

            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-bold text-gray-500">Hình thức giao hàng</span>
              <ShippingTypeSelect
                value={checkout.shippingType}
                onChange={(shippingType) =>
                  setCheckout((draft) => ({
                    ...draft,
                    shippingType,
                  }))
                }
                prices={shippingPrices}
              />
              <div className="hidden">
                <select
                  value={checkout.shippingType}
                  onChange={(event) =>
                    setCheckout((current) => ({
                      ...current,
                      shippingType: event.target.value as CheckoutState['shippingType'],
                    }))
                  }
                  className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent font-bold text-gray-800 bg-gray-50 cursor-pointer shadow-sm transition-all hover:bg-white"
                >
                  <option value="STANDARD">🛵 Giao tiêu chuẩn (Standard)</option>
                  <option value="FAST">🚀 Giao siêu tốc (Fast)</option>
                  <option value="ECO">🐢 Tiết kiệm (Eco)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                </div>
              </div>
            </div>

            {/* Pricing block with standard GrabFood layout */}
            <div className="tw-bill-box bg-gray-50 p-4 rounded-xl border border-gray-100 flex flex-col gap-2.5 mt-2">
              <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
                <span>Tạm tính</span>
                <span className="text-gray-800">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 font-semibold">
                <div className="flex flex-col text-left">
                  <span>Phí giao hàng</span>
                  {distanceKm > 0 && (
                    <span className="text-[10px] text-gray-400 font-medium">Khoảng cách: {roundedDistance} km</span>
                  )}
                </div>
                <span className="text-gray-800">{formatPrice(shippingFee)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between items-center text-xs text-green-600 font-bold">
                  <span>Ưu đãi</span>
                  <span>-{formatPrice(discountAmount)}</span>
                </div>
              )}
              <div className="border-t border-gray-200/60 my-1" />
              <div className="tw-bill-total flex justify-between items-center">
                <span className="text-xs font-bold text-gray-700">Tổng thanh toán</span>
                <strong className="text-xl font-bold text-brand-dark">{formatPrice(totalAmount)}</strong>
              </div>
            </div>

            <button
              type="submit"
              className="tw-checkout-button w-full flex items-center justify-center gap-2 py-4 bg-brand hover:bg-brand-dark disabled:bg-gray-100 disabled:text-gray-400 text-white border-0 rounded-xl text-sm font-bold transition-colors cursor-pointer shadow-md mt-1"
              disabled={cartItems.length === 0}
            >
              <Icon name="receipt" />
              Đặt đơn hàng
            </button>
          </form>

          {successOrder ? (
            <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-150 flex items-center gap-3 mt-4">
              <div className="p-2 bg-green-500 text-white rounded-full">
                <Icon name="check" />
              </div>
              <div className="flex-1 min-w-0">
                <strong className="block text-xs font-bold">{successOrder.orderCode}</strong>
                <span className="text-[11px] block mt-0.5 text-green-600 font-semibold">
                  {formatPrice(successOrder.totalAmount)} · {successOrder.statusLabel || successOrder.statusCode}
                </span>
              </div>
              <Link to={`/tracking?orderId=${successOrder.id}`} className="text-xs font-black text-brand hover:underline whitespace-nowrap">
                Theo dõi
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
      <ToppingModal
        isOpen={activeFood !== null}
        food={activeFood}
        onClose={() => setActiveFood(null)}
        onConfirm={handleToppingModalConfirm}
      />
    </section>
  )
}
