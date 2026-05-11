import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getOrderTracking } from '../services/api/orders'
import { createSocket } from '../services/socket'
import type { DriverLocation, Order, OrderTracking, RoutePoint } from '../types'

const defaultCenter: [number, number] = [10.7769, 106.7009]

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function toLatLng(point: RoutePoint): [number, number] {
  return [point.latitude, point.longitude]
}

function getHeading(from: RoutePoint, to: RoutePoint) {
  const y = Math.sin((to.longitude - from.longitude) * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180)
  const x =
    Math.cos(from.latitude * Math.PI / 180) * Math.sin(to.latitude * Math.PI / 180) -
    Math.sin(from.latitude * Math.PI / 180) *
      Math.cos(to.latitude * Math.PI / 180) *
      Math.cos((to.longitude - from.longitude) * Math.PI / 180)
  return (Math.atan2(y, x) * 180) / Math.PI
}

function makeMotoIcon(heading = 0) {
  return L.divIcon({
    className: 'moto-marker',
    html: `
      <div class="moto-pin" style="--heading:${heading}deg">
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

function MapAutoFit({ points }: { points: RoutePoint[] }) {
  const map = useMap()

  useEffect(() => {
    const validPoints = points.filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude))
    if (validPoints.length === 0) {
      return
    }

    const bounds = L.latLngBounds(validPoints.map(toLatLng))
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  }, [map, points])

  return null
}

function StatusSteps({ order }: { order: Order | null }) {
  const steps = [
    { code: 'PENDING', label: 'Dat don' },
    { code: 'DRIVER_ACCEPTED', label: 'Tai xe nhan' },
    { code: 'PICKING_UP', label: 'Lay mon' },
    { code: 'DELIVERING', label: 'Dang giao' },
    { code: 'COMPLETED', label: 'Hoan thanh' },
  ]
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.code === order?.statusCode),
  )

  return (
    <div className="tracking-steps">
      {steps.map((step, index) => (
        <div key={step.code} className={`tracking-step ${index <= currentIndex ? 'active' : ''}`}>
          <span>{index + 1}</span>
          <strong>{step.label}</strong>
        </div>
      ))}
    </div>
  )
}

export default function TrackingPage() {
  useDocumentTitle(`${APP_NAME} | Theo doi don`)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialOrderId = searchParams.get('orderId') || localStorage.getItem('lastOrderId') || '1'

  const [orderIdInput, setOrderIdInput] = useState(initialOrderId)
  const [activeOrderId, setActiveOrderId] = useState(Number(initialOrderId) || 1)
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadTracking = useCallback(async (orderId: number, quiet = false) => {
    try {
      if (!quiet) {
        setIsLoading(true)
      }
      setErrorMessage(null)
      const data = await getOrderTracking(orderId)
      setTracking(data)
      setDriverLocation(data.driverLocation)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the tai tracking')
    } finally {
      if (!quiet) {
        setIsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!Number.isFinite(activeOrderId)) {
      return
    }

    void loadTracking(activeOrderId)
    const timer = window.setInterval(() => void loadTracking(activeOrderId, true), 3000)
    return () => window.clearInterval(timer)
  }, [activeOrderId, loadTracking])

  useEffect(() => {
    let isMounted = true
    let socket: Awaited<ReturnType<typeof createSocket>> | null = null

    const handleLocation = (payload: DriverLocation) => {
      if (Number(payload.orderId) === activeOrderId) {
        setDriverLocation(payload)
      }
    }

    const handleOrderUpdated = (payload: Order) => {
      if (payload.id === activeOrderId) {
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
        socket.on('driver:location', handleLocation)
        socket.on(`order:${activeOrderId}:driver-location`, handleLocation)
        socket.on(`order:${activeOrderId}:updated`, handleOrderUpdated)
      })
      .catch(() => {
        // Polling keeps tracking alive when Socket.io is unavailable.
      })

    return () => {
      isMounted = false
      if (socket) {
        socket.off('driver:location', handleLocation)
        socket.off(`order:${activeOrderId}:driver-location`, handleLocation)
        socket.off(`order:${activeOrderId}:updated`, handleOrderUpdated)
        socket.disconnect()
      }
    }
  }, [activeOrderId, loadTracking])

  const mapPoints = useMemo(() => {
    const points = [...(tracking?.routePoints || [])]
    if (driverLocation) {
      points.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude })
    }
    return points
  }, [driverLocation, tracking])

  const routeLatLng = useMemo(() => (tracking?.routePoints || []).map(toLatLng), [tracking])
  const driverPoint = driverLocation ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude } : null
  const nextPoint = tracking?.routePoints.find((point) => driverPoint && Math.hypot(point.latitude - driverPoint.latitude, point.longitude - driverPoint.longitude) > 0.0005)
  const motoHeading = driverLocation?.heading || (driverPoint && nextPoint ? getHeading(driverPoint, nextPoint) : 0)
  const mapCenter: [number, number] = driverPoint
    ? toLatLng(driverPoint)
    : tracking?.restaurant
      ? [tracking.restaurant.latitude, tracking.restaurant.longitude]
      : defaultCenter

  function handleTrackSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextOrderId = Number(orderIdInput)
    if (!Number.isFinite(nextOrderId) || nextOrderId <= 0) {
      setErrorMessage('Ma don khong hop le')
      return
    }

    localStorage.setItem('lastOrderId', String(nextOrderId))
    setSearchParams({ orderId: String(nextOrderId) })
    setActiveOrderId(nextOrderId)
  }

  return (
    <section className="tracking-page">
      <div className="tracking-header">
        <div>
          <span className="hero-badge">Theo doi truc tiep</span>
          <h1>Don hang cua ban dang o dau?</h1>
          <p>{tracking?.order.orderCode || 'Nhap ma don de xem tai xe va lo trinh giao hang.'}</p>
        </div>

        <form className="tracking-search" onSubmit={handleTrackSubmit}>
          <input value={orderIdInput} onChange={(event) => setOrderIdInput(event.target.value)} aria-label="Order ID" />
          <button type="submit">Theo doi</button>
        </form>
      </div>

      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

      <div className="tracking-layout">
        <div className="tracking-map-card">
          <MapContainer center={mapCenter} zoom={14} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapAutoFit points={mapPoints} />

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

            {driverLocation ? (
              <>
                <Marker position={[driverLocation.latitude, driverLocation.longitude]} icon={makeMotoIcon(motoHeading)}>
                  <Popup>{tracking?.driver?.fullName || 'Tai xe'}</Popup>
                </Marker>
                <CircleMarker center={[driverLocation.latitude, driverLocation.longitude]} radius={16} pathOptions={{ color: '#00b14f', opacity: 0.2 }} />
              </>
            ) : null}
          </MapContainer>
        </div>

        <aside className="tracking-card">
          <div className="tracking-card-head">
            <span>{isLoading ? 'Dang tai' : tracking?.order.statusLabel || tracking?.order.statusCode || 'Cho tai xe'}</span>
            <strong>{tracking ? `${tracking.routeProgress}%` : '0%'}</strong>
          </div>

          <StatusSteps order={tracking?.order || null} />

          <div className="tracking-info-grid">
            <div>
              <span>Nha hang</span>
              <strong>{tracking?.restaurant?.name || 'Dang cap nhat'}</strong>
            </div>
            <div>
              <span>Tai xe</span>
              <strong>{tracking?.driver?.fullName || 'Chua co tai xe'}</strong>
            </div>
            <div>
              <span>Bien so</span>
              <strong>{tracking?.driver?.licensePlate || '-'}</strong>
            </div>
            <div>
              <span>Tong tien</span>
              <strong>{tracking ? `${formatPrice(tracking.order.totalAmount)} VND` : '-'}</strong>
            </div>
          </div>

          <div className="tracking-items">
            <h2>Mon da dat</h2>
            {(tracking?.order.items || []).map((item) => (
              <div key={item.id} className="tracking-item">
                <span>{item.quantity} x {item.foodName || `Mon #${item.foodId}`}</span>
                <strong>{formatPrice(item.lineTotal)} VND</strong>
              </div>
            ))}
          </div>

          <Link className="button-secondary" to="/">
            Dat them mon
          </Link>
        </aside>
      </div>
    </section>
  )
}
