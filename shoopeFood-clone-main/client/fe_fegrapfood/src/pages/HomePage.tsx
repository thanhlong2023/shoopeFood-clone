import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import PartnerSection from '../components/partner/PartnerSection'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getCategories } from '../services/api/categories'
import { getFoods } from '../services/api/foods'
import { createOrder } from '../services/api/orders'
import { getRestaurants } from '../services/api/restaurants'
import { foodPhotoStyle } from '../utils/foodImage'
import { setLastOrderId } from '../utils/orderStorage'
import { restaurantCoverStyle, restaurantThumbStyle } from '../utils/restaurantImage'
import type { Category, CreateOrderPayload, Food, Order, Restaurant } from '../types'

type CartState = Record<number, number>

type CheckoutState = {
  receiverAddress: string
  receiverLat: string
  receiverLng: string
  distanceKm: string
  shippingType: NonNullable<CreateOrderPayload['shippingType']>
}

type IconName = 'search' | 'location' | 'cart' | 'plus' | 'minus' | 'trash' | 'store' | 'clock' | 'star' | 'receipt' | 'check'

const quickFilters = ['Com trua', 'Bun pho', 'Do uong', 'An vat', 'Chay', 'Giam gia']
const initialCheckoutState: CheckoutState = {
  receiverAddress: '12 Nguyen Hue, Quan 1',
  receiverLat: '10.7769',
  receiverLng: '106.7009',
  distanceKm: '3.2',
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
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  )
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function toEta(restaurantId: number) {
  const baseMinute = 18 + (restaurantId % 4) * 3
  return `${baseMinute}-${baseMinute + 7} phut`
}

function toCuisine(categories: Category[], restaurantId: number) {
  const names = categories.filter((item) => item.restaurantId === restaurantId).map((item) => item.name)
  return names.slice(0, 2).join(' · ') || 'Mon ngon moi ngay'
}

function toPromotion(restaurantId: number) {
  const promotions = ['Giam 20% den 40k', 'Freeship 3km', 'Combo trua tiet kiem', 'Tang mon tu 99k']
  return promotions[restaurantId % promotions.length]
}

