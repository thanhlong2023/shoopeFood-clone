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
import { toOrderCode } from '../utils/formatters'

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function formatOrderTime(value: string) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Không rõ thời gian'
  }

  const timeString = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)

  const dateString = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)

  return `${timeString} - Ngày ${dateString}`
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  DRIVER_ACCEPTED: 'Tài xế đã nhận',
  PICKING_UP: 'Đang lấy món',
  DELIVERING: 'Đang giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
  TIMEOUT: 'Hết hạn',
}

function getStatusLabel(order: Order) {
  if (order.statusCode && STATUS_LABELS[order.statusCode]) {
    return STATUS_LABELS[order.statusCode]
  }
  return order.statusLabel || order.statusCode || 'Không rõ'
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
    label: 'Chờ xác nhận',
    codes: new Set<string>(['PENDING']),
  },
  preparing: {
    label: 'Đang làm',
    codes: new Set<string>(['CONFIRMED', 'DRIVER_ACCEPTED', 'PICKING_UP', 'DELIVERING']),
  },
  completed: {
    label: 'Hoàn thành',
    codes: new Set<string>(['COMPLETED']),
  },
} as const

type StatusFilter = '' | keyof typeof ORDER_STATUS_GROUPS

export default function MerchantOrdersPage() {
  useDocumentTitle(`${APP_NAME} | Đơn hàng quán`)
  const { user } = useAuth()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [dateFilter, setDateFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [rejectingOrder, setRejectingOrder] = useState<Order | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showLowStockModal, setShowLowStockModal] = useState(false)

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
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải đơn hàng')
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
      setFeedback(`Đã xác nhận đơn ${order.orderCode}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xác nhận đơn')
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
      setFeedback(`Đã từ chối đơn ${rejectingOrder.orderCode}`)
      setRejectingOrder(null)
      setRejectReason('')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể từ chối đơn')
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
      
    const targetDateForMonth = dateFilter ? new Date(dateFilter) : new Date()
    const targetMonth = targetDateForMonth.getMonth()
    const targetYear = targetDateForMonth.getFullYear()
    
    const selectedMonthRevenue = orders
      .filter((order) => {
        const d = new Date(order.createdAt)
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear
      })
      .filter((order) => order.statusCode !== 'CANCELLED' && order.statusCode !== 'TIMEOUT')
      .reduce((total, order) => total + Number(order.totalAmount || 0), 0)

    const lowStockFoodsList = foods.filter((food) => food.isAvailable && Number(food.currentQuantity || 0) <= 5)
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
      selectedMonthRevenue,
      selectedMonthStr: `${targetMonth + 1}/${targetYear}`,
      bestSellerName: bestSeller?.[0] || 'Chưa có du lieu',
      bestSellerQuantity: bestSeller?.[1] || 0,
      lowStockFoods: lowStockFoodsList.length,
      lowStockFoodsList,
    }
  }, [foods, orders, dateFilter])
  const visibleOrders = useMemo(() => {
    let result = orders

    if (statusFilter) {
      const group = ORDER_STATUS_GROUPS[statusFilter]
      result = result.filter((order) => order.statusCode && group.codes.has(order.statusCode))
    }

    if (dateFilter) {
      const [year, month, day] = dateFilter.split('-').map(Number)
      const targetDate = new Date(year, month - 1, day)
      result = result.filter((order) => isSameLocalDate(order.createdAt, targetDate))
    }

    return result
  }, [orders, statusFilter, dateFilter])

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <span className="hero-badge">Chủ quán</span>
          <h1>Đơn hàng gửi tới quán</h1>
          <p>Xem và xác nhận đơn mới. Quản lý thực đơn ở mục <Link to="/merchant/menu">Thực đơn</Link>.</p>
        </div>
        <button type="button" className="button-secondary" onClick={() => void loadData()} disabled={isLoading}>
          Làm mới
        </button>
      </div>

      {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
      {feedback ? <p className="restaurant-feedback success">{feedback}</p> : null}

      {restaurants.length === 0 && !isLoading ? (
        <div className="empty-state">
          <p>Bạn chưa được gán quán nào. Liên hệ admin để tạo quán.</p>
        </div>
      ) : (
        <>
          <div className="merchant-order-stats" aria-label="Thống kê đơn hàng">
            <button type="button" className="merchant-order-stat" onClick={() => setStatusFilter('')}>
              <span>Đơn hôm nay</span>
              <strong>{merchantStats.todayOrders}</strong>
            </button>
            <button type="button" className="merchant-order-stat" onClick={() => setStatusFilter('completed')}>
              <span>Doanh thu hôm nay</span>
              <strong>{formatMoney(merchantStats.todayRevenue)}</strong>
            </button>
            <button type="button" className="merchant-order-stat" onClick={() => setStatusFilter('completed')}>
              <span>DT Tháng {merchantStats.selectedMonthStr}</span>
              <strong style={{ color: 'var(--primary)' }}>{formatMoney(merchantStats.selectedMonthRevenue)}</strong>
            </button>
            <button type="button" className="merchant-order-stat">
              <span>Món bán chạy</span>
              <strong title={merchantStats.bestSellerName}>
                {merchantStats.bestSellerQuantity > 0 ? `${merchantStats.bestSellerName} (${merchantStats.bestSellerQuantity})` : '0'}
              </strong>
            </button>
            <button type="button" className="merchant-order-stat" onClick={() => setShowLowStockModal(true)}>
              <span>Món sắp hết</span>
              <strong>{merchantStats.lowStockFoods}</strong>
            </button>
            <button
              type="button"
              className={`merchant-order-stat ${statusFilter === '' ? 'active' : ''}`}
              onClick={() => setStatusFilter('')}
            >
              <span>Tất cả</span>
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
              <span>Lọc theo quán</span>
              <select value={restaurantFilter} onChange={(event) => setRestaurantFilter(event.target.value)}>
                <option value="">Tất cả quan của tôi</option>
                {restaurants.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    #{restaurant.id} - {restaurant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Lọc theo trạng thái</span>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="">Tất cả trạng thái</option>
                {Object.entries(ORDER_STATUS_GROUPS).map(([key, group]) => (
                  <option key={key} value={key}>
                    {group.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Lọc theo ngày</span>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </label>
          </div>

          {isLoading ? <p className="empty-state">Đang tải đơn hàng...</p> : null}

          {!isLoading && visibleOrders.length === 0 ? (
            <p className="empty-state">
              {orders.length === 0 ? 'Chưa có đơn hàng nào.' : 'Không có đơn hàng phù hợp bộ lọc.'}
            </p>
          ) : (
            <div className="menu-card-grid">
              {visibleOrders.map((order) => {
                let statusClass = 'neutral'
                if (order.statusCode === 'PENDING') statusClass = 'pending'
                else if (order.statusCode === 'COMPLETED') statusClass = 'completed'
                else if (order.statusCode === 'CANCELLED' || order.statusCode === 'TIMEOUT') statusClass = 'cancelled'
                else if (order.statusCode) statusClass = 'delivering'

                return (
                  <article key={order.id} className="premium-order-card">
                    <div className="card-top-zone">
                      <h3 title={restaurantName(order.restaurantId)}>{restaurantName(order.restaurantId)}</h3>
                      <span className={`status-chip ${statusClass}`}>
                        {getStatusLabel(order)}
                      </span>
                    </div>

                    <div className="card-middle-zone">
                      <p className="order-meta-text">
                        Mã đơn: <strong>{toOrderCode(order.id, order.orderCode)}</strong> • {formatOrderTime(order.createdAt)}
                      </p>
                      <p className="order-meta-text">Người đặt: {order.customer || 'Khách vãng lai'}</p>
                      {order.driverName && <p className="order-meta-text">Tài xế: {order.driverName}</p>}
                      <p className="order-meta-text address-text" title={order.receiverAddress}>
                        Giao đến: {order.receiverAddress}
                      </p>
                      {order.note && (
                        <p className="order-meta-text text-orange-600 font-medium">
                          Ghi chú: {order.note}
                        </p>
                      )}
                    </div>

                    <div className="card-bottom-zone">
                      <strong className="order-price">{formatMoney(order.totalAmount)} đ</strong>
                      <div className="admin-actions">
                        <Link to={`/tracking?orderId=${order.id}`} className="button-secondary">
                          {order.statusCode === 'COMPLETED' ? 'Chi tiết & Đánh giá' : 'Theo dõi'}
                        </Link>
                        {order.statusCode === 'PENDING' ? (
                          <>
                            <button
                              type="button"
                              className="button-secondary"
                              disabled={actioningId === order.id}
                              onClick={() => openRejectModal(order)}
                            >
                              Từ chối
                            </button>
                            <button
                              type="button"
                              className="button-primary"
                              disabled={actioningId === order.id}
                              onClick={() => void handleConfirm(order)}
                            >
                              {actioningId === order.id ? 'Đang xác nhận...' : 'Xác nhận đơn'}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </>
      )}

      <Modal
        title="Từ chối đơn"
        subtitle={rejectingOrder ? `Don ${rejectingOrder.orderCode} se chuyen sang trạng thái da huy.` : undefined}
        isOpen={Boolean(rejectingOrder)}
        onClose={closeRejectModal}
        footer={
          rejectingOrder ? (
            <>
              <button type="button" className="button-secondary" onClick={closeRejectModal} disabled={actioningId !== null}>
                Hủy
              </button>
              <button
                type="submit"
                form="reject-order-form"
                className="button-danger"
                disabled={actioningId !== null || !rejectReason.trim()}
              >
                {actioningId === rejectingOrder.id ? 'Đang xử lý...' : 'Xác nhận từ chối'}
              </button>
            </>
          ) : null
        }
      >
        <form id="reject-order-form" className="modal-form" onSubmit={handleReject}>
          <label className="restaurant-field">
            <span>Lý do từ chối</span>
            <textarea
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
              placeholder="Ví dụ: quán hết món, không phục vụ khu vực này..."
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

      <Modal
        title="Danh sách món sắp hết"
        isOpen={showLowStockModal}
        onClose={() => setShowLowStockModal(false)}
      >
        <div className="restaurant-cart-lines" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {merchantStats.lowStockFoodsList.length > 0 ? (
            merchantStats.lowStockFoodsList.map((food) => (
              <div key={food.id} className="restaurant-cart-line" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
                <span style={{ fontWeight: 600 }}>{food.name}</span>
                <strong style={{ color: '#E65100' }}>Còn: {food.currentQuantity}</strong>
              </div>
            ))
          ) : (
            <p className="empty-state">Hiện không có món nào sắp hết.</p>
          )}
        </div>
        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <Link to="/merchant/menu" className="button-primary" onClick={() => setShowLowStockModal(false)}>
            Đến trang quản lý Menu
          </Link>
        </div>
      </Modal>

      {user ? (
        <p className="restaurant-status-text" style={{ marginTop: '1rem' }}>
          Đăng nhập: {user.fullName || user.phone} ({user.role})
        </p>
      ) : null}
    </section>
  )
}
