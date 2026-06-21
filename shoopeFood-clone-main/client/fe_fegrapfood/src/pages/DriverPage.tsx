import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getMyDriverOrderFeed, getMyCompletedOrders, updateDriverLocation } from '../services/api/drivers'
import { acceptOrder, getOrderTracking, updateOrderStatus } from '../services/api/orders'
import { createSocket } from '../services/socket'
import type { Driver, DriverCompletedDelivery, Order, OrderTracking, RouteLeg, RoutePoint } from '../types'

const SESSION_KEY_POINT = 'driver_last_point'
const SESSION_KEY_HEADING = 'driver_last_heading'

function savePointToSession(point: RoutePoint, heading: number) {
  try {
    sessionStorage.setItem(SESSION_KEY_POINT, JSON.stringify(point))
    sessionStorage.setItem(SESSION_KEY_HEADING, String(heading))
  } catch {/* ignore */}
}

function readPointFromSession(): { point: RoutePoint; heading: number } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY_POINT)
    if (!raw) return null
    const point = JSON.parse(raw) as RoutePoint
    const heading = Number(sessionStorage.getItem(SESSION_KEY_HEADING) || 0)
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return null
    return { point, heading }
  } catch { return null }
}

function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <span className="driver-star-rating" aria-label={`${rating} sao`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < Math.round(rating) ? 'star filled' : 'star'}>
          ★
        </span>
      ))}
    </span>
  )
}

const defaultCenter: [number, number] = [10.7769, 106.7009]
const NEARBY_RADIUS_KM = 10
const activeLocationStatuses = new Set(['DRIVER_ACCEPTED', 'PICKING_UP', 'DELIVERING'])

