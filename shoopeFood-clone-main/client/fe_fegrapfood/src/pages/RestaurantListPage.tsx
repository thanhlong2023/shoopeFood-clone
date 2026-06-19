import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import {
  deleteRestaurant,
  getRestaurants,
  getAllRestaurantsForAdmin,
  getMyRestaurants,
  getPendingRestaurants,
  approveRestaurant,
  rejectRestaurant,
  getRestaurantChangeRequests,
  approveRestaurantChangeRequest,
  rejectRestaurantChangeRequest,
  patchRestaurantTodayStatus,
} from '../services/api/restaurants'
import { restaurantThumbStyle } from '../utils/restaurantImage'
import type { Restaurant, RestaurantChangeRequest } from '../types'

function formatCoordinate(value: number) {
  return Number.isFinite(value) ? value.toFixed(6) : '0.000000'
}

function formatDateTime(dateString: string | null | undefined) {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('vi-VN')
}

export default function RestaurantListPage() {
  useDocumentTitle(`${APP_NAME} | Restaurants`)
  const { user } = useAuth()
  const location = useLocation()

  const [activeTab, setActiveTab] = useState<'list' | 'pending' | 'changeRequests'>('list')
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [pendingRestaurants, setPendingRestaurants] = useState<Restaurant[]>([])
  const [changeRequests, setChangeRequests] = useState<RestaurantChangeRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [actioningId, setActioningId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')
  const [showRejectModal, setShowRejectModal] = useState<number | null>(null)
  const [showTodayStatusModal, setShowTodayStatusModal] = useState<number | null>(null)
  const [todayStatusData, setTodayStatusData] = useState({ reason: '', until: '' })

  const isAdmin = user?.role === 'ADMIN'
  const isMerchant = user?.role === 'MERCHANT'

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      if (activeTab === 'list') {
        const items = isAdmin ? await getAllRestaurantsForAdmin() : isMerchant ? await getMyRestaurants() : await getRestaurants()
        setRestaurants(items)
      } else if (activeTab === 'pending' && isAdmin) {
        const items = await getPendingRestaurants()
        setPendingRestaurants(items)
      } else if (activeTab === 'changeRequests' && isAdmin) {
        const items = await getRestaurantChangeRequests('PENDING')
        setChangeRequests(items)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, isAdmin, isMerchant])

  useEffect(() => {
    void loadData()
  }, [loadData, location.key])

  async function handleDelete(restaurant: Restaurant) {
    const confirmed = window.confirm(`Xoá nhà hàng "${restaurant.name}"?`)
    if (!confirmed) return

    try {
      setActioningId(restaurant.id)
      await deleteRestaurant(restaurant.id)
      setSuccessMessage(`Đã xoá nhà hàng "${restaurant.name}"`)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xoá nhà hàng')
    } finally {
      setActioningId(null)
    }
  }

  async function handleApproveRestaurant(restaurantId: number) {
    try {
      setActioningId(restaurantId)
      await approveRestaurant(restaurantId, user?.id)
      setSuccessMessage('Đã phê duyệt nhà hàng')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể phê duyệt')
    } finally {
      setActioningId(null)
    }
  }

  async function handleRejectRestaurant(restaurantId: number) {
    try {
      setActioningId(restaurantId)
      await rejectRestaurant(restaurantId, rejectReason)
      setSuccessMessage('Đã từ chối nhà hàng')
      setRejectReason('')
      setShowRejectModal(null)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể từ chối')
    } finally {
      setActioningId(null)
    }
  }
  async function handleToggleTodayStatus(restaurantId: number) {
    try {
      setActioningId(restaurantId)
      const restaurant = restaurants.find((r) => r.id === restaurantId)
      if (restaurant) {
        await patchRestaurantTodayStatus(
          restaurantId,
          !restaurant.isOpenToday,
          todayStatusData.reason || undefined,
          todayStatusData.until || undefined,
        )
        setSuccessMessage('Đã cập nhật trạng thái hôm nay')
        setTodayStatusData({ reason: '', until: '' })
        setShowTodayStatusModal(null)
        await loadData()
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật')
    } finally {
      setActioningId(null)
    }
  }

  async function handleApproveChangeRequest(requestId: number) {
    try {
      setActioningId(requestId)
      await approveRestaurantChangeRequest(requestId, user?.id)
      setSuccessMessage('Đã phê duyệt yêu cầu thay đổi')
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể phê duyệt')
    } finally {
      setActioningId(null)
    }
  }

  async function handleRejectChangeRequest(requestId: number) {
    try {
      setActioningId(requestId)
      await rejectRestaurantChangeRequest(requestId, rejectReason)
      setSuccessMessage('Đã từ chối yêu cầu thay đổi')
      setRejectReason('')
      setShowRejectModal(null)
      await loadData()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể từ chối')
    } finally {
      setActioningId(null)
    }
  }

  return (
    <section className="restaurant-page">
      <div className="restaurant-page-header">
        <div>
          <h1>Quản lý nhà hàng</h1>
          <p>Admin tao quan cho chủ quán. Quan tu dong duyệt va hien cho khách dat mon.</p>
        </div>

        {isAdmin ? (
          <Link to="/restaurants/new" className="button-primary">
            Tạo quán cho chủ quán
          </Link>
        ) : null}
      </div>

      <div className="restaurant-panel">
        {/* Tabs */}
        <div className="restaurant-tabs">
          <button
            className={`tab-button ${activeTab === 'list' ? 'active' : ''}`}
            onClick={() => setActiveTab('list')}
          >
            Danh sách ({restaurants.length})
          </button>
          {isAdmin && (
            <>
              <button
                className={`tab-button ${activeTab === 'pending' ? 'active' : ''}`}
                onClick={() => setActiveTab('pending')}
              >
                Chờ phê duyệt ({pendingRestaurants.length})
              </button>
              <button
                className={`tab-button ${activeTab === 'changeRequests' ? 'active' : ''}`}
                onClick={() => setActiveTab('changeRequests')}
              >
                Yêu cầu thay đổi ({changeRequests.length})
              </button>
            </>
          )}
        </div>

        {errorMessage && <p className="restaurant-feedback error">{errorMessage}</p>}
        {successMessage && <p className="restaurant-feedback success">{successMessage}</p>}

        <button
          type="button"
          className="button-secondary"
          onClick={() => void loadData()}
          disabled={isLoading}
          style={{ marginBottom: '1rem' }}
        >
          {isLoading ? 'Đang tải...' : 'Làm mới'}
        </button>

        {/* Restaurants List Tab */}
        {activeTab === 'list' && (
          <div className="restaurant-grid">
            {restaurants.map((restaurant) => (
              <article key={restaurant.id} className="restaurant-manage-card">
                <Link
                  to={`/restaurants/${restaurant.id}`}
                  className={`restaurant-manage-photo ${restaurantThumbStyle(restaurant.imageUrl, restaurant.id) ? '' : 'restaurant-manage-photo--placeholder'}`}
                  style={restaurantThumbStyle(restaurant.imageUrl, restaurant.id)}
                  aria-label={`Xem chi tiết ${restaurant.name}`}
                />

                <div className="restaurant-manage-top">
                  <span className="restaurant-manage-id">ID #{restaurant.id}</span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <span className={`status-tag ${restaurant.isOpen ? 'open' : 'closed'}`}>
                      {restaurant.isOpen ? 'Mở' : 'Đóng'}
                    </span>
                    {restaurant.approvalStatus && (
                      <span className={`approval-tag approval-${restaurant.approvalStatus.toLowerCase()}`}>
                        {restaurant.approvalStatus === 'PENDING'
                          ? 'Chờ duyệt'
                          : restaurant.approvalStatus === 'APPROVED'
                            ? 'Đã duyệt'
                            : 'Bị từ chối'}
                      </span>
                    )}
                  </div>
                </div>

                <h3>{restaurant.name}</h3>
                <p className="restaurant-manage-address">{restaurant.address}</p>

                <div className="restaurant-manage-meta">
                  <span>Chủ: {restaurant.ownerId}</span>
                  <span>Đánh giá: {restaurant.ratingAvg.toFixed(2)}</span>
                </div>

                <div className="restaurant-manage-times">
                  <span>Mở: {restaurant.openingTime?.slice(0, 5) || '-'}</span>
                  <span>Đóng: {restaurant.closingTime?.slice(0, 5) || '-'}</span>
                </div>

                <p className="restaurant-location">
                  Lat: {formatCoordinate(restaurant.latitude)} | Lng: {formatCoordinate(restaurant.longitude)}
                </p>

                {restaurant.isOpenToday === false && (
                  <p className="restaurant-temp-closed">
                    ⚠️ Đóng tạm: {restaurant.temporaryClosedReason} (đến {formatDateTime(restaurant.temporaryClosedUntil)})
                  </p>
                )}

                <div className="restaurant-actions">
                  <Link to={`/restaurants/${restaurant.id}`} className="button-secondary">
                    Xem chi tiết
                  </Link>

                  {isAdmin && (
                    <>
                      <Link to={`/restaurants/${restaurant.id}/edit`} className="button-secondary">
                        Sửa
                      </Link>
                      <button
                        type="button"
                        className="button-danger"
                        onClick={() => void handleDelete(restaurant)}
                        disabled={actioningId === restaurant.id}
                      >
                        {actioningId === restaurant.id ? 'Đang xoá...' : 'Xoá'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}

            {!isLoading && restaurants.length === 0 && (
              <p className="empty-state">Không có nhà hàng nào</p>
            )}
          </div>
        )}

        {/* Pending Restaurants Tab */}
        {activeTab === 'pending' && isAdmin && (
          <div className="restaurant-grid">
            {pendingRestaurants.map((restaurant) => (
              <article key={restaurant.id} className="restaurant-manage-card pending">
                <div className="restaurant-manage-top">
                  <span className="restaurant-manage-id">ID #{restaurant.id}</span>
                  <span className="approval-tag approval-pending">Chờ duyệt</span>
                </div>

                <h3>{restaurant.name}</h3>
                <p className="restaurant-manage-address">{restaurant.address}</p>

                <div className="restaurant-manage-meta">
                  <span>Chủ: {restaurant.ownerId}</span>
                </div>

                <div className="restaurant-actions">
                  <button
                    type="button"
                    className="button-success"
                    onClick={() => void handleApproveRestaurant(restaurant.id)}
                    disabled={actioningId === restaurant.id}
                  >
                    {actioningId === restaurant.id ? 'Đang phê duyệt...' : 'Phê duyệt'}
                  </button>

                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => setShowRejectModal(restaurant.id)}
                    disabled={actioningId === restaurant.id}
                  >
                    Từ chối
                  </button>
                </div>
              </article>
            ))}

            {!isLoading && pendingRestaurants.length === 0 && (
              <p className="empty-state">Không có nhà hàng nào chờ phê duyệt</p>
            )}
          </div>
        )}

        {/* Change Requests Tab */}
        {activeTab === 'changeRequests' && isAdmin && (
          <div className="change-requests-list">
            {changeRequests.map((request) => (
              <div key={request.id} className="change-request-card">
                <div className="change-request-header">
                  <h3>Yêu cầu #{request.id} - Nhà hàng #{request.restaurantId}</h3>
                  <span className="approval-tag approval-pending">Chờ duyệt</span>
                </div>

                <div className="change-request-payload">
                  <h4>Thay đổi:</h4>
                  <pre>{JSON.stringify(request.payload, null, 2)}</pre>
                </div>

                <div className="change-request-meta">
                  <span>Yêu cầu bởi: User #{request.requestedBy}</span>
                  <span>Tạo lúc: {formatDateTime(request.createdAt)}</span>
                </div>

                <div className="restaurant-actions">
                  <button
                    type="button"
                    className="button-success"
                    onClick={() => void handleApproveChangeRequest(request.id)}
                    disabled={actioningId === request.id}
                  >
                    {actioningId === request.id ? 'Đang phê duyệt...' : 'Phê duyệt'}
                  </button>

                  <button
                    type="button"
                    className="button-danger"
                    onClick={() => setShowRejectModal(request.id)}
                    disabled={actioningId === request.id}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}

            {!isLoading && changeRequests.length === 0 && (
              <p className="empty-state">Không có yêu cầu thay đổi nào chờ duyệt</p>
            )}
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Lý do từ chối</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Nhập lý do từ chối (tuỳ chọn)"
              style={{ width: '100%', minHeight: '100px', padding: '0.5rem' }}
            />
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="button-danger"
                onClick={() => {
                  if (activeTab === 'changeRequests') {
                    void handleRejectChangeRequest(showRejectModal)
                  } else {
                    void handleRejectRestaurant(showRejectModal)
                  }
                }}
              >
                Xác nhận từ chối
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setShowRejectModal(null)
                  setRejectReason('')
                }}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Today Status Modal */}
      {showTodayStatusModal && (
        <div className="modal-overlay" onClick={() => setShowTodayStatusModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Cập nhật trạng thái hôm nay</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label>
                Lý do đóng cửa (tuỳ chọn):
                <input
                  type="text"
                  value={todayStatusData.reason}
                  onChange={(e) => setTodayStatusData({ ...todayStatusData, reason: e.target.value })}
                  placeholder="vd: Sửa chữa, sự kiện..."
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </label>

              <label>
                Hết lý do lúc (tuỳ chọn):
                <input
                  type="datetime-local"
                  value={todayStatusData.until}
                  onChange={(e) => setTodayStatusData({ ...todayStatusData, until: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
                />
              </label>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className="button-success"
                onClick={() => void handleToggleTodayStatus(showTodayStatusModal)}
              >
                Cập nhật
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setShowTodayStatusModal(null)
                  setTodayStatusData({ reason: '', until: '' })
                }}
              >
                Huỷ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
