import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getOrders, updateOrderStatus } from '../services/api/orders'
import { getMyRestaurants } from '../services/api/restaurants'
import type { Order, Restaurant } from '../types'

function formatMoney(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

export default function MerchantOrdersPage() {
  useDocumentTitle(`${APP_NAME} | Don hang quan`)
  const { user } = useAuth()

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [restaurantFilter, setRestaurantFilter] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const mine = await getMyRestaurants()
      setRestaurants(mine)

      const targets = restaurantFilter
        ? mine.filter((item) => item.id === Number(restaurantFilter))
        : mine

      const batches = await Promise.all(
        targets.map((restaurant) => getOrders({ restaurantId: restaurant.id })),
      )
      const merged = batches.flat().sort((a, b) => b.id - a.id)
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
    if (!order.statusCode || !['PENDING', 'DRIVER_ACCEPTED'].includes(order.statusCode)) {
      return
    }

    try {
      setActioningId(order.id)
      setFeedback(null)
      await updateOrderStatus(order.id, 'CONFIRMED', order.version)
      setFeedback(`Da xac nhan don ${order.orderCode}`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the xac nhan don')
    } finally {
      setActioningId(null)
    }
  }

  const restaurantName = (id: number) => restaurants.find((item) => item.id === id)?.name || `Quan #${id}`

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
          <div className="menu-filter-bar" style={{ marginBottom: '1rem' }}>
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
          </div>

          {isLoading ? <p className="empty-state">Dang tai don hang...</p> : null}

          {!isLoading && orders.length === 0 ? (
            <p className="empty-state">Chua co don hang nao.</p>
          ) : (
            <div className="menu-card-grid">
              {orders.map((order) => (
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
                    <span>Khach #{order.customerId}</span>
                    <span>{order.receiverAddress}</span>
                  </div>
                  <div className="admin-actions">
                    <Link to={`/tracking?orderId=${order.id}`} className="button-secondary">
                      Theo doi
                    </Link>
                    {order.statusCode === 'PENDING' || order.statusCode === 'DRIVER_ACCEPTED' ? (
                      <button
                        type="button"
                        className="button-primary"
                        disabled={actioningId === order.id}
                        onClick={() => void handleConfirm(order)}
                      >
                        {actioningId === order.id ? 'Dang xac nhan...' : 'Xac nhan don'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {user ? (
        <p className="restaurant-status-text" style={{ marginTop: '1rem' }}>
          Dang nhap: {user.fullName || user.phone} ({user.role})
        </p>
      ) : null}
    </section>
  )
}