function haversineKm(from: RoutePoint, to: { latitude?: number; longitude?: number }) {
  const lat2 = Number(to.latitude)
  const lon2 = Number(to.longitude)
  if (!Number.isFinite(lat2) || !Number.isFinite(lon2)) {
    return Number.POSITIVE_INFINITY
  }

  const toRad = (value: number) => (value * Math.PI) / 180
  const dLat = toRad(lat2 - from.latitude)
  const dLon = toRad(lon2 - from.longitude)
  const lat1 = toRad(from.latitude)
  const lat2Rad = toRad(lat2)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function advanceAlongPolyline(
  startPoint: RoutePoint,
  polyline: RoutePoint[],
  startIndex: number,
  distanceKmToMove: number
): { point: RoutePoint, index: number, reachedEnd: boolean, heading: number } {
  if (!polyline || polyline.length === 0) return { point: startPoint, index: startIndex, reachedEnd: true, heading: 0 };
  
  let currentP = startPoint;
  let currentIndex = startIndex;
  let distLeft = distanceKmToMove;
  let heading = 0;

  while (distLeft > 0 && currentIndex < polyline.length - 1) {
    const nextP = polyline[currentIndex + 1];
    const segmentDist = haversineKm(currentP, nextP);
    
    if (segmentDist <= 0.001) {
      currentIndex++;
      continue;
    }

    if (distLeft >= segmentDist) {
      distLeft -= segmentDist;
      heading = calculateHeading(currentP, nextP);
      currentP = nextP;
      currentIndex++;
    } else {
      const fraction = distLeft / segmentDist;
      heading = calculateHeading(currentP, nextP);
      const newLat = currentP.latitude + (nextP.latitude - currentP.latitude) * fraction;
      const newLng = currentP.longitude + (nextP.longitude - currentP.longitude) * fraction;
      currentP = { latitude: newLat, longitude: newLng };
      distLeft = 0;
      break;
    }
  }

  return {
    point: currentP,
    index: currentIndex,
    reachedEnd: currentIndex >= polyline.length - 1 && distLeft >= 0,
    heading
  };
}

function filterNearbyOrders(orders: Order[], point: RoutePoint | null, radiusKm = NEARBY_RADIUS_KM) {
  if (!point) {
    return []
  }

  return orders.filter((order) => {
    const restaurant = order.restaurant
    if (!restaurant?.latitude || !restaurant?.longitude) {
      return false
    }
    return haversineKm(point, restaurant) <= radiusKm
  })
}

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function formatDistance(value?: number) {
  if (!value) return '-'
  return `${value.toFixed(1)} km`
}

function formatDuration(value?: number) {
  if (!value) return '-'
  return `${Math.round(value)} phút`
}

function statusText(order: Order | null) {
  if (!order) return '-'
  return order.statusLabel || order.statusCode || '-'
}

function toLatLng(point: RoutePoint): [number, number] {
  return [point.latitude, point.longitude]
}

function calculateHeading(from: RoutePoint, to: RoutePoint) {
  return (Math.atan2(to.longitude - from.longitude, to.latitude - from.latitude) * 180) / Math.PI
}

function makeDriverMotoIcon(heading = 0) {
  return L.divIcon({
    className: 'moto-marker driver-moto-marker',
    html: `
      <div class="moto-pin driver-moto" style="--heading:${heading}deg">
        <svg viewBox="0 0 64 44" aria-hidden="true">
          <circle cx="16" cy="32" r="8"></circle>
          <circle cx="48" cy="32" r="8"></circle>
          <path d="M18 32h12l8-13h8l6 13"></path>
          <path d="M29 32l-7-14h12l6 14"></path>
          <path d="M41 18h10l5-5"></path>
          <path d="M26 12h11"></path>
        </svg>
      </div>
    `,
    iconSize: [54, 42],
    iconAnchor: [27, 31],
  })
}

function makePinIcon(className: string, label: string) {
  return L.divIcon({
    className: `tracking-pin ${className}`,
    html: `<span>${label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  })
}

function DriverMapFit({ points }: { points: RoutePoint[] }) {
  const map = useMap()

  useEffect(() => {
    const validPoints = points.filter((point) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    if (validPoints.length === 0) {
      return
    }

    map.fitBounds(L.latLngBounds(validPoints.map(toLatLng)), { padding: [32, 32], maxZoom: 15 })
  }, [map, points])

  return null
}

function RouteLegSummary({ leg }: { leg: RouteLeg }) {
  return (
    <div className="driver-route-leg">
      <div>
        <strong>{leg.label}</strong>
        <span>{leg.ok ? `${formatDistance(leg.distanceKm)} - ${formatDuration(leg.durationMinutes)}` : leg.error || 'Chưa có lộ trình'}</span>
      </div>
      <ol>
        {(leg.steps || []).slice(0, 5).map((step, index) => (
          <li key={`${leg.key}-${index}`}>
            {step.instruction}
            {step.name ? ` - ${step.name}` : ''}
          </li>
        ))}
      </ol>
    </div>
  )
}

export default function DriverPage() {
  useDocumentTitle(`${APP_NAME} | Tài xế`)
  const navigate = useNavigate()
  const { user } = useAuth()
  const driverId = user?.id ?? null

  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const sessionSeed = useRef(readPointFromSession())
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(sessionSeed.current?.point ?? null)
  const [heading, setHeading] = useState(sessionSeed.current?.heading ?? 0)
  const [gpsStatus, setGpsStatus] = useState('Đang lấy vị trí GPS...')
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(true)
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live')
  const [completedOrders, setCompletedOrders] = useState<DriverCompletedDelivery[]>([])
  const [completedTotal, setCompletedTotal] = useState(0)
  const [completedPage, setCompletedPage] = useState(1)
  const [isLoadingCompleted, setIsLoadingCompleted] = useState(false)
  const [selectedReview, setSelectedReview] = useState<DriverCompletedDelivery | null>(null)
  const lastGpsPointRef = useRef<RoutePoint | null>(null)
  const simulationReachedRef = useRef<Record<string, boolean>>({})
  const simStateRef = useRef<{ stateKey: string; index: number; point: RoutePoint | null }>({ stateKey: '', index: 0, point: null })

  const nearbyAvailableOrders = useMemo(
    () => filterNearbyOrders(availableOrders, currentPoint),
    [availableOrders, currentPoint],
  )
  const isShowingAllConfirmed = !currentPoint || (availableOrders.length > 0 && nearbyAvailableOrders.length === 0)
  const visibleAvailableOrders = isShowingAllConfirmed ? availableOrders : nearbyAvailableOrders
  const allOrders = useMemo(() => [...myOrders, ...visibleAvailableOrders], [myOrders, visibleAvailableOrders])
  const activeOrder = useMemo(
    () => allOrders.find((order) => order.id === activeOrderId) || tracking?.order || null,
    [activeOrderId, allOrders, tracking],
  )
  const hasActiveDelivery = useMemo(
    () => myOrders.some((order) => order.statusCode != null && activeLocationStatuses.has(order.statusCode)),
    [myOrders],
  )
  const routeLegs = tracking?.route?.legs || []
  const routePolylinePoints = useMemo(() => routeLegs.flatMap((leg) => leg.geometry || []), [routeLegs])
  const mapPoints = useMemo(() => {
    const points = [...routePolylinePoints]
    if (currentPoint) points.push(currentPoint)
    if (tracking?.restaurant) points.push(tracking.restaurant)
    if (tracking?.destination) points.push(tracking.destination)
    return points
  }, [currentPoint, routePolylinePoints, tracking])
  const mapCenter = currentPoint ? toLatLng(currentPoint) : mapPoints[0] ? toLatLng(mapPoints[0]) : defaultCenter
  const isSelectedMine = Boolean(driverId && activeOrder?.driverId === driverId)
  const isAtRestaurant = tracking?.restaurant && currentPoint ? haversineKm(currentPoint, tracking.restaurant) <= 0.2 : false
  const isAtCustomer = tracking?.destination && currentPoint ? haversineKm(currentPoint, tracking.destination) <= 0.2 : false

  const canAcceptSelected = Boolean(activeOrder && !activeOrder.driverId && activeOrder.statusCode === 'CONFIRMED')
  const canStartPickup = Boolean(isSelectedMine && activeOrder?.statusCode === 'DRIVER_ACCEPTED')
  const canStartDelivery = Boolean(isSelectedMine && activeOrder?.statusCode === 'PICKING_UP' && isAtRestaurant)
  const canCompleteDelivery = Boolean(isSelectedMine && activeOrder?.statusCode === 'DELIVERING' && isAtCustomer)

  const loadTracking = useCallback(async (orderId: number, quiet = false) => {
    try {
      if (!quiet) setErrorMessage(null)
      const data = await getOrderTracking(orderId)
      setTracking(data)
      setCurrentPoint((prev) => {
        if (!prev) {
          if (data.driverLocation) {
            setHeading(data.driverLocation.heading || 0)
            return { latitude: data.driverLocation.latitude, longitude: data.driverLocation.longitude }
          } else if (data.route?.legs?.[0]?.geometry?.[0]) {
            setHeading(0)
            return data.route.legs[0].geometry[0]
          } else if (lastGpsPointRef.current) {
            return lastGpsPointRef.current
          }
        }
        return prev
      })
    } catch (error) {
      if (!quiet) setErrorMessage(error instanceof Error ? error.message : 'Không thể tải tracking')
    }
  }, [])

  const loadCompletedOrders = useCallback(async (page: number) => {
    try {
      setIsLoadingCompleted(true)
      const result = await getMyCompletedOrders(page, 20)
      setCompletedOrders((prev) => page === 1 ? result.items : [...prev, ...result.items])
      setCompletedTotal(result.total)
      setCompletedPage(page)
    } catch {
      // silently fail – non-critical
    } finally {
      setIsLoadingCompleted(false)
    }
  }, [])

  const loadFeed = useCallback(async () => {
    try {
      setIsLoading(true)
      setErrorMessage(null)
      const feed = await getMyDriverOrderFeed()
      setDriver(feed.driver)
      setAvailableOrders(feed.available)
      setMyOrders(feed.active)

      setActiveOrderId((current) => {
        const visibleAvailable = lastGpsPointRef.current
          ? filterNearbyOrders(feed.available, lastGpsPointRef.current)
          : feed.available
        if (current && [...feed.active, ...visibleAvailable].some((order) => order.id === current)) {
          return current
        }
        return feed.active[0]?.id ?? visibleAvailable[0]?.id ?? null
      })
      // Proactively refresh completed list to ensure sync
      void loadCompletedOrders(1)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tải bảng tài xế')
    } finally {
      setIsLoading(false)
    }
  }, [loadCompletedOrders])

  useEffect(() => {
    void loadFeed()
    void loadCompletedOrders(1)
  }, [loadFeed, loadCompletedOrders])

  useEffect(() => {
    if (!activeOrderId) {
      setTracking(null)
      return
    }

    void loadTracking(activeOrderId)
  }, [activeOrderId, loadTracking])

  useEffect(() => {
    if (!driverId || !navigator.geolocation) {
      setGpsStatus('Trình nhúng không hỗ trợ GPS, dùng vị trí cuối cùng nếu có.')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const nextPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        const previousPoint = lastGpsPointRef.current
        const nextHeading =
          Number.isFinite(position.coords.heading) && position.coords.heading !== null
            ? Number(position.coords.heading)
            : previousPoint
              ? calculateHeading(previousPoint, nextPoint)
              : heading
        const activeOrderForLocation = activeOrder?.driverId === driverId && activeLocationStatuses.has(activeOrder.statusCode || '')

        lastGpsPointRef.current = nextPoint
        if (!isSimulating) {
          setCurrentPoint(nextPoint)
          setHeading(nextHeading)
          savePointToSession(nextPoint, nextHeading)
          setGpsStatus('GPS đang cập nhật')

          void updateDriverLocation(driverId, {
            ...(activeOrderForLocation ? { orderId: activeOrder.id } : {}),
            latitude: nextPoint.latitude,
            longitude: nextPoint.longitude,
            heading: nextHeading,
            speedKmh: Number.isFinite(position.coords.speed) && position.coords.speed ? Number(position.coords.speed) * 3.6 : 28,
          }).catch((error) => {
            setGpsStatus(error instanceof Error ? error.message : 'Không thể gửi vị trí')
          })
        }
      },
      () => {
        setGpsStatus('Chưa được cấp quyền GPS, dùng vị trí cuối cùng trên hệ thống.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [activeOrder, driverId, heading, isSimulating])

  useEffect(() => {
    if (!isSimulating || !activeOrder || !tracking || !driverId || !currentPoint) return;

    const isToMerchant = activeOrder.statusCode === 'DRIVER_ACCEPTED' || activeOrder.statusCode === 'PICKING_UP';
    const isToCustomer = activeOrder.statusCode === 'DELIVERING';

    if (!isToMerchant && !isToCustomer) return;

    const legKey = isToMerchant ? 'driver_to_restaurant' : 'restaurant_to_customer';
    const leg = tracking.route?.legs?.find((l: any) => l.key === legKey);
    const polyline = leg?.geometry || [];
    
    if (polyline.length === 0) return;

    const stateKey = `${activeOrder.id}-${legKey}`;
    if (simStateRef.current.stateKey !== stateKey) {
      simStateRef.current = {
        stateKey,
        index: 0,
        point: polyline[0] || currentPoint
      };
    }

    const timer = setTimeout(() => {
      // Di chuyển 0.2km mỗi 2s (tương đương 1km mỗi 10s)
      const result = advanceAlongPolyline(simStateRef.current.point || currentPoint, polyline, simStateRef.current.index, 0.2);
      
      simStateRef.current.point = result.point;
      simStateRef.current.index = result.index;

      setCurrentPoint(result.point);
      savePointToSession(result.point, result.heading || heading);
      if (result.heading) setHeading(result.heading);

      // Push to server
      updateDriverLocation(driverId, {
        orderId: activeOrder.id,
        latitude: result.point.latitude,
        longitude: result.point.longitude,
        heading: result.heading || 0,
        speedKmh: 72, // 0.2km / 2s = 0.1km/s = 360km/h (tốc độ theo yêu cầu mô phỏng)
      }).catch(console.error);

      if (result.reachedEnd) {
        if (!simulationReachedRef.current[stateKey]) {
          simulationReachedRef.current[stateKey] = true;
          if (isToMerchant) {
            setSuccessMessage('Đã tới cửa hàng! Vui lòng nhận món và bấm "Đã lấy món".');
          } else if (isToCustomer) {
            setSuccessMessage('Đã tới khách hàng! Vui lòng giao hàng và bấm "Hoàn thành".');
          }
        }
      }

    }, 2000);

    return () => clearTimeout(timer);
  }, [activeOrder?.id, activeOrder?.statusCode, tracking, driverId, currentPoint, isSimulating]);

  useEffect(() => {
    let isMounted = true
    let socket: Awaited<ReturnType<typeof createSocket>> | null = null

    const reloadFeed = () => {
      void loadFeed()
      if (activeOrderId) {
        void loadTracking(activeOrderId, true)
      }
    }

    void createSocket()
      .then((createdSocket) => {
        if (!isMounted) {
          createdSocket.disconnect()
          return
        }

        socket = createdSocket
        if (driverId) {
          socket.emit('driver:join', { driverId })
        }
        socket.on('new_order', reloadFeed)
        socket.on('order:updated', reloadFeed)
        socket.on('order:claimed', reloadFeed)
        socket.on('driver:order-offered', reloadFeed)
        socket.on('driver:order-updated', reloadFeed)
      })
      .catch(() => {
        // Manual reload and polling still work when Socket.io is unavailable.
      })

    return () => {
      isMounted = false
      if (socket) {
        if (driverId) {
          socket.emit('driver:leave', { driverId })
        }
        socket.off('new_order', reloadFeed)
        socket.off('order:updated', reloadFeed)
        socket.off('order:claimed', reloadFeed)
        socket.off('driver:order-offered', reloadFeed)
        socket.off('driver:order-updated', reloadFeed)
        socket.disconnect()
      }
    }
  }, [activeOrderId, driverId, loadFeed, loadTracking])

  async function handleAcceptOrder(order: Order) {
    if (hasActiveDelivery) {
      setErrorMessage('Bạn đang có đơn đang giao. Hoàn thành đơn hiện tại trước khi nhận đơn mới.')
      return
    }

    try {
      setIsActioning(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const updated = await acceptOrder(order.id)
      setSuccessMessage(`Đã nhận đơn ${updated.orderCode}`)
      setActiveOrderId(updated.id)
      await loadFeed()
      await loadTracking(updated.id)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể nhận đơn')
    } finally {
      setIsActioning(false)
    }
  }

  async function handleStatus(statusCode: string) {
    if (!activeOrder) return

    try {
      setIsActioning(true)
      setErrorMessage(null)
      const updated = await updateOrderStatus(activeOrder.id, statusCode, activeOrder.version)
      setSuccessMessage(`Đã cập nhật ${updated.orderCode}: ${updated.statusLabel || updated.statusCode}`)
      setActiveOrderId(updated.id)
      await loadFeed()
      await loadTracking(updated.id)
      if (statusCode === 'COMPLETED' || statusCode === 'CANCELLED') {
        void loadCompletedOrders(1)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái')
    } finally {
      setIsActioning(false)
    }
  }

  function renderOrderCard(order: Order, mode: 'available' | 'mine') {
    return (
      <article key={order.id} className={`driver-order-card ${order.id === activeOrderId ? 'active' : ''}`}>
        <button type="button" onClick={() => setActiveOrderId(order.id)}>
          <strong>{order.orderCode}</strong>
          <span>{order.restaurant?.name || `Quán #${order.restaurantId}`}</span>
          <small>{order.receiverAddress || `Đơn #${order.id}`} - {formatPrice(order.cashToCollect || order.totalAmount)} VND</small>
        </button>
        {mode === 'available' ? (
          <button
            type="button"
            className="button-primary"
            disabled={isActioning || hasActiveDelivery}
            onClick={() => void handleAcceptOrder(order)}
          >
            {hasActiveDelivery ? 'Đang giao đơn khác' : 'Nhận đơn'}
          </button>
        ) : null}
      </article>
    )
  }

  return (
    <section className="driver-page">
      <div className="driver-header">
        <div>
          <span className="hero-badge">Driver</span>
          <h1>Đơn hàng quánh bạn</h1>
          <p>{driver ? `${driver.fullName} - ${driver.licensePlate || driver.vehicleType}` : user?.fullName || 'Tài xế'}</p>
        </div>

        <div className="driver-gps-pill">
          <span>GPS</span>
          <strong>{isSimulating ? 'Giả lập đang bật' : gpsStatus}</strong>
          <button 
            className="ml-2 px-2 py-1 bg-gray-200 text-xs rounded" 
            onClick={() => setIsSimulating(!isSimulating)}
          >
            {isSimulating ? 'Tắt' : 'Bật'} giả lập
          </button>
        </div>
      </div>

      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}
      {successMessage ? <p className="restaurant-feedback success">{successMessage}</p> : null}

      {/* Tab switcher */}
      <div className="driver-tab-bar">
        <button
          type="button"
          className={`driver-tab-btn ${activeTab === 'live' ? 'active' : ''}`}
          onClick={() => setActiveTab('live')}
        >
          🚀 Giao hàng
        </button>
        <button
          type="button"
          className={`driver-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('history')
            if (completedOrders.length === 0) void loadCompletedOrders(1)
          }}
        >
          📦 Đơn đã giao
          {completedTotal > 0 ? <span className="driver-tab-badge">{completedTotal}</span> : null}
        </button>
      </div>

      {activeTab === 'live' ? (
      <div className="driver-layout">
        <aside className="driver-orders">
          <div className="driver-panel-head">
            <h2>
              {isLoading
                ? 'Đang tải...'
                : isShowingAllConfirmed
                  ? `${availableOrders.length} đơn đã xác nhận`
                  : `${nearbyAvailableOrders.length}/${availableOrders.length} đơn trong ${NEARBY_RADIUS_KM}km`}
            </h2>
            <button type="button" className="button-secondary" onClick={() => void loadFeed()} disabled={isLoading}>
              Tải lại đơn
            </button>
          </div>

          <div className="driver-order-list">
            <h3>{isShowingAllConfirmed ? 'Đơn mới đã xác nhận' : `Đơn mới gần bạn (${NEARBY_RADIUS_KM}km)`}</h3>
            {visibleAvailableOrders.map((order) => renderOrderCard(order, 'available'))}
            {!isLoading && visibleAvailableOrders.length === 0 ? (
              <p className="empty-state">
                {currentPoint
                  ? `Chưa có đơn mới trong bán kính ${NEARBY_RADIUS_KM}km. Nếu cần demo, kiểm tra tọa độ nhà hàng và vị trí tài xế.`
                  : 'Chưa có đơn CONFIRMED nào. Hãy cho merchant xác nhận đơn trước.'}
              </p>
            ) : null}

            <h3>Đơn của tôi</h3>
            {myOrders.map((order) => renderOrderCard(order, 'mine'))}
            {!isLoading && myOrders.length === 0 ? <p className="empty-state">Bạn chưa nhận đơn nào.</p> : null}
          </div>
        </aside>

        <main className="driver-map-card">
          <MapContainer center={mapCenter} zoom={14} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DriverMapFit points={mapPoints} />
            {routeLegs.map((leg) =>
              (leg.geometry || []).length > 0 ? (
                <Polyline
                  key={leg.key}
                  positions={(leg.geometry || []).map(toLatLng)}
                  pathOptions={{
                    color: leg.key === 'driver_to_restaurant' ? '#ff8a00' : '#00b14f',
                    weight: 6,
                    opacity: 0.78,
                  }}
                />
              ) : null,
            )}
            {tracking?.restaurant ? (
              <Marker position={[tracking.restaurant.latitude, tracking.restaurant.longitude]} icon={makePinIcon('restaurant-pin', 'R')}>
                <Popup>{tracking.restaurant.name}</Popup>
              </Marker>
            ) : null}
            {tracking?.destination ? (
              <Marker position={toLatLng(tracking.destination)} icon={makePinIcon('home-pin', 'H')}>
                <Popup>{tracking.order.receiverAddress}</Popup>
              </Marker>
            ) : null}
            {currentPoint ? (
              <Marker position={toLatLng(currentPoint)} icon={makeDriverMotoIcon(heading)}>
                <Popup>{driver?.fullName || 'Tài xế'}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </main>

        <aside className="driver-control-panel">
          <div className="driver-control-head">
            <span>Đơn đang chọn</span>
            <h2>{activeOrder?.orderCode || '-'}</h2>
            {activeOrder ? <strong className="driver-status-pill">{statusText(activeOrder)}</strong> : null}
            <p>{activeOrder?.receiverAddress || 'Chọn đơn để xem chi tiết'}</p>
          </div>

          {activeOrder ? (
            <>
              <div className="driver-detail-grid">
                <div>
                  <span>Nhà hàng</span>
                  <strong>{activeOrder.restaurant?.name || tracking?.restaurant?.name || `Quán #${activeOrder.restaurantId}`}</strong>
                </div>
                <div>
                  <span>Khách hàng</span>
                  <strong>{activeOrder.customerName || `Khách #${activeOrder.customerId}`}</strong>
                </div>
                <div>
                  <span>SĐT khách</span>
                  <strong>{activeOrder.customerPhone || '-'}</strong>
                </div>
                <div>
                  <span>Tiền cần thu</span>
                  <strong>{formatPrice(activeOrder.cashToCollect || activeOrder.totalAmount)} VND</strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong>{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
                </div>
                <div>
                  <span>Quãng đường</span>
                  <strong>{formatDistance(tracking?.route?.totalDistanceKm)}</strong>
                </div>
              </div>

              <div className="driver-actions-grid">
                {canAcceptSelected ? (
                  <button type="button" className="button-primary" onClick={() => void handleAcceptOrder(activeOrder)} disabled={isActioning}>
                    Nhận đơn
                  </button>
                ) : null}
                <button type="button" className="button-secondary" onClick={() => void handleStatus('PICKING_UP')} disabled={!canStartPickup || isActioning}>
                  Đang lấy hàng
                </button>
                <button type="button" className="button-primary" onClick={() => void handleStatus('DELIVERING')} disabled={!canStartDelivery || isActioning}>
                  {activeOrder?.statusCode === 'PICKING_UP' && !isAtRestaurant ? 'Đang giao (Đợi tới quán)' : 'Đang giao hàng'}
                </button>
                <button type="button" className="button-secondary" onClick={() => void handleStatus('COMPLETED')} disabled={!canCompleteDelivery || isActioning}>
                  {activeOrder?.statusCode === 'DELIVERING' && !isAtCustomer ? 'Hoàn thành (Đợi tới khách)' : 'Hoàn thành'}
                </button>
                <button type="button" className="button-danger" onClick={() => void handleStatus('CANCELLED')} disabled={!isSelectedMine || isActioning}>
                  Hủy đơn
                </button>
              </div>

              <div className="driver-route-list">
                {routeLegs.map((leg) => (
                  <RouteLegSummary key={leg.key} leg={leg} />
                ))}
                {tracking && routeLegs.length === 0 ? <p className="empty-state">Chưa có route OSRM cho đơn này.</p> : null}
              </div>

              <div className="driver-invoice-card">
                <div className="driver-invoice-head">
                  <div>
                    <span>Hóa đơn</span>
                    <h2>{activeOrder.orderCode}</h2>
                  </div>
                  <strong>{statusText(activeOrder)}</strong>
                </div>

                {activeOrder.note && (
                  <div className="mt-4 mx-4 p-3 bg-orange-50 border border-orange-100 rounded-xl">
                    <span className="block text-[10px] font-bold text-orange-800 uppercase tracking-wider mb-1">Ghi chú từ khách</span>
                    <p className="text-orange-900 text-sm font-medium">{activeOrder.note}</p>
                  </div>
                )}

                <div className="tracking-items">
                  <h2>Món cần lấy</h2>
                  {(activeOrder.items || []).length > 0 ? (
                    (activeOrder.items || []).map((item) => (
                      <div key={item.id} className="tracking-item driver-invoice-item">
                        <div>
                          <span>{item.quantity} x {item.foodName || `Mon #${item.foodId}`}</span>
                          <small>{formatPrice(item.priceAtOrder)} VND / món</small>
                        </div>
                        <strong>{formatPrice(item.lineTotal)} VND</strong>
                      </div>
                    ))
                  ) : (
                    <p className="empty-state">Đơn này chưa có chi tiết món trong dữ liệu trả về.</p>
                  )}
                </div>

                <div className="bill-box driver-invoice-totals">
                  <div>
                    <span>Tiền món</span>
                    <strong>{formatPrice(activeOrder.subtotalAmount)} VND</strong>
                  </div>
                  <div>
                    <span>Phí giao hàng</span>
                    <strong>{formatPrice(activeOrder.shippingFee)} VND</strong>
                  </div>
                  <div>
                    <span>Thuế</span>
                    <strong>{formatPrice(activeOrder.taxAmount)} VND</strong>
                  </div>
                  <div>
                    <span>Giảm giá</span>
                    <strong>-{formatPrice(activeOrder.discountAmount)} VND</strong>
                  </div>
                  <div className="bill-total">
                    <span>Tổng đơn</span>
                    <strong>{formatPrice(activeOrder.totalAmount)} VND</strong>
                  </div>
                  <div className="bill-total driver-cash-total">
                    <span>Tiền cần thu</span>
                    <strong>{formatPrice(activeOrder.cashToCollect || activeOrder.totalAmount)} VND</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="empty-state">Không có đơn đang chọn.</p>
          )}
        </aside>
      </div>
      ) : (
        /* ===== HISTORY TAB ===== */
        <div className="driver-history-section">
          <div className="driver-history-header">
            <div>
              <h2>Đơn đã giao</h2>
              <p>{isLoadingCompleted && completedOrders.length === 0 ? 'Đang tải...' : `${completedTotal} đơn hoàn thành`}</p>
            </div>
            <button
              type="button"
              className="button-secondary"
              onClick={() => { setCompletedOrders([]); void loadCompletedOrders(1) }}
              disabled={isLoadingCompleted}
            >
              🔄 Tải lại
            </button>
          </div>

          {isLoadingCompleted && completedOrders.length === 0 ? (
            <div className="driver-history-loading">
              <div className="driver-spinner" />
              <span>Đang tải lịch sử giao hàng...</span>
            </div>
          ) : !isLoadingCompleted && completedOrders.length === 0 ? (
            <div className="driver-history-empty">
              <span className="driver-history-empty-icon">📦</span>
              <p>Bạn chưa hoàn thành đơn nào.</p>
              <small>Các đơn đã giao xong sẽ hiển thị ở đây cùng với đánh giá của khách hàng.</small>
            </div>
          ) : (
            <>
              <div className="driver-history-grid">
                {completedOrders.map((order) => (
                  <article
                    key={order.id}
                    className="driver-history-card hover:border-brand cursor-pointer transition-colors duration-200"
                    onClick={() => navigate(`/tracking?orderId=${order.id}`)}
                  >
                    <div className="driver-history-card-header">
                      <div className="driver-history-code">
                        <span className="history-badge">✅ Hoàn thành</span>
                        <strong>{order.orderCode}</strong>
                      </div>
                      <span className="driver-history-amount">
                        {formatPrice(order.cashToCollect || order.totalAmount)} <small>VND</small>
                      </span>
                    </div>

                    <div className="driver-history-card-body">
                      <div className="driver-history-row">
                        <span className="history-label">🏪 Nhà hàng</span>
                        <span>{order.restaurantName}</span>
                      </div>
                      {order.customerName ? (
                        <div className="driver-history-row">
                          <span className="history-label">👤 Khách hàng</span>
                          <span>{order.customerName}</span>
                        </div>
                      ) : null}
                      <div className="driver-history-row">
                        <span className="history-label">📍 Giao đến</span>
                        <span>{order.receiverAddress}</span>
                      </div>
                      <div className="driver-history-row">
                        <span className="history-label">🕐 Hoàn thành</span>
                        <span>
                          {order.completedAt
                            ? new Date(order.completedAt).toLocaleString('vi-VN')
                            : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="driver-history-review-placeholder pt-3 border-t border-gray-100 mt-2 text-center">
                      <span className="text-brand font-bold text-sm">Xem chi tiết đơn & Đánh giá →</span>
                    </div>
                  </article>
                ))}
              </div>

              {completedOrders.length < completedTotal ? (
                <div className="driver-history-load-more">
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void loadCompletedOrders(completedPage + 1)}
                    disabled={isLoadingCompleted}
                  >
                    {isLoadingCompleted ? 'Đang tải...' : `Tải thêm (${completedTotal - completedOrders.length} còn lại)`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* ===== REVIEW DETAIL MODAL ===== */}
      {selectedReview ? (
        <div
          className="review-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Chi tiết đánh giá"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedReview(null) }}
        >
          <div className="review-modal">
            <div className="review-modal-header">
              <div>
                <span className="history-badge">📝 Đánh giá của khách hàng</span>
                <h3>{selectedReview.orderCode}</h3>
              </div>
              <button
                type="button"
                className="review-modal-close"
                onClick={() => setSelectedReview(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="review-modal-body">
              {/* Order info */}
              <div className="review-modal-order-info">
                <div className="review-modal-info-row">
                  <span>🏪 Nhà hàng</span>
                  <strong>{selectedReview.restaurantName}</strong>
                </div>
                {selectedReview.customerName ? (
                  <div className="review-modal-info-row">
                    <span>👤 Khách hàng</span>
                    <strong>{selectedReview.customerName}</strong>
                  </div>
                ) : null}
                <div className="review-modal-info-row">
                  <span>📍 Địa chỉ giao</span>
                  <strong>{selectedReview.receiverAddress}</strong>
                </div>
                <div className="review-modal-info-row">
                  <span>💰 Tiền thu</span>
                  <strong className="review-modal-price">
                    {formatPrice(selectedReview.cashToCollect || selectedReview.totalAmount)} VND
                  </strong>
                </div>
              </div>

              {/* Star rating big */}
              {selectedReview.review ? (
                <div className="review-modal-rating-section">
                  <p className="review-modal-rating-label">Khách đánh giá tài xế</p>
                  <div className="review-modal-stars">
                    <StarRating rating={selectedReview.review.rating} />
                    <span className="review-modal-rating-num">{selectedReview.review.rating} / 5</span>
                  </div>

                  {selectedReview.review.comment ? (
                    <div className="review-modal-comment-box">
                      <p className="review-modal-comment-label">💬 Tin nhắn của khách:</p>
                      <blockquote className="review-modal-comment">
                        {selectedReview.review.comment}
                      </blockquote>
                    </div>
                  ) : (
                    <p className="review-modal-no-comment">Khách không để lại bình luận.</p>
                  )}

                  <small className="review-modal-date">
                    Đánh giá lúc {new Date(selectedReview.review.createdAt).toLocaleString('vi-VN')}
                  </small>
                </div>
              ) : null}
            </div>

            <div className="review-modal-footer">
              <button type="button" className="button-primary" onClick={() => setSelectedReview(null)}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
