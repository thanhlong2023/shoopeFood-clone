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
const activeLocationStatuses = new Set(['DRIVER_ACCEPTED', 'CONFIRMED', 'PICKING_UP', 'DELIVERING'])

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
        <span>{leg.ok ? `${formatDistance(leg.distanceKm)} - ${formatDuration(leg.durationMinutes)}` : leg.error || 'Chua co lo trinh'}</span>
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
  useDocumentTitle(`${APP_NAME} | Tai xe`)
  const { user } = useAuth()
  const driverId = user?.id ?? null

  const [driver, setDriver] = useState<Driver | null>(null)
  const [availableOrders, setAvailableOrders] = useState<Order[]>([])
  const [myOrders, setMyOrders] = useState<Order[]>([])
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(null)
  const [heading, setHeading] = useState(0)
  const [gpsStatus, setGpsStatus] = useState('Dang lay vi tri GPS...')
  const [isLoading, setIsLoading] = useState(true)
  const [isActioning, setIsActioning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const lastGpsPointRef = useRef<RoutePoint | null>(null)

  const allOrders = useMemo(() => [...myOrders, ...availableOrders], [availableOrders, myOrders])
  const activeOrder = useMemo(
    () => allOrders.find((order) => order.id === activeOrderId) || tracking?.order || null,
    [activeOrderId, allOrders, tracking],
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
  const canAcceptSelected = Boolean(activeOrder && !activeOrder.driverId && activeOrder.statusCode === 'PENDING')

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
      if (!quiet) setErrorMessage(error instanceof Error ? error.message : 'Khong the tai tracking')
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
        if (current && [...feed.active, ...feed.available].some((order) => order.id === current)) {
          return current
        }
        return feed.active[0]?.id ?? feed.available[0]?.id ?? null
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai bang tai xe')
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
      setGpsStatus('Trinh duyet khong ho tro GPS, dung vi tri cuoi cung neu co.')
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
        setCurrentPoint(nextPoint)
        setHeading(nextHeading)
        setGpsStatus('GPS dang cap nhat')

        void updateDriverLocation(driverId, {
          ...(activeOrderForLocation ? { orderId: activeOrder.id } : {}),
          latitude: nextPoint.latitude,
          longitude: nextPoint.longitude,
          heading: nextHeading,
          speedKmh: Number.isFinite(position.coords.speed) && position.coords.speed ? Number(position.coords.speed) * 3.6 : 28,
        }).catch((error) => {
          setGpsStatus(error instanceof Error ? error.message : 'Khong the gui vi tri')
        })
      },
      () => {
        setGpsStatus('Chua duoc cap quyen GPS, dung vi tri cuoi cung tren he thong.')
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [activeOrder, driverId, heading])

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
        socket.on('new_order', reloadFeed)
        socket.on('order:updated', reloadFeed)
        socket.on('order:claimed', reloadFeed)
      })
      .catch(() => {
        // Manual reload and polling still work when Socket.io is unavailable.
      })

    return () => {
      isMounted = false
      if (socket) {
        socket.off('new_order', reloadFeed)
        socket.off('order:updated', reloadFeed)
        socket.off('order:claimed', reloadFeed)
        socket.disconnect()
      }
    }
  }, [activeOrderId, loadFeed, loadTracking])

  async function handleAcceptOrder(order: Order) {
    try {
      setIsActioning(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const updated = await acceptOrder(order.id)
      setSuccessMessage(`Da nhan don ${updated.orderCode}`)
      setActiveOrderId(updated.id)
      await loadFeed()
      await loadTracking(updated.id)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the nhan don')
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
      setSuccessMessage(`Da cap nhat ${updated.orderCode}`)
      await loadFeed()
      await loadTracking(updated.id)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the cap nhat trang thai')
    } finally {
      setIsActioning(false)
    }
  }

  function renderOrderCard(order: Order, mode: 'available' | 'mine') {
    return (
      <article key={order.id} className={`driver-order-card ${order.id === activeOrderId ? 'active' : ''}`}>
        <button type="button" onClick={() => setActiveOrderId(order.id)}>
          <strong>{order.orderCode}</strong>
          <span>{order.restaurant?.name || `Quan #${order.restaurantId}`}</span>
          <small>{order.receiverAddress || `Don #${order.id}`} - {formatPrice(order.cashToCollect || order.totalAmount)} VND</small>
        </button>
        {mode === 'available' ? (
          <button type="button" className="button-primary" disabled={isActioning} onClick={() => void handleAcceptOrder(order)}>
            Nhan don
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
          <h1>Don hang quanh ban</h1>
          <p>{driver ? `${driver.fullName} - ${driver.licensePlate || driver.vehicleType}` : user?.fullName || 'Tai xe'}</p>
        </div>

        <div className="driver-gps-pill">
          <span>GPS</span>
          <strong>{gpsStatus}</strong>
        </div>
      </div>

      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}
      {successMessage ? <p className="restaurant-feedback success">{successMessage}</p> : null}

      <div className="driver-layout">
        <aside className="driver-orders">
          <div className="driver-panel-head">
            <h2>{isLoading ? 'Dang tai...' : `${availableOrders.length} don moi`}</h2>
            <button type="button" className="button-secondary" onClick={() => void loadFeed()} disabled={isLoading}>
              Tai lai
            </button>
          </div>

          <div className="driver-order-list">
            <h3>Don moi</h3>
            {availableOrders.map((order) => renderOrderCard(order, 'available'))}
            {!isLoading && availableOrders.length === 0 ? <p className="empty-state">Chua co don moi.</p> : null}

            <h3>Don cua toi</h3>
            {myOrders.map((order) => renderOrderCard(order, 'mine'))}
            {!isLoading && myOrders.length === 0 ? <p className="empty-state">Ban chua nhan don nao.</p> : null}
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
                <Popup>{driver?.fullName || 'Tai xe'}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </main>

        <aside className="driver-control-panel">
          <div className="driver-control-head">
            <span>Don dang chon</span>
            <h2>{activeOrder?.orderCode || '-'}</h2>
            <p>{activeOrder?.receiverAddress || 'Chon don de xem chi tiet'}</p>
          </div>

          {activeOrder ? (
            <>
              <div className="driver-detail-grid">
                <div>
                  <span>Nha hang</span>
                  <strong>{activeOrder.restaurant?.name || tracking?.restaurant?.name || `Quan #${activeOrder.restaurantId}`}</strong>
                </div>
                <div>
                  <span>Khach hang</span>
                  <strong>{activeOrder.customerName || `Khach #${activeOrder.customerId}`}</strong>
                </div>
                <div>
                  <span>SDT khach</span>
                  <strong>{activeOrder.customerPhone || '-'}</strong>
                </div>
                <div>
                  <span>Tien can thu</span>
                  <strong>{formatPrice(activeOrder.cashToCollect || activeOrder.totalAmount)} VND</strong>
                </div>
                <div>
                  <span>ETA</span>
                  <strong>{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
                </div>
                <div>
                  <span>Quang duong</span>
                  <strong>{formatDistance(tracking?.route?.totalDistanceKm)}</strong>
                </div>
              </div>

              <div className="driver-actions-grid">
                {canAcceptSelected ? (
                  <button type="button" className="button-primary" onClick={() => void handleAcceptOrder(activeOrder)} disabled={isActioning}>
                    Nhan don
                  </button>
                ) : null}
                <button type="button" className="button-secondary" onClick={() => void handleStatus('PICKING_UP')} disabled={!isSelectedMine || isActioning}>
                  Den nha hang
                </button>
                <button type="button" className="button-primary" onClick={() => void handleStatus('DELIVERING')} disabled={!isSelectedMine || isActioning}>
                  Da lay mon
                </button>
                <button type="button" className="button-secondary" onClick={() => void handleStatus('COMPLETED')} disabled={!isSelectedMine || isActioning}>
                  Hoan thanh
                </button>
                <button type="button" className="button-danger" onClick={() => void handleStatus('CANCELLED')} disabled={!isSelectedMine || isActioning}>
                  Huy don
                </button>
              </div>

              <div className="driver-route-list">
                {routeLegs.map((leg) => (
                  <RouteLegSummary key={leg.key} leg={leg} />
                ))}
                {tracking && routeLegs.length === 0 ? <p className="empty-state">Chua co route OSRM cho don nay.</p> : null}
              </div>

              <div className="tracking-items">
                <h2>Mon can lay</h2>
                {(activeOrder.items || []).map((item) => (
                  <div key={item.id} className="tracking-item">
                    <span>{item.quantity} x {item.foodName || `Mon #${item.foodId}`}</span>
                    <strong>{formatPrice(item.lineTotal)} VND</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="empty-state">Khong co don dang chon.</p>
          )}
        </aside>
      </div>
    </section>
  )
}
