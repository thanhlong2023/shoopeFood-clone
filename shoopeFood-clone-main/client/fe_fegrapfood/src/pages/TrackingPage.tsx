import { useCallback, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTrackableOrder } from '../hooks/useTrackableOrder'
import { getOrderTracking } from '../services/api/orders'
import { getLastOrderId } from '../utils/orderStorage'
import { createSocket } from '../services/socket'
import type { DriverLocation, Order, OrderTracking, RoutePoint } from '../types'

const defaultCenter: [number, number] = [10.7769, 106.7009]

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function formatDuration(value?: number) {
  if (!value) return '-'
  return `${Math.round(value)} phut`
}

function formatDistance(value?: number) {
  if (!value) return '-'
  return `${value.toFixed(1)} km`
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
  const [searchParams] = useSearchParams()
  const { hasTrackableOrder, lastOrderId } = useTrackableOrder()
  const queryOrderId = searchParams.get('orderId')
  const resolvedOrderId = queryOrderId ? Number(queryOrderId) : lastOrderId ?? getLastOrderId()
  const hasActiveOrder = Number.isFinite(resolvedOrderId) && (resolvedOrderId ?? 0) > 0

  const [activeOrderId] = useState<number | null>(hasActiveOrder ? Number(resolvedOrderId) : null)
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
    if (activeOrderId === null || !Number.isFinite(activeOrderId)) {
      setIsLoading(false)
      return undefined
    }

    void loadTracking(activeOrderId)
    const timer = window.setInterval(() => void loadTracking(activeOrderId, true), 3000)
    return () => window.clearInterval(timer)
  }, [activeOrderId, loadTracking])

  useEffect(() => {
    if (activeOrderId === null) {
      return undefined
    }

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
    const points = [...((tracking?.route?.legs || []).flatMap((leg) => leg.geometry))]
    if (driverLocation) {
      points.push({ latitude: driverLocation.latitude, longitude: driverLocation.longitude })
    }
    if (tracking?.restaurant) points.push(tracking.restaurant)
    if (tracking?.destination) points.push(tracking.destination)
    return points
  }, [driverLocation, tracking])

  const routeLegs = tracking?.route?.legs || []
  const driverPoint = driverLocation ? { latitude: driverLocation.latitude, longitude: driverLocation.longitude } : null
  const nextPoint = tracking?.routePoints.find((point) => driverPoint && Math.hypot(point.latitude - driverPoint.latitude, point.longitude - driverPoint.longitude) > 0.0005)
  const motoHeading = driverLocation?.heading || (driverPoint && nextPoint ? getHeading(driverPoint, nextPoint) : 0)
  const mapCenter: [number, number] = driverPoint
    ? toLatLng(driverPoint)
    : tracking?.restaurant
      ? [tracking.restaurant.latitude, tracking.restaurant.longitude]
      : defaultCenter

  if (!hasTrackableOrder && !queryOrderId) {
    return (
      <section className="tracking-page">
        <div className="tracking-empty">
          <span className="hero-badge">Theo doi don hang</span>
          <h1>Chua co don hang de theo doi</h1>
          <p>Dat mon xong ban se thay tien trinh giao hang va lo trinh tai xe tai day.</p>
          <Link className="button-primary" to="/">
            Dat mon ngay
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="tracking-page">
      <div className="tracking-header">
        <div>
          <span className="hero-badge">Theo doi truc tiep</span>
          <h1>Don hang cua ban dang o dau?</h1>
          <p>{tracking?.order.orderCode || 'Dang tai thong tin don hang...'}</p>
        </div>
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

            {routeLegs.map((leg) =>
              leg.geometry.length > 0 ? (
                <Polyline
                  key={leg.key}
                  positions={leg.geometry.map(toLatLng)}
                  pathOptions={{
                    color: leg.key === 'driver_to_restaurant' ? '#ff8a00' : '#00b14f',
                    weight: 6,
                    opacity: 0.76,
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
              <span>SDT khach</span>
              <strong>{tracking?.order.customerPhone || '-'}</strong>
            </div>
            <div>
              <span>Bien so</span>
              <strong>{tracking?.driver?.licensePlate || '-'}</strong>
            </div>
            <div>
              <span>Tong tien</span>
              <strong>{tracking ? `${formatPrice(tracking.order.totalAmount)} VND` : '-'}</strong>
            </div>
            <div>
              <span>Tien can thu</span>
              <strong>{tracking ? `${formatPrice(tracking.order.cashToCollect)} VND` : '-'}</strong>
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

          <div className="driver-route-list">
            {routeLegs.map((leg) => (
              <div key={leg.key} className="driver-route-leg">
                <div>
                  <strong>{leg.label}</strong>
                  <span>{leg.ok ? `${formatDistance(leg.distanceKm)} - ${formatDuration(leg.durationMinutes)}` : leg.error || 'Chua co lo trinh'}</span>
                </div>
              </div>
            ))}
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
