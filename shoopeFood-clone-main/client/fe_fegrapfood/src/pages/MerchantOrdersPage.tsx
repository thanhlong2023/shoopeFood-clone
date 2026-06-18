import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import Modal from '../components/common/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getCategories } from '../services/api/categories'
import { getFoods } from '../services/api/foods'
import { getOrders, rejectOrder, updateOrderStatus } from '../services/api/orders'
import { getMyRestaurants } from '../services/api/restaurants'
import type { Food, Order, Restaurant } from '../types'

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function formatOrderTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Khong ro thoi gian'
  }

  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function isSameLocalDate(value: string, target = new Date()) {
  const date = new Date(value)
  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate()
  )
}

const ORDER_STATUS_GROUPS = {
  waiting: {
    label: 'Ch? x�c nh?n',
    codes: new Set<string>(['PENDING']),
  },
  preparing: {
    label: 'Dang lam',
    codes: new Set<string>(['CONFIRMED', 'DRIVER_ACCEPTED', 'PICKING_UP', 'DELIVERING']),
  },
  completed: {
    label: 'Ho�n th�nh',
    codes: new Set<string>(['COMPLETED']),
  },
} as const

type StatusFilter = '' | keyof typeof ORDER_STATUS_GROUPS

export default function MerchantOrdersPage() {
  useDocumentTitle(`${APP_NAME} | Don hang quan`)
  const { user } = useAuth()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [isLoading, setIsLoading] = useState(true)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const mine = await getMyRestaurants()
      setRestaurants(mine)

      const targets = restaurantFilter
        ? mine.filter((item) => item.id === Number(restaurantFilter))
        : mine

      const [categoryData, foodData] = await Promise.all([getCategories(), getFoods()])
      const ownedRestaurantIds = new Set(mine.map((restaurant) => restaurant.id))
      const ownedCategoryIds = new Set(
        categoryData.filter((category) => ownedRestaurantIds.has(category.restaurantId)).map((category) => category.id),
      )

      setFoods(foodData.filter((food) => food.categoryId !== null && ownedCategoryIds.has(food.categoryId)))

      const batches = await Promise.all(
        targets.map((restaurant) => getOrders({ restaurantId: restaurant.id })),
      )
      const merged = batches.flat().sort((a, b) => {
        const timeDifference = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        return timeDifference || b.id - a.id
      })
      setOrders(merged)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai don hang')
    } finally {
      setIsLoading(false)
    }
  }, [restaurantFilter])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleConfirm(order: Order) {
    if (order.statusCode !== 'PENDING') {
      return
    }

    try {
      setActioningId(order.id)
      setFeedback(null)
      await updateOrderStatus(order.id, 'CONFIRMED', order.version)
      setFeedback(`�� x�c nh?n don ${order.orderCode}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? x�c nh?n don')
    } finally {
      setActioningId(null)
    }
  }

  function openRejectModal(order: Order) {
    setRejectingOrder(order)
    setRejectReason('')
    setErrorMessage(null)
    setFeedback(null)
  }

  function closeRejectModal() {
    if (actioningId !== null) {
      return
    }

    setRejectingOrder(null)
    setRejectReason('')
  }

  async function handleReject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!rejectingOrder) {
      return
    }

    try {
      setActioningId(rejectingOrder.id)
      setFeedback(null)
      setErrorMessage(null)
      await rejectOrder(rejectingOrder.id, rejectReason, rejectingOrder.version)
      setFeedback(`Da tu choi don ${rejectingOrder.orderCode}`)
      setRejectingOrder(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tu choi don')
    } finally {
      setActioningId(null)
    }
  }

  const restaurantName = (id: number) => restaurants.find((item) => item.id === id)?.name || `Quan #${id}`
  const orderCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ORDER_STATUS_GROUPS).map(([key, group]) => [
          key,
          orders.filter((order) => order.statusCode && group.codes.has(order.statusCode)).length,
        ]),
      ) as Record<keyof typeof ORDER_STATUS_GROUPS, number>,
    [orders],
  )
  const merchantStats = useMemo(() => {
    const todayOrders = orders.filter((order) => isSameLocalDate(order.createdAt))
    const todayRevenue = todayOrders
      .filter((order) => order.statusCode !== 'CANCELLED' && order.statusCode !== 'TIMEOUT')
      .reduce((total, order) => total + Number(order.totalAmount || 0), 0)
    const lowStockFoods = foods.filter((food) => food.isAvailable && Number(food.currentQuantity || 0) <= 5).length
    const soldMap = new Map<string, number>()

    orders.forEach((order) => {
      order.items.forEach((item) => {
        const name = item.foodName || `Mon #${item.foodId}`
        soldMap.set(name, (soldMap.get(name) || 0) + Number(item.quantity || 0))
      })
    })

    const bestSeller = Array.from(soldMap.entries()).sort((left, right) => right[1] - left[1])[0]

    return {
      todayOrders: todayOrders.length,
      todayRevenue,
      bestSellerName: bestSeller?.[0] || 'Chua co du lieu',
      bestSellerQuantity: bestSeller?.[1] || 0,
      lowStockFoods,
    }
  }, [foods, orders])
  const visibleOrders = useMemo(() => {
    if (!statusFilter) {
      return orders
    }

    const group = ORDER_STATUS_GROUPS[statusFilter]
    return orders.filter((order) => order.statusCode && group.codes.has(order.statusCode))
  }, [orders, statusFilter])

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <span className="hero-badge">Chu quan</span>
          <h1>Don hang gui toi quan</h1>
          <p>Xem va xac nhan don moi. Quan ly thuc don o muc <Link to="/merchant/menu">Thuc don</Link>.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => void loadData()} disabled={isLoading}>
          Lam moi
        </button>
      </div>

      {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
      {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}

      {restaurants.length === 0 && !isLoading ? (
        <div className="empty-state">
          <p>Ban chua duoc gan quan nao. Lien he admin de tao quan.</p>
        </div>
      ) : (
        <>
          <div className="merchant-order-stats" aria-label="Thong ke don hang">
            <button type="button" className="merchant-order-stat" onClick={() => setStatusFilter('')}>
              <span>Don hom nay</span>
              <strong>{merchantStats.todayOrders}</strong>
            </button>
            <button type="button" className="merchant-order-stat" onClick={() => setStatusFilter('completed')}>
              <span>Doanh thu hom nay</span>
              <strong>{formatMoney(merchantStats.todayRevenue)}</strong>
            </button>
            <button type="button" className="merchant-order-stat">
              <span>Mon ban chay</span>
              <strong title={merchantStats.bestSellerName}>
                {merchantStats.bestSellerQuantity > 0 ? `${merchantStats.bestSellerName} (${merchantStats.bestSellerQuantity})` : '0'}
              </strong>
            </button>
            <Link to="/merchant/menu" className="merchant-order-stat">
              <span>Mon sap het</span>
              <strong>{merchantStats.lowStockFoods}</strong>
            </Link>
            <button
              type="button"
              className={`merchant-order-stat ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              <span>Tat ca</span>
              <strong>{orders.length}</strong>
            </button>
            {Object.entries(ORDER_STATUS_GROUPS).map(([key, group]) => (
              <button
                key={key}
                type="button"
                className={`merchant-order-stat ${statusFilter === key ? 'active' : ''}`}
                onClick={() => setStatusFilter(key as StatusFilter)}
              >
                <span>{group.label}</span>
                <strong>{orderCounts[key as keyof typeof ORDER_STATUS_GROUPS]}</strong>
              </button>
            ))}
          </div>

          <div className="menu-filter-bar merchant-order-filter-bar">
            <label>
              <span>Loc theo quan</span>
              <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
                <option value="">Tat ca quan cua toi</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    #{restaurant.id} - {restaurant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Loc theo trang thai</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="">Tat ca trang thai</option>
                {Object.entries(ORDER_STATUS_GROUPS).map(([key, group]) => (
                  <option key={key} value={key}>
                    {group.label} ({orderCounts[key as keyof typeof ORDER_STATUS_GROUPS]})
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? <p className="empty-state">Dang tai don hang...</p> : null}

          {!isLoading && visibleOrders.length === 0 ? (
            <p className="empty-state">
              {orders.length === 0 ? 'Chua co don hang nao.' : 'Khong co don hang phu hop bo loc.'}
            </p>
          ) : (
            <div className="menu-card-grid">
              {visibleOrders.map((order) => (
                <article key={order.id} className="menu-admin-card">
                  <div className="menu-admin-card-head">
                    <div>
                      <span>#{order.orderCode}</span>
                      <h3>{restaurantName(order.restaurantId)}</h3>
                    </div>
                    <strong>{formatMoney(order.totalAmount)} VND</strong>
                  </div>
                  <div className="menu-admin-meta">
                    <span>{order.statusLabel || order.statusCode || 'Khong ro'}</span>
                    <span>{order.customer || `Khach #${order.customerId}`}</span>
                    <span>{formatOrderTime(order.createdAt)}</span>
                    <span>{order.receiverAddress}</span>
                  </div>
                  <div className="admin-actions">
                    <Link to={`/tracking?orderId=${order.id}`} className="button-secondary">
                      Theo doi
                    </Link>
                    {order.statusCode === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="button-secondary"
                          disabled={actioningId === order.id}
                          onClick={() => openRejectModal(order)}
                        >
                          Tu choi don
                        </button>
                        <button
                          type="button"
                          className="button-primary"
                          disabled={actioningId === order.id}
                          onClick={() => void handleConfirm(order)}
                        >
                          {actioningId === order.id ? 'Dang xac nhan...' : 'X�c nh?n don'}
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <Modal
        title="Tu choi don"
        subtitle={rejectingOrder ? `Don ${rejectingOrder.orderCode} se chuyen sang trang thai da huy.` : undefined}
        isOpen={Boolean(rejectingOrder)}
        onClose={closeRejectModal}
        footer={
          rejectingOrder ? (
            <>
              <button type="button" className="button-secondary" onClick={closeRejectModal} disabled={actioningId !== null}>
                H?y
              </button>
              <button
                type="submit"
                form="reject-order-form"
                className="button-danger"
                disabled={actioningId !== null || !rejectReason.trim()}
              >
                {actioningId === rejectingOrder.id ? 'Dang xu ly...' : 'X�c nh?n tu choi'}
              </button>
            </>
          ) : null
        }
      >
        <form id="reject-order-form" className="modal-form" onSubmit={handleReject}>
          <label className="restaurant-field">
            <span>Ly do tu choi</span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Vi du: quan het mon, khong phuc vu khu vuc nay..."
              rows={4}
            />
          </label>
          {rejectingOrder ? (
            <p className="restaurant-status-text">
              Don {rejectingOrder.orderCode} - {formatMoney(rejectingOrder.totalAmount)} VND
            </p>
          ) : null}
        </form>
      </Modal>

      {user ? (
        <p className="restaurant-status-text" style={{ marginTop: '1rem' }}>
          Dang nhap: {user.fullName || user.phone} ({user.role})
        </p>
      ) : null}
    </section>
  )
}
