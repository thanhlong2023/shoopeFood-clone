import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getRestaurantById } from '../services/api/restaurants'
import type { Restaurant } from '../types'

const fallbackRestaurantImage =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85'

function formatTime(value: string) {
  return value?.slice(0, 5) || '--:--'
}

function approvalLabel(status: Restaurant['approvalStatus']) {
  if (status === 'APPROVED') return 'Da duyet'
  if (status === 'REJECTED') return 'Bi tu choi'
  return 'Cho duyet'
}

export default function RestaurantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const restaurantId = Number(id)
  const { hasRole, user } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const isMerchant = hasRole(['MERCHANT'])

  useDocumentTitle(`${APP_NAME} | Restaurant detail`)

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function loadRestaurant() {
      if (!Number.isFinite(restaurantId)) {
        setErrorMessage('Restaurant ID khong hop le')
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setErrorMessage(null)
        const item = await getRestaurantById(restaurantId)
        if (!ignore) {
          const isOwner = user ? item.ownerId === user.id : false
          const canViewDetail = isAdmin || (isMerchant && isOwner) || item.approvalStatus === 'APPROVED'

          if (!canViewDetail) {
            setRestaurant(null)
            setErrorMessage('Ban khong co quyen xem nha hang nay')
            return
          }

          setRestaurant(item)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai chi tiet nha hang')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void loadRestaurant()

    return () => {
      ignore = true
    }
  }, [isAdmin, isMerchant, restaurantId, user])

  const position = useMemo<[number, number]>(() => {
    if (!restaurant) {
      return [10.77689, 106.70081]
    }

    return [restaurant.latitude, restaurant.longitude]
  }, [restaurant])

  const canManageRestaurant = Boolean(restaurant && (isAdmin || (isMerchant && user?.id === restaurant.ownerId)))

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <h1>{restaurant?.name || 'Chi tiet nha hang'}</h1>
          <p>{restaurant?.address || 'Thong tin nha hang lay truc tiep tu API backend.'}</p>
        </div>
        <div className="restaurant-actions">
          <Link to="/restaurants" className="button-secondary">
            Quay lai
          </Link>
          {restaurant && canManageRestaurant ? (
            <Link to={`/restaurants/edit/${restaurant.id}`} className="button-primary">
              Sua nha hang
            </Link>
          ) : null}
        </div>
      </div>

      {isLoading ? <p className="empty-state">Dang tai chi tiet nha hang...</p> : null}
      {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}

      {restaurant ? (
        <div className="restaurant-detail-grid">
          <article className="restaurant-detail-card">
            <img src={restaurant.imageUrl || fallbackRestaurantImage} alt={restaurant.name} className="restaurant-detail-image" />

            <div className="restaurant-detail-info">
              <div className="restaurant-card-meta">
                <strong>{restaurant.ratingAvg.toFixed(1)} sao</strong>
                <span className={`status-tag ${restaurant.isOpen && restaurant.isOpenToday ? 'open' : 'closed'}`}>
                  {restaurant.isOpen && restaurant.isOpenToday ? 'Dang mo cua' : 'Da dong cua'}
                </span>
                {canManageRestaurant ? (
                  <span className={`approval-tag ${restaurant.approvalStatus.toLowerCase()}`}>{approvalLabel(restaurant.approvalStatus)}</span>
                ) : null}
              </div>

              <dl className="restaurant-detail-list">
                {canManageRestaurant ? (
                  <div>
                    <dt>Owner ID</dt>
                    <dd>{restaurant.ownerId}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Dia chi</dt>
                  <dd>{restaurant.address || 'Chua co dia chi'}</dd>
                </div>
                <div>
                  <dt>Gio mo cua</dt>
                  <dd>
                    {formatTime(restaurant.openingTime)} - {formatTime(restaurant.closingTime)}
                  </dd>
                </div>
                {canManageRestaurant ? (
                  <div>
                    <dt>Trang thai hom nay</dt>
                    <dd>{restaurant.isOpenToday ? 'Mo trong hom nay' : restaurant.temporaryClosedReason || 'Dong trong hom nay'}</dd>
                  </div>
                ) : null}
                {canManageRestaurant && restaurant.temporaryClosedUntil ? (
                  <div>
                    <dt>Dong den</dt>
                    <dd>{new Date(restaurant.temporaryClosedUntil).toLocaleString('vi-VN')}</dd>
                  </div>
                ) : null}
                {canManageRestaurant ? (
                  <div>
                    <dt>Duyet hien thi</dt>
                    <dd>{approvalLabel(restaurant.approvalStatus)}</dd>
                  </div>
                ) : null}
                {canManageRestaurant && restaurant.rejectReason ? (
                  <div>
                    <dt>Ly do tu choi</dt>
                    <dd>{restaurant.rejectReason}</dd>
                  </div>
                ) : null}
                {canManageRestaurant ? (
                  <div>
                    <dt>Toa do</dt>
                    <dd>
                      {restaurant.latitude}, {restaurant.longitude}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </article>

          <aside className="restaurant-map-card">
            <h2>Vi tri nha hang</h2>
            <div className="map-wrap" role="img" aria-label={`Ban do cua ${restaurant.name}`}>
              <MapContainer center={position} zoom={15} scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={position}>
                  <Popup>
                    <strong>{restaurant.name}</strong>
                    <br />
                    {restaurant.address || 'Chua co dia chi'}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  )
}
