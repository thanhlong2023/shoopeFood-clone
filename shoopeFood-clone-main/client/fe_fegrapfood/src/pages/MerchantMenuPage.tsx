import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getMyRestaurants } from '../services/api/restaurants'
import { restaurantThumbStyle } from '../utils/restaurantImage'
import type { Restaurant } from '../types'

export default function MerchantMenuPage() {
  useDocumentTitle(`${APP_NAME} | Thực đơn`)
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const items = await getMyRestaurants()
        setRestaurants(items)
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải quán')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [])

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <span className="hero-badge">Chủ quán</span>
          <h1>Quan của tôi & thực đơn</h1>
          <p>Chon quan de them/sua mon. Tao quan moi do admin thuc hien.</p>
        </div>
        <Link to="/merchant/orders" className="button-secondary">
          Xem đơn hàng
        </Link>
      </div>

      {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
      {isLoading ? <p className="empty-state">Đang tải...</p> : null}

      {!isLoading && restaurants.length === 0 ? (
        <div className="empty-state">
          <p>Chưa có quán nào được gán. Liên hệ admin để được tạo quán.</p>
        </div>
      ) : (
        <div className="restaurant-grid">
          {restaurants.map((restaurant) => (
            <article key={restaurant.id} className="restaurant-manage-card">
              <div
                className={`restaurant-manage-photo ${restaurantThumbStyle(restaurant.imageUrl, restaurant.id) ? '' : 'restaurant-manage-photo--placeholder'}`}
                style={restaurantThumbStyle(restaurant.imageUrl, restaurant.id)}
              />
              <div className="restaurant-manage-top">
                <span className="restaurant-manage-id">#{restaurant.id}</span>
                <span className={`approval-tag approval-${(restaurant.approvalStatus || 'pending').toLowerCase()}`}>
                  {restaurant.approvalStatus === 'APPROVED'
                    ? 'Da duyệt'
                    : restaurant.approvalStatus === 'REJECTED'
                      ? 'Từ chối'
                      : 'Cho duyệt'}
                </span>
              </div>
              <h3>{restaurant.name}</h3>
              <p className="restaurant-manage-address">{restaurant.address}</p>
              <div className="restaurant-actions">
                <Link to={`/restaurants/${restaurant.id}`} className="button-primary">
                  Quản lý món ăn
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
