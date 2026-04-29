import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getDrivers, updateDriverLocation } from '../services/api/drivers'
import { getOrderTracking, getOrders, updateOrder, updateOrderStatus } from '../services/api/orders'
import type { Driver, Order, OrderTracking, RoutePoint } from '../types'

const defaultCenter: [number, number] = [10.7769, 106.7009]

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
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

const activeStatusCodes = new Set(['PENDING', 'DRIVER_ACCEPTED', 'CONFIRMED', 'PICKING_UP', 'DELIVERING'])

export default function DriverPage() {
  useDocumentTitle(`${APP_NAME} | Tai xe`)

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [driverId, setDriverId] = useState('2')
  const [activeOrderId, setActiveOrderId] = useState<number | null>(null)
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const [currentPoint, setCurrentPoint] = useState<RoutePoint | null>(null)
  const [heading, setHeading] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  async function loadDashboard(nextDriverId = Number(driverId)) {
    try {
      setIsLoading(true)
      setErrorMessage(null)

      const [driverData, orderData] = await Promise.all([getDrivers(), getOrders()])
      const activeOrders = orderData.filter((order) => activeStatusCodes.has(order.statusCode || ''))
      setDrivers(driverData)
      setOrders(activeOrders)

      if (driverData.length > 0 && !driverData.some((driver) => driver.id === nextDriverId)) {
        setDriverId(String(driverData[0].id))
      }

      if (!activeOrderId && activeOrders[0]) {
        setActiveOrderId(activeOrders[0].id)
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai du lieu tai xe')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
    return () => {
      if (timerRef.current) {
        window.clearInterval(timerRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!activeOrderId) {
      setTracking(null)
      setCurrentPoint(null)
      return
    }

    let ignore = false
    const selectedOrderId = activeOrderId

    async function loadTracking() {
      try {
        const data = await getOrderTracking(selectedOrderId)
        if (!ignore) {
          setTracking(data)
          setCurrentPoint(
            data.driverLocation
              ? { latitude: data.driverLocation.latitude, longitude: data.driverLocation.longitude }
              : data.restaurant
                ? { latitude: data.restaurant.latitude, longitude: data.restaurant.longitude }
                : data.routePoints[0] || null,
          )
          setHeading(data.driverLocation?.heading || 0)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai tracking')
        }
      }
    }

    void loadTracking()

    return () => {
      ignore = true
    }
  }, [activeOrderId])

  const selectedDriver = useMemo(() => drivers.find((driver) => driver.id === Number(driverId)) || null, [driverId, drivers])
  const activeOrder = useMemo(() => orders.find((order) => order.id === activeOrderId) || tracking?.order || null, [activeOrderId, orders, tracking])
  const routePoints = tracking?.routePoints || []
  const routeLatLng = routePoints.map(toLatLng)
  const mapPoints = currentPoint ? [...routePoints, currentPoint] : routePoints
  const mapCenter = currentPoint ? toLatLng(currentPoint) : defaultCenter

  async function handleAcceptOrder(order: Order) {
    try {
      setErrorMessage(null)
      setSuccessMessage(null)
      const updated = await updateOrder(order.id, {
        driverId: Number(driverId),
        statusCode: 'DRIVER_ACCEPTED',
        expectedVersion: order.version,
      })
      setSuccessMessage(`Da nhan don ${updated.orderCode}`)
      setActiveOrderId(order.id)
      await loadDashboard(Number(driverId))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the nhan don')
    }
  }

  async function handleStatus(statusCode: string) {
    if (!activeOrder) {
      return
    }

    try {
      setErrorMessage(null)
      const updated = await updateOrderStatus(activeOrder.id, statusCode)
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)))
      setTracking((current) => (current ? { ...current, order: updated } : current))
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the cap nhat trang thai')
    }
  }

  async function pushLocation(orderId: number, point: RoutePoint, nextHeading: number) {
    await updateDriverLocation(Number(driverId), {
      orderId,
      latitude: point.latitude,
      longitude: point.longitude,
      heading: nextHeading,
      speedKmh: 28,
    })
  }

  async function startDeliveryRun() {
    if (!activeOrder || routePoints.length < 2) {
      setErrorMessage('Don hang chua co lo trinh')
      return
    }

    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }

    try {
      setIsRunning(true)
      setErrorMessage(null)
      setSuccessMessage(null)
      const assigned = await updateOrder(activeOrder.id, {
        driverId: Number(driverId),
        statusCode: 'DELIVERING',
      })
      setTracking((current) => (current ? { ...current, order: assigned } : current))

      let index = 0
      timerRef.current = window.setInterval(() => {
        const current = routePoints[index]
        const next = routePoints[Math.min(index + 1, routePoints.length - 1)]
        const nextHeading = calculateHeading(current, next)

        setCurrentPoint(current)
        setHeading(nextHeading)
        void pushLocation(activeOrder.id, current, nextHeading)

        if (index >= routePoints.length - 1) {
          if (timerRef.current) {
            window.clearInterval(timerRef.current)
            timerRef.current = null
          }
          setIsRunning(false)
          void updateOrderStatus(activeOrder.id, 'COMPLETED').then((completed) => {
            setSuccessMessage(`Da hoan thanh ${completed.orderCode}`)
            setTracking((currentTracking) => (currentTracking ? { ...currentTracking, order: completed } : currentTracking))
            void loadDashboard(Number(driverId))
          })
        }

        index += 1
      }, 950)
    } catch (error) {
      setIsRunning(false)
      setErrorMessage(error instanceof Error ? error.message : 'Khong the bat dau giao hang')
    }
  }

  function stopDeliveryRun() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRunning(false)
  }

  return (
    <section className="driver-page">
      <div className="driver-header">
        <div>
          <span className="hero-badge">Driver</span>
          <h1>Bang dieu phoi tai xe</h1>
          <p>{selectedDriver ? `${selectedDriver.fullName} · ${selectedDriver.licensePlate}` : 'Chon tai xe de bat dau'}</p>
        </div>

        <label className="driver-select">
          <span>Tai xe</span>
          <select
            value={driverId}
            onChange={(event) => {
              setDriverId(event.target.value)
              void loadDashboard(Number(event.target.value))
            }}
          >
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                {driver.fullName || `Driver #${driver.id}`} - {driver.licensePlate || driver.vehicleType}
              </option>
            ))}
          </select>
        </label>
      </div>

      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}
      {successMessage ? <p className="restaurant-feedback success">{successMessage}</p> : null}

      <div className="driver-layout">
        <aside className="driver-orders">
          <div className="driver-panel-head">
            <h2>{isLoading ? 'Dang tai...' : `${orders.length} don`}</h2>
            <button type="button" className="button-secondary" onClick={() => void loadDashboard(Number(driverId))}>
              Tai lai
            </button>
          </div>

          <div className="driver-order-list">
            {orders.map((order) => (
              <article key={order.id} className={`driver-order-card ${order.id === activeOrderId ? 'active' : ''}`}>
                <button type="button" onClick={() => setActiveOrderId(order.id)}>
                  <strong>{order.orderCode}</strong>
                  <span>{order.receiverAddress || `Don #${order.id}`}</span>
                  <small>{order.statusLabel || order.statusCode} · {formatPrice(order.totalAmount)} VND</small>
                </button>
                <button type="button" className="button-primary" onClick={() => void handleAcceptOrder(order)}>
                  Nhan don
                </button>
              </article>
            ))}

            {!isLoading && orders.length === 0 ? <p className="empty-state">Khong co don dang giao.</p> : null}
          </div>
        </aside>

        <main className="driver-map-card">
          <MapContainer center={mapCenter} zoom={14} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DriverMapFit points={mapPoints} />
            {routeLatLng.length > 0 ? <Polyline positions={routeLatLng} pathOptions={{ color: '#00b14f', weight: 6, opacity: 0.76 }} /> : null}
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
                <Popup>{selectedDriver?.fullName || 'Tai xe'}</Popup>
              </Marker>
            ) : null}
          </MapContainer>
        </main>

        <aside className="driver-control-panel">
          <div className="driver-control-head">
            <span>Don dang chon</span>
            <h2>{activeOrder?.orderCode || '-'}</h2>
            <p>{activeOrder?.receiverAddress || 'Chua co don'}</p>
          </div>

          <div className="driver-actions-grid">
            <button type="button" className="button-secondary" onClick={() => void handleStatus('PICKING_UP')} disabled={!activeOrder}>
              Lay mon
            </button>
            <button type="button" className="button-primary" onClick={() => void startDeliveryRun()} disabled={!activeOrder || isRunning}>
              Chay giao hang
            </button>
            <button type="button" className="button-secondary" onClick={stopDeliveryRun} disabled={!isRunning}>
              Tam dung
            </button>
            <button type="button" className="button-danger" onClick={() => void handleStatus('CANCELLED')} disabled={!activeOrder}>
              Huy don
            </button>
          </div>

          <div className="driver-summary">
            <div>
              <span>Trang thai</span>
              <strong>{tracking?.order.statusLabel || tracking?.order.statusCode || '-'}</strong>
            </div>
            <div>
              <span>Tien thu</span>
              <strong>{activeOrder ? `${formatPrice(activeOrder.totalAmount)} VND` : '-'}</strong>
            </div>
            <div>
              <span>So mon</span>
              <strong>{activeOrder?.items.reduce((total, item) => total + item.quantity, 0) || 0}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}