export default function HomePage() {
  useDocumentTitle(`${APP_NAME} | Dat mon`)
  const { isAuthenticated, user } = useAuth()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [activeRestaurantId, setActiveRestaurantId] = useState<number | null>(null)
  const [activeCategoryId, setActiveCategoryId] = useState<number | 'all'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [cart, setCart] = useState<CartState>({})
  const [checkout, setCheckout] = useState<CheckoutState>(initialCheckoutState)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successOrder, setSuccessOrder] = useState<Order | null>(null)
  const submitKeyRef = useRef<string | null>(null)

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
          setErrorMessage(error instanceof Error ? error.message : 'Khong the ket noi API')
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
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return menuFoods.filter((food) => {
      const matchesCategory = activeCategoryId === 'all' || food.categoryId === activeCategoryId
      const matchesSearch = !normalizedSearch || food.name.toLowerCase().includes(normalizedSearch)
      return matchesCategory && matchesSearch
    })
  }, [activeCategoryId, menuFoods, searchTerm])

  const cartItems = useMemo(
    () =>
      menuFoods
        .map((food) => ({
          food,
          quantity: cart[food.id] || 0,
        }))
        .filter((item) => item.quantity > 0),
    [cart, menuFoods],
  )

  const subtotal = useMemo(
    () => cartItems.reduce((total, item) => total + Number(item.food.price || 0) * item.quantity, 0),
    [cartItems],
  )
  const distanceKm = Number(checkout.distanceKm) || 0
  const shippingFee = distanceKm * 3500
  const discountAmount = subtotal >= 100000 ? 15000 : 0
  const totalAmount = Math.max(0, subtotal + shippingFee - discountAmount)
  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

  function handleRestaurantSelect(restaurantId: number) {
    setActiveRestaurantId(restaurantId)
    setActiveCategoryId('all')
    setSearchTerm('')
    setCart({})
    setSuccessOrder(null)
  }

  function updateFoodQuantity(food: Food, nextQuantity: number) {
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

  function validateCheckout() {
    if (!activeRestaurant) {
      return 'Vui long chon nha hang'
    }

    if (cartItems.length === 0) {
      return 'Gio hang dang trong'
    }

    if (!checkout.receiverAddress.trim()) {
      return 'Vui long nhap dia chi giao hang'
    }

    if (!isAuthenticated || user?.role !== 'CUSTOMER') {
      return 'Vui long dang nhap tai khoan khach hang de dat mon'
    }

    if (!Number.isFinite(Number(checkout.receiverLat)) || !Number.isFinite(Number(checkout.receiverLng))) {
      return 'Toa do giao hang khong hop le'
    }

    if (!Number.isFinite(Number(checkout.distanceKm)) || Number(checkout.distanceKm) <= 0) {
      return 'Khoang cach giao hang khong hop le'
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

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      setSuccessOrder(null)
      if (!submitKeyRef.current) {
        submitKeyRef.current = `WEB-${Date.now()}-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`
      }

      const createdOrder = await createOrder({
        restaurantId: activeRestaurant.id,
        receiverAddress: checkout.receiverAddress.trim(),
        receiverLat: Number(checkout.receiverLat),
        receiverLng: Number(checkout.receiverLng),
        distanceKm: Number(checkout.distanceKm),
        shippingType: checkout.shippingType,
        discountAmount,
        taxAmount: 0,
        idempotencyKey: submitKeyRef.current,
        items: cartItems.map((item) => ({
          foodId: item.food.id,
          quantity: item.quantity,
        })),
      })

      setSuccessOrder(createdOrder)
      setLastOrderId(createdOrder.id)
      submitKeyRef.current = null
      setCart({})
      setFoods(await getFoods())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tao don hang')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="order-page">
      <div className="market-hero">
        <div className="hero-copy">
          <span className="hero-badge">GrabFood</span>
          <h1>Dat mon ngon quanh ban</h1>
          <p>Giao toi {checkout.receiverAddress}</p>

          <div className="market-search" role="search">
            <Icon name="search" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tim mon an, quan an..."
              aria-label="Tim mon an"
            />
          </div>

          <div className="quick-row" aria-label="Danh muc nhanh">
            {quickFilters.map((filter) => (
              <button key={filter} type="button" onClick={() => setSearchTerm(filter)}>
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-plate" aria-hidden="true">
          <div className="plate-photo" />
          <div className="floating-ticket">
            <strong>{cartCount}</strong>
            <span>mon trong gio</span>
          </div>
        </div>
      </div>

      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

      <PartnerSection />

      <div className="order-layout">
        <aside className="restaurant-rail" aria-label="Nha hang">
          <div className="rail-head">
            <Icon name="store" />
            <span>{isLoading ? 'Dang tai...' : `${restaurants.length} nha hang`}</span>
          </div>

          <div className="restaurant-stack">
            {restaurants.map((restaurant) => {
              const isActive = activeRestaurant?.id === restaurant.id
              const thumbStyle = restaurantThumbStyle(restaurant.imageUrl)

              return (
                <button
                  key={restaurant.id}
                  type="button"
                  className={`restaurant-pick ${isActive ? 'active' : ''}`}
                  onClick={() => handleRestaurantSelect(restaurant.id)}
                >
                  <span
                    className={`restaurant-thumb ${thumbStyle ? '' : 'restaurant-thumb--placeholder'}`}
                    style={thumbStyle}
                    aria-hidden="true"
                  />
                  <span className="restaurant-info">
                    <strong>{restaurant.name}</strong>
                    <small>{toCuisine(categories, restaurant.id)}</small>
                    <span>
                      <Icon name="star" />
                      {restaurant.ratingAvg.toFixed(1)} · {toEta(restaurant.id)}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        <main className="menu-panel">
          {activeRestaurant ? (
            <div className="restaurant-cover" style={restaurantCoverStyle(activeRestaurant.imageUrl)}>
              <div>
                <span className={`open-badge ${activeRestaurant.isOpen ? 'open' : 'closed'}`}>
                  {activeRestaurant.isOpen ? 'Dang mo cua' : 'Tam dong cua'}
                </span>
                <h2>{activeRestaurant.name}</h2>
                <p>
                  <Icon name="location" />
                  {activeRestaurant.address || 'Dia chi dang cap nhat'}
                </p>
              </div>
              <div className="cover-meta">
                <span>
                  <Icon name="clock" />
                  {toEta(activeRestaurant.id)}
                </span>
                <strong>{toPromotion(activeRestaurant.id)}</strong>
              </div>
            </div>
          ) : null}

          <div className="category-tabs" aria-label="Danh muc mon">
            <button type="button" className={activeCategoryId === 'all' ? 'active' : ''} onClick={() => setActiveCategoryId('all')}>
              Tat ca
            </button>
            {activeCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                className={activeCategoryId === category.id ? 'active' : ''}
                onClick={() => setActiveCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="menu-grid">
            {visibleFoods.map((food) => {
              const quantity = cart[food.id] || 0
              const remaining = Number(food.currentQuantity || 0)
              const isSoldOut = !food.isAvailable || remaining <= 0

              return (
                <article key={food.id} className={`food-card ${isSoldOut ? 'sold-out' : ''}`}>
                  <div
                    className={`food-photo ${foodPhotoStyle(food.imageUrl) ? '' : 'food-photo--placeholder'}`}
                    style={foodPhotoStyle(food.imageUrl)}
                  >
                    <span>{categoryNameById.get(food.categoryId ?? 0) || 'Mon ngon'}</span>
                  </div>
                  <div className="food-body">
                    <div>
                      <h3>{food.name}</h3>
                      <p>{formatPrice(Number(food.price))} VND</p>
                    </div>
                    <div className="food-stock">
                      <span>{isSoldOut ? 'Het mon' : `Con ${remaining}`}</span>
                    </div>
                  </div>

                  <div className="quantity-row">
                    {quantity > 0 ? (
                      <>
                        <button type="button" className="icon-button" onClick={() => updateFoodQuantity(food, quantity - 1)} aria-label="Giam so luong">
                          <Icon name="minus" />
                        </button>
                        <strong>{quantity}</strong>
                      </>
                    ) : (
                      <span />
                    )}
                    <button
                      type="button"
                      className="add-button"
                      onClick={() => updateFoodQuantity(food, quantity + 1)}
                      disabled={isSoldOut || quantity >= remaining}
                    >
                      <Icon name="plus" />
                      Them
                    </button>
                  </div>
                </article>
              )
            })}

            {!isLoading && visibleFoods.length === 0 ? <p className="empty-state">Chua co mon phu hop.</p> : null}
          </div>
        </main>

        <aside className="checkout-panel" id="checkout" aria-label="Gio hang">
          <div className="checkout-head">
            <div>
              <span>Gio hang</span>
              <h2>{cartCount} mon</h2>
            </div>
            <Icon name="cart" />
          </div>

          <div className="cart-list">
            {cartItems.map((item) => (
              <div key={item.food.id} className="cart-item">
                <div>
                  <strong>{item.food.name}</strong>
                  <span>
                    {item.quantity} x {formatPrice(Number(item.food.price))} VND
                  </span>
                </div>
                <button type="button" className="icon-button subtle" onClick={() => updateFoodQuantity(item.food, 0)} aria-label="Xoa mon">
                  <Icon name="trash" />
                </button>
              </div>
            ))}

            {cartItems.length === 0 ? <p className="cart-empty">Chon mon de bat dau dat hang.</p> : null}
          </div>

          <form className="checkout-form" onSubmit={handleSubmitOrder}>
            {!isAuthenticated ? (
              <p className="login-account-note">
                Vui long <Link to="/login">dang nhap khach hang</Link> de dat mon.
              </p>
            ) : null}
            <label>
              <span>Dia chi giao hang</span>
              <input
                value={checkout.receiverAddress}
                onChange={(event) => setCheckout((current) => ({ ...current, receiverAddress: event.target.value }))}
              />
            </label>

            <div className="checkout-grid">
              <label>
                <span>Lat</span>
                <input
                  value={checkout.receiverLat}
                  onChange={(event) => setCheckout((current) => ({ ...current, receiverLat: event.target.value }))}
                />
              </label>
              <label>
                <span>Lng</span>
                <input
                  value={checkout.receiverLng}
                  onChange={(event) => setCheckout((current) => ({ ...current, receiverLng: event.target.value }))}
                />
              </label>
            </div>

            <div className="checkout-grid">
              <label>
                <span>Km</span>
                <input
                  value={checkout.distanceKm}
                  onChange={(event) => setCheckout((current) => ({ ...current, distanceKm: event.target.value }))}
                />
              </label>
              <label>
                <span>Giao hang</span>
                <select
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
              </label>
            </div>

            <div className="bill-box">
              <div>
                <span>Tam tinh</span>
                <strong>{formatPrice(subtotal)} VND</strong>
              </div>
              <div>
                <span>Phi giao hang</span>
                <strong>{formatPrice(shippingFee)} VND</strong>
              </div>
              <div>
                <span>Uu dai</span>
                <strong>-{formatPrice(discountAmount)} VND</strong>
              </div>
              <div className="bill-total">
                <span>Tong cong</span>
                <strong>{formatPrice(totalAmount)} VND</strong>
              </div>
            </div>

            <button type="submit" className="checkout-button" disabled={isSubmitting || cartItems.length === 0}>
              <Icon name="receipt" />
              {isSubmitting ? 'Dang dat hang...' : 'Dat hang'}
            </button>
          </form>

          {successOrder ? (
            <div className="order-success">
              <Icon name="check" />
              <div>
                <strong>{successOrder.orderCode}</strong>
                <span>{formatPrice(successOrder.totalAmount)} VND · {successOrder.statusLabel || successOrder.statusCode}</span>
              </div>
              <Link to={`/tracking?orderId=${successOrder.id}`}>Theo doi</Link>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
