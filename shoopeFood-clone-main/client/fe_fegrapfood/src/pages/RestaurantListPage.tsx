import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  approveRestaurant,
  approveRestaurantChangeRequest,
  deleteRestaurant,
  getAllRestaurantsForAdmin,
  getMyRestaurants,
  getRestaurants,
  getRestaurantChangeRequests,
  patchRestaurantStatus,
  patchRestaurantTodayStatus,
  rejectRestaurant,
  rejectRestaurantChangeRequest,
} from '../services/api/restaurants'
import type { Restaurant, RestaurantChangeRequest } from '../types'

function formatTime(value: string) {
  return value?.slice(0, 5) || '--:--'
}

const fallbackRestaurantImage =
  'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85'

function approvalLabel(status: Restaurant['approvalStatus']) {
  if (status === 'APPROVED') return 'Da duyet'
  if (status === 'REJECTED') return 'Bi tu choi'
  return 'Cho duyet'
}

export default function RestaurantListPage() {
  useDocumentTitle(`${APP_NAME} | Restaurants`)
  const { hasRole, user } = useAuth()
  const isAdmin = hasRole(['ADMIN'])
  const isMerchant = hasRole(['MERCHANT'])
  const canOperateRestaurants = isAdmin || isMerchant

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [changeRequests, setChangeRequests] = useState<RestaurantChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actionKey, setActionKey] = useState<string | null>(null)

  useEffect(() => {
    void loadRestaurants()
  }, [isAdmin, isMerchant, user?.id])

  async function loadRestaurants() {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const [restaurantData, requestData] = isAdmin
        ? await Promise.all([getAllRestaurantsForAdmin(), getRestaurantChangeRequests()])
        : isMerchant && user
          ? await Promise.all([getMyRestaurants(user.id), Promise.resolve([])])
          : await Promise.all([getRestaurants(), Promise.resolve([])])
      setRestaurants(restaurantData)
      setChangeRequests(requestData)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai danh sach nha hang')
    } finally {
      setIsLoading(false)
    }
  }

  async function runRestaurantAction(key: string, action: () => Promise<Restaurant>, message: string) {
    try {
      setActionKey(key)
      setErrorMessage(null)
      setSuccessMessage(null)
      const updated = await action()
      setRestaurants((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setSuccessMessage(message)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Thao tac that bai')
    } finally {
      setActionKey(null)
    }
  }

  async function handleDelete(restaurant: Restaurant) {
    if (!window.confirm(`Xoa nha hang "${restaurant.name}"?`)) {
      return
    }

    try {
      setActionKey(`delete-${restaurant.id}`)
      setErrorMessage(null)
      setSuccessMessage(null)
      await deleteRestaurant(restaurant.id)
      setRestaurants((current) => current.filter((item) => item.id !== restaurant.id))
      setSuccessMessage(`Da xoa nha hang #${restaurant.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the xoa nha hang')
    } finally {
      setActionKey(null)
    }
  }

  async function handleRejectRestaurant(restaurant: Restaurant) {
    const reason = window.prompt('Ly do tu choi nha hang?', restaurant.rejectReason || 'Thong tin chua hop le')
    if (reason === null) {
      return
    }

    await runRestaurantAction(`reject-${restaurant.id}`, () => rejectRestaurant(restaurant.id, reason), `Da tu choi nha hang #${restaurant.id}`)
  }

  async function handleToggleToday(restaurant: Restaurant) {
    if (restaurant.approvalStatus !== 'APPROVED') {
      setErrorMessage('Chi co the thay doi trang thai khi nha hang da duoc duyet')
      return
    }

    const nextStatus = !restaurant.isOpenToday
    const reason = nextStatus ? undefined : window.prompt('Ly do dong cua trong hom nay?', restaurant.temporaryClosedReason || '') || undefined
    await runRestaurantAction(
      `today-${restaurant.id}`,
      () => patchRestaurantTodayStatus(restaurant.id, nextStatus, reason),
      `Da cap nhat trang thai hom nay cho #${restaurant.id}`,
    )
  }

  async function handleChangeRequest(id: number, approve: boolean) {
    const reason = approve ? undefined : window.prompt('Ly do tu choi yeu cau sua?', 'Thong tin thay doi chua hop le')
    if (!approve && reason === null) {
      return
    }

    try {
      setActionKey(`request-${id}`)
      setErrorMessage(null)
      setSuccessMessage(null)
      if (approve) {
        await approveRestaurantChangeRequest(id)
      } else {
        await rejectRestaurantChangeRequest(id, reason || '')
      }
      setSuccessMessage(approve ? 'Da duyet yeu cau sua' : 'Da tu choi yeu cau sua')
      await loadRestaurants()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the xu ly yeu cau sua')
    } finally {
      setActionKey(null)
    }
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <h1>{canOperateRestaurants ? 'Quan ly nha hang' : 'Nha hang'}</h1>
          <p>
            {isAdmin
              ? 'Admin xem tat ca nha hang, duyet nha hang moi va xu ly yeu cau sua thong tin.'
              : isMerchant
                ? 'Chu nha hang chi xem va quan ly cac nha hang thuoc tai khoan dang dang nhap.'
              : 'Khach hang chi xem nha hang da duyet va trang thai dang mo/dong cua.'}
          </p>
        </div>

        {canOperateRestaurants ? (
          <Link to="/restaurants/create" className="button-primary">
            Them nha hang
          </Link>
        ) : null}
      </div>

      <div className="restaurant-panel">
        <div className="restaurant-toolbar">
          <div>
            <h2>Danh sach nha hang</h2>
            <div className="restaurant-count">{isLoading ? 'Dang tai...' : `${restaurants.length} nha hang`}</div>
          </div>

          <button type="button" className="button-secondary" onClick={() => void loadRestaurants()} disabled={isLoading}>
            Reload
          </button>
        </div>

        {errorMessage ? <p className="restaurant-feedback error">{errorMessage}</p> : null}
        {successMessage ? <p className="restaurant-feedback success">{successMessage}</p> : null}

        <div className="restaurant-grid">
          {restaurants.map((restaurant) => (
            <article key={restaurant.id} className="restaurant-manage-card">
              <div className="restaurant-manage-top">
                <span className="restaurant-manage-id">ID #{restaurant.id}</span>
                {canOperateRestaurants ? (
                  <span className={`approval-tag ${restaurant.approvalStatus.toLowerCase()}`}>{approvalLabel(restaurant.approvalStatus)}</span>
                ) : null}
              </div>

              <h3>{restaurant.name}</h3>
              <p className="restaurant-manage-address">{restaurant.address || 'Chua co dia chi'}</p>

              <img
                src={restaurant.imageUrl || fallbackRestaurantImage}
                alt={restaurant.name}
                className="restaurant-manage-image"
              />

              <div className="restaurant-manage-meta">
                {isAdmin ? <span>Owner: {restaurant.ownerId}</span> : null}
                <span>Rating: {restaurant.ratingAvg.toFixed(2)}</span>
                <span>
                  {formatTime(restaurant.openingTime)} - {formatTime(restaurant.closingTime)}
                </span>
              </div>

              <div className="restaurant-chip-row">
                {canOperateRestaurants ? (
                  <>
                    <span className={`status-tag ${restaurant.isOpen ? 'open' : 'closed'}`}>{restaurant.isOpen ? 'Dang mo' : 'Dang dong'}</span>
                    <span className={`status-tag ${restaurant.isOpenToday ? 'open' : 'closed'}`}>
                      {restaurant.isOpenToday ? 'Mo hom nay' : 'Dong hom nay'}
                    </span>
                  </>
                ) : (
                  <span className={`status-tag ${restaurant.isOpen && restaurant.isOpenToday ? 'open' : 'closed'}`}>
                    {restaurant.isOpen && restaurant.isOpenToday ? 'Dang mo cua' : 'Da dong cua'}
                  </span>
                )}
              </div>

              {canOperateRestaurants && !restaurant.isOpenToday && restaurant.temporaryClosedReason ? (
                <p className="restaurant-location">Ly do: {restaurant.temporaryClosedReason}</p>
              ) : null}

              {isAdmin ? (
                <p className="restaurant-location">
                  Lat: {restaurant.latitude.toFixed(6)} | Lng: {restaurant.longitude.toFixed(6)}
                </p>
              ) : null}

              <div className="restaurant-actions">
                <Link to={`/restaurants/${restaurant.id}`} className="button-secondary">
                  Chi tiet
                </Link>
                {canOperateRestaurants ? (
                  <>
                    <Link to={`/restaurants/edit/${restaurant.id}`} className="button-secondary">
                      Sua
                    </Link>
                    {restaurant.approvalStatus === 'APPROVED' ? (
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() =>
                          void runRestaurantAction(
                            `status-${restaurant.id}`,
                            () => patchRestaurantStatus(restaurant.id, !restaurant.isOpen),
                            `Da cap nhat mo/dong cua #${restaurant.id}`,
                          )
                        }
                        disabled={actionKey === `status-${restaurant.id}`}
                      >
                        {restaurant.isOpen ? 'Dong cua' : 'Mo cua'}
                      </button>
                    ) : (
                      <span className="restaurant-note">Chỉ thay đổi trạng thái khi đã duyệt</span>
                    )}
                    {isAdmin && restaurant.approvalStatus === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          className="button-primary"
                          onClick={() =>
                            void runRestaurantAction(
                              `approve-${restaurant.id}`,
                              () => approveRestaurant(restaurant.id),
                              `Da duyet nha hang #${restaurant.id}`,
                            )
                          }
                          disabled={actionKey === `approve-${restaurant.id}`}
                        >
                          Duyet
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => void handleRejectRestaurant(restaurant)}
                          disabled={actionKey === `reject-${restaurant.id}`}
                        >
                          Tu choi
                        </button>
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="button-danger"
                      onClick={() => void handleDelete(restaurant)}
                      disabled={actionKey === `delete-${restaurant.id}`}
                    >
                      Xoa
                    </button>
                  </>
                ) : null}
              </div>
            </article>
          ))}

          {!isLoading && restaurants.length === 0 ? <p className="empty-state">Chua co nha hang nao tu backend.</p> : null}
        </div>
      </div>

      {isAdmin ? (
      <section className="restaurant-panel">
        <div className="restaurant-toolbar">
          <div>
            <h2>Yeu cau sua thong tin</h2>
            <div className="restaurant-count">{changeRequests.length} yeu cau dang cho duyet</div>
          </div>
        </div>

        <div className="restaurant-review-list">
          {changeRequests.map((request) => (
            <article key={request.id} className="restaurant-review-item">
              <div>
                <strong>Restaurant #{request.restaurantId}</strong>
                <pre>{JSON.stringify(request.payload, null, 2)}</pre>
              </div>
              <div className="restaurant-actions">
                <button
                  type="button"
                  className="button-primary"
                  onClick={() => void handleChangeRequest(request.id, true)}
                  disabled={actionKey === `request-${request.id}`}
                >
                  Duyet sua
                </button>
                <button
                  type="button"
                  className="button-danger"
                  onClick={() => void handleChangeRequest(request.id, false)}
                  disabled={actionKey === `request-${request.id}`}
                >
                  Tu choi
                </button>
              </div>
            </article>
          ))}

          {!isLoading && changeRequests.length === 0 ? <p className="empty-state">Khong co yeu cau sua dang cho duyet.</p> : null}
        </div>
      </section>
      ) : null}
    </section>
  )
}
