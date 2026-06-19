import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getMyDriverOrderFeed, updateDriverLocation } from '../services/api/drivers'
import { acceptOrder, getOrderTracking, updateOrderStatus } from '../services/api/orders'
import { createSocket } from '../services/socket'
import type { Driver, Order, OrderTracking, RouteLeg, RoutePoint } from '../types'

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
  return `${Math.round(value)} phut`
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
    const validPoints = points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
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
        <span>{leg.ok ? `${formatDistance(leg.distanceKm)} - ${formatDuration(leg.durationMinutes)}` : leg.error || 'Chua c� l? tr�nh'}</span>
      </div>
      <ol>
        {leg.steps.slice(0, 5).map((step, index) => (
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
  useDocumentTitle(`${APP_NAME} | T�i x?`)
  const { user } = useAuth()
  const driverId = user?.id ?? null

  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(null)
  const [heading, setHeading] = useState(0)
  const [gpsStatus, setGpsStatus] = useState('�ang l?y v? tr� GPS...')
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSimulating, setIsSimulating] = useState(true)
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
  const routePolylinePoints = useMemo(() => routeLegs.flatMap((leg) => leg.geometry), [routeLegs])
  const mapPoints = useMemo(() => {
    const points = [...routePolylinePoints]
    if (currentPoint) points.push(currentPoint)
    if (tracking?.restaurant) points.push(tracking.restaurant)
    if (tracking?.destination) points.push(tracking.destination)
    return points
  }, [currentPoint, routePolylinePoints, tracking])
  const mapCenter = currentPoint ? toLatLng(currentPoint) : mapPoints[0] ? toLatLng(mapPoints[0]) : defaultCenter
  const isSelectedMine = Boolean(driverId && activeOrder?.driverId === driverId)
  const canAcceptSelected = Boolean(activeOrder && !activeOrder.driverId && activeOrder.statusCode === 'CONFIRMED')
  const canStartPickup = Boolean(isSelectedMine && activeOrder?.statusCode === 'DRIVER_ACCEPTED')
  const canStartDelivery = Boolean(isSelectedMine && activeOrder?.statusCode === 'PICKING_UP')
  const canCompleteDelivery = Boolean(isSelectedMine && activeOrder?.statusCode === 'DELIVERING')

  const loadTracking = useCallback(async (orderId: number, quiet = false) => {
    try {
      if (!quiet) setErrorMessage(null)
      const data = await getOrderTracking(orderId)
      setTracking(data)
      if (!lastGpsPointRef.current && data.driverLocation) {
        setCurrentPoint({ latitude: data.driverLocation.latitude, longitude: data.driverLocation.longitude })
        setHeading(data.driverLocation.heading || 0)
      }
    } catch (error) {
      if (!quiet) setErrorMessage(error instanceof Error ? error.message : 'Không thể tải tracking')
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? t?i b?ng t�i x?')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFeed()
  }, [loadFeed])

  useEffect(() => {
    if (!activeOrderId) {
      setTracking(null)
      return
    }

    void loadTracking(activeOrderId)
  }, [activeOrderId, loadTracking])

  useEffect(() => {
    if (!driverId || !navigator.geolocation) {
      setGpsStatus('Tr�nh duy?t kh�ng h? tr? GPS, d�ng v? tr� cu?i c�ng n?u c�.')
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
          setGpsStatus('GPS đang cập nhật')

          void updateDriverLocation(driverId, {
            ...(activeOrderForLocation ? { orderId: activeOrder.id } : {}),
            latitude: nextPoint.latitude,
            longitude: nextPoint.longitude,
            heading: nextHeading,
            speedKmh: Number.isFinite(position.coords.speed) && position.coords.speed ? Number(position.coords.speed) * 3.6 : 28,
          }).catch((error) => {
            setGpsStatus(error instanceof Error ? error.message : 'Kh�ng th? g?i v? tr�')
          })
        }
      },
      () => {
        setGpsStatus('Chua du?c c?p quy?n GPS, d�ng v? tr� cu?i c�ng tr�n h? th?ng.')
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

    const stateKey = `${activeOrder.id}-${activeOrder.statusCode}`;
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
      setErrorMessage('B?n dang c� don dang giao. Ho�n th�nh don hi?n t?i tru?c khi nh?n don m?i.')
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
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? nh?n don')
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
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? c?p nh?t tr?ng th�i')
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
            {hasActiveDelivery ? '�ang giao don kh�c' : 'Nhận đơn'}
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
          <h1>�on h�ng quanh b?n</h1>
          <p>{driver ? `${driver.fullName} - ${driver.licensePlate || driver.vehicleType}` : user?.fullName || 'T�i x?'}</p>
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
            <h3>{isShowingAllConfirmed ? '�on m?i d� x�c nh?n' : `�Đơn mới gần bạn (${NEARBY_RADIUS_KM}km)`}</h3>
            {visibleAvailableOrders.map((order) => renderOrderCard(order, 'available'))}
            {!isLoading && visibleAvailableOrders.length === 0 ? (
              <p className="empty-state">
                {currentPoint
                  ? `Chưa có đơn mới trong bán kính ${NEARBY_RADIUS_KM}km. Nếu cần demo, kiểm tra tọa độ nhà hàng và vị trí tài xế.`
                  : 'Chua c� don CONFIRMED n�o. H�y ch? merchant x�c nh?n don tru?c.'}
              </p>
            ) : null}

            <h3>�on c?a t�i</h3>
            {myOrders.map((order) => renderOrderCard(order, 'mine'))}
            {!isLoading && myOrders.length === 0 ? <p className="empty-state">B?n chua nh?n don n�o.</p> : null}
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
              leg.geometry.length > 0 ? (
                <Polyline
                  key={leg.key}
                  positions={leg.geometry.map(toLatLng)}
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
                <Popup>{driver?.fullName || 'T�i x?'}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </main>

        <aside className="driver-control-panel">
          <div className="driver-control-head">
            <span>�Đơn đang chọn</span>
            <h2>{activeOrder?.orderCode || '-'}</h2>
            {activeOrder ? <strong className="driver-status-pill">{statusText(activeOrder)}</strong> : null}
            <p>{activeOrder?.receiverAddress || 'Chọn đơn để xem chi tiết'}</p>
          </div>

          {activeOrder ? (
            <>
              <div className="driver-detail-grid">
                <div>
                  <span>Nh� h�ng</span>
                  <strong>{activeOrder.restaurant?.name || tracking?.restaurant?.name || `Quán #${activeOrder.restaurantId}`}</strong>
                </div>
                <div>
                  <span>Kh�ch h�ng</span>
                  <strong>{activeOrder.customerName || `Khach #${activeOrder.customerId}`}</strong>
                </div>
                <div>
                  <span>S�T kh�ch</span>
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
                  <span>Qu�ng du?ng</span>
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
                  �?n nh� h�ng
                </button>
                <button type="button" className="button-primary" onClick={() => void handleStatus('DELIVERING')} disabled={!canStartDelivery || isActioning}>
                  �� l?y m�n
                </button>
                <button type="button" className="button-secondary" onClick={() => void handleStatus('COMPLETED')} disabled={!canCompleteDelivery || isActioning}>
                  Ho�n th�nh
                </button>
                <button type="button" className="button-danger" onClick={() => void handleStatus('CANCELLED')} disabled={!isSelectedMine || isActioning}>
                  Hủy đơn
                </button>
              </div>

              <div className="driver-route-list">
                {routeLegs.map((leg) => (
                  <RouteLegSummary key={leg.key} leg={leg} />
                ))}
                {tracking && routeLegs.length === 0 ? <p className="empty-state">Chua c� route OSRM cho don n�y.</p> : null}
              </div>

              <div className="driver-invoice-card">
                <div className="driver-invoice-head">
                  <div>
                    <span>H�a don</span>
                    <h2>{activeOrder.orderCode}</h2>
                  </div>
                  <strong>{statusText(activeOrder)}</strong>
                </div>

                <div className="tracking-items">
                  <h2>M�n c?n l?y</h2>
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
                    <p className="empty-state">�on n�y chua c� chi ti?t m�n trong d? li?u tr? v?.</p>
                  )}
                </div>

                <div className="bill-box driver-invoice-totals">
                  <div>
                    <span>Ti?n m�n</span>
                    <strong>{formatPrice(activeOrder.subtotalAmount)} VND</strong>
                  </div>
                  <div>
                    <span>Ph� giao h�ng</span>
                    <strong>{formatPrice(activeOrder.shippingFee)} VND</strong>
                  </div>
                  <div>
                    <span>Thuế</span>
                    <strong>{formatPrice(activeOrder.taxAmount)} VND</strong>
                  </div>
                  <div>
                    <span>Giảm giá�</span>
                    <strong>-{formatPrice(activeOrder.discountAmount)} VND</strong>
                  </div>
                  <div className="bill-total">
                    <span>Tổng đơn</span>
                    <strong>{formatPrice(activeOrder.totalAmount)} VND</strong>
                  </div>
                  <div className="bill-total driver-cash-total">
                    <span>T�i x? thu</span>
                    <strong>{formatPrice(activeOrder.cashToCollect || activeOrder.totalAmount)} VND</strong>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="empty-state">Kh�ng c� dĐơn đang chọn.</p>
          )}
        </aside>
      </div>
    </section>
  )
}
