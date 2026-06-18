import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTrackableOrder } from '../hooks/useTrackableOrder'
import { getOrders, getOrderTracking, cancelOrder } from '../services/api/orders'
import { getLastOrderId } from '../utils/orderStorage'
import { createSocket } from '../services/socket'
import { foodPhotoStyle } from '../utils/foodImage'
import Modal from '../components/common/Modal'
import DriverProfilePanel from '../components/tracking/DriverProfilePanel'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency, formatDateTime, toOrderCode } from '../utils/formatters'
import type { Driver, DriverLocation, Order, OrderTracking, RoutePoint } from '../types'

const defaultCenter: [number, number] = [10.7769, 106.7009]
const ACTIVE_DELIVERY_STATUSES = new Set([
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'PICKING_UP',
  'DELIVERING',
])

type OrderListFilter = 'all' | 'delivering'

function formatOrderTime(value?: string | null) {
  return formatDateTime(value)
}

function isActiveDelivery(statusCode?: string | null) {
  return Boolean(statusCode && ACTIVE_DELIVERY_STATUSES.has(statusCode))
}

function getStatusTone(statusCode?: string | null) {
  if (!statusCode) return 'neutral'
  if (statusCode === 'COMPLETED') return 'done'
  if (statusCode === 'CANCELLED' || statusCode === 'REJECTED' || statusCode === 'TIMEOUT') return 'cancelled'
  if (statusCode === 'DELIVERING' || statusCode === 'PICKING_UP') return 'delivering'
  if (statusCode === 'PENDING') return 'pending'
  if (ACTIVE_DELIVERY_STATUSES.has(statusCode)) return 'active'
  return 'neutral'
}


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

    if (validPoints.length === 1) {
      map.setView(toLatLng(validPoints[0]), 11)
      return
    }

    const bounds = L.latLngBounds(validPoints.map(toLatLng))
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 12 })
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
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const { hasTrackableOrder, lastOrderId } = useTrackableOrder()
  const isCustomer = user?.role === 'CUSTOMER'
  const queryOrderId = searchParams.get('orderId')
  const resolvedOrderId = queryOrderId ? Number(queryOrderId) : lastOrderId ?? getLastOrderId()
  const hasGuestOrder = Number.isFinite(resolvedOrderId) && (resolvedOrderId ?? 0) > 0

  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(() => {
    if (queryOrderId && Number.isFinite(Number(queryOrderId))) {
      return Number(queryOrderId)
    }
    if (hasGuestOrder) {
      return Number(resolvedOrderId)
    }
    return null
  })
  const [customerOrders, setCustomerOrders] = useState<Order[]>([])
  const [isCancelling, setIsCancelling] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('Khách hàng chủ động hủy đơn')

  const confirmCancelOrder = async () => {
    if (!selectedOrderId) return

    try {
      setIsCancelling(true)
      setErrorMessage(null)
      await cancelOrder(selectedOrderId, cancelReason)
      setIsCancelModalOpen(false)
      alert('Hủy đơn hàng thành công!')
      void loadCustomerOrders()
      void loadTracking(selectedOrderId)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể hủy đơn hàng')
    } finally {
      setIsCancelling(false)
    }
  }

  const [ordersLoading, setOrdersLoading] = useState(isCustomer)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [orderListFilter, setOrderListFilter] = useState<OrderListFilter>('all')
  const [tracking, setTracking] = useState<OrderTracking | null>(null)
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [driverAssignedNotice, setDriverAssignedNotice] = useState<{ driverName: string; orderCode: string } | null>(null)
  const [driverDeliveringNotice, setDriverDeliveringNotice] = useState<{
    driverName: string
    orderCode: string
    cashToCollect: number
  } | null>(null)
  const [deliveryCompletedNotice, setDeliveryCompletedNotice] = useState<{
    driverName: string
    orderCode: string
    totalAmount: number
  } | null>(null)
  const driverNoticeShownRef = useRef(false)
  const driverDeliveringNoticeShownRef = useRef<Set<number>>(new Set())
  const deliveryCompletedNoticeShownRef = useRef<Set<number>>(new Set())

  const showDeliveryCompletedNotice = useCallback(
    (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      totalAmount?: number
    }) => {
      if (deliveryCompletedNoticeShownRef.current.has(payload.orderId)) {
        return
      }

      deliveryCompletedNoticeShownRef.current.add(payload.orderId)
      setDeliveryCompletedNotice({
        driverName: payload.driver?.fullName || 'Tai xe',
        orderCode: payload.orderCode,
        totalAmount: Number(payload.totalAmount ?? 0),
      })
    },
    [],
  )

  const showDriverDeliveringNotice = useCallback(
    (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      cashToCollect?: number
      totalAmount?: number
    }) => {
      if (driverDeliveringNoticeShownRef.current.has(payload.orderId)) {
        return
      }

      driverDeliveringNoticeShownRef.current.add(payload.orderId)
      setDriverDeliveringNotice({
        driverName: payload.driver?.fullName || 'Tai xe',
        orderCode: payload.orderCode,
        cashToCollect: Number(payload.cashToCollect ?? payload.totalAmount ?? 0),
      })
    },
    [],
  )

  const loadCustomerOrders = useCallback(async (quiet = false) => {
    if (!isCustomer || !user?.id) {
      return
    }

    try {
      if (!quiet) {
        setOrdersLoading(true)
      }
      setOrdersError(null)
      const orders = await getOrders()
      const sorted = [...orders].sort(
        (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      )
      setCustomerOrders(sorted)
    } catch (error) {
      setOrdersError(error instanceof Error ? error.message : 'Khong the tai danh sach don hang')
    } finally {
      if (!quiet) {
        setOrdersLoading(false)
      }
    }
  }, [isCustomer, user?.id])

  const selectOrder = useCallback(
    (orderId: number) => {
      setSelectedOrderId(orderId)
      setSearchParams({ orderId: String(orderId) })
    },
    [setSearchParams],
  )

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
  }, [showDeliveryCompletedNotice, showDriverDeliveringNotice])

  useEffect(() => {
    if (queryOrderId && Number.isFinite(Number(queryOrderId))) {
      setSelectedOrderId(Number(queryOrderId))
    }
  }, [queryOrderId])

  useEffect(() => {
    if (!isCustomer) {
      return undefined
    }

    void loadCustomerOrders()
    const timer = window.setInterval(() => void loadCustomerOrders(true), 10000)
    return () => window.clearInterval(timer)
  }, [isCustomer, loadCustomerOrders])

  useEffect(() => {
    if (!isCustomer || !user?.id) {
      return undefined
    }

    let isMounted = true
    let socket: Awaited<ReturnType<typeof createSocket>> | null = null

    const refreshOrders = () => {
      void loadCustomerOrders(true)
    }

    const handleCustomerDriverDelivering = (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      cashToCollect?: number
      totalAmount?: number
    }) => {
      showDriverDeliveringNotice(payload)
      refreshOrders()
      if (payload.orderId === selectedOrderId) {
        void loadTracking(payload.orderId, true)
      }
    }

    const handleDeliveryCompleted = (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      totalAmount?: number
    }) => {
      showDeliveryCompletedNotice(payload)
      refreshOrders()
      if (payload.orderId === selectedOrderId) {
        void loadTracking(payload.orderId, true)
      }
    }

    void createSocket()
      .then((createdSocket) => {
        if (!isMounted) {
          createdSocket.disconnect()
          return
        }

        socket = createdSocket
        socket.on(`customer:${user.id}:order-timeout`, refreshOrders)
        socket.on(`customer:${user.id}:driver-delivering`, handleCustomerDriverDelivering)
        socket.on(`customer:${user.id}:delivery-completed`, handleDeliveryCompleted)
        socket.on('order:timeout', refreshOrders)
        socket.on('order:updated', refreshOrders)
      })
      .catch(() => {
        // Polling keeps the order list fresh when Socket.io is unavailable.
      })

    return () => {
      isMounted = false
      if (socket) {
        socket.off(`customer:${user.id}:order-timeout`, refreshOrders)
        socket.off(`customer:${user.id}:driver-delivering`, handleCustomerDriverDelivering)
        socket.off(`customer:${user.id}:delivery-completed`, handleDeliveryCompleted)
        socket.off('order:timeout', refreshOrders)
        socket.off('order:updated', refreshOrders)
        socket.disconnect()
      }
    }
  }, [isCustomer, loadCustomerOrders, loadTracking, selectedOrderId, showDeliveryCompletedNotice, showDriverDeliveringNotice, user?.id])

  useEffect(() => {
    if (!isCustomer || selectedOrderId || customerOrders.length === 0) {
      return
    }

    const activeOrder = customerOrders.find((order) => isActiveDelivery(order.statusCode))
    selectOrder(activeOrder?.id ?? customerOrders[0].id)
  }, [customerOrders, isCustomer, selectOrder, selectedOrderId])

  useEffect(() => {
    if (selectedOrderId === null || !Number.isFinite(selectedOrderId)) {
      setIsLoading(false)
      return undefined
    }

    void loadTracking(selectedOrderId)
    const timer = window.setInterval(() => void loadTracking(selectedOrderId, true), 3000)
    return () => window.clearInterval(timer)
  }, [selectedOrderId, loadTracking])

  useEffect(() => {
    if (selectedOrderId === null) {
      return undefined
    }

    let isMounted = true
    let socket: Awaited<ReturnType<typeof createSocket>> | null = null

    const handleLocation = (payload: DriverLocation) => {
      if (Number(payload.orderId) === selectedOrderId) {
        setDriverLocation(payload)
      }
    }

    const showDriverAssignedNotice = (orderCode: string, driver?: Driver | null) => {
      if (driverNoticeShownRef.current || !driver?.fullName) {
        return
      }

      driverNoticeShownRef.current = true
      setDriverAssignedNotice({
        driverName: driver.fullName,
        orderCode,
      })
    }

    const handleOrderUpdated = (payload: Order) => {
      if (payload.id !== selectedOrderId) {
        return
      }

      if (payload.statusCode === 'DRIVER_ACCEPTED' || payload.statusCode === 'DRIVER_ASSIGNED') {
        showDriverAssignedNotice(payload.orderCode, payload.driver)
      }

      if (payload.statusCode === 'DELIVERING') {
        showDriverDeliveringNotice({
          orderId: payload.id,
          orderCode: payload.orderCode,
          driver: payload.driver,
          cashToCollect: payload.cashToCollect,
          totalAmount: payload.totalAmount,
        })
      }

      if (payload.statusCode === 'COMPLETED') {
        showDeliveryCompletedNotice({
          orderId: payload.id,
          orderCode: payload.orderCode,
          driver: payload.driver,
          totalAmount: payload.totalAmount,
        })
      }

      void loadTracking(selectedOrderId, true)
      void loadCustomerOrders(true)
    }

    const handleOrderClaimed = (payload: Order) => {
      if (payload.id !== selectedOrderId) {
        return
      }

      showDriverAssignedNotice(payload.orderCode, payload.driver)
      void loadTracking(selectedOrderId, true)
      void loadCustomerOrders(true)
    }

    const handleCustomerDriverAssigned = (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
    }) => {
      if (payload.orderId !== selectedOrderId) {
        return
      }

      showDriverAssignedNotice(payload.orderCode, payload.driver)
      void loadTracking(selectedOrderId, true)
      void loadCustomerOrders(true)
    }

    const handleCustomerDriverDelivering = (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      cashToCollect?: number
      totalAmount?: number
    }) => {
      if (payload.orderId !== selectedOrderId) {
        return
      }

      showDriverDeliveringNotice(payload)
      void loadTracking(selectedOrderId, true)
      void loadCustomerOrders(true)
    }

    const handleDeliveryCompleted = (payload: {
      orderId: number
      orderCode: string
      driver?: Driver | null
      totalAmount?: number
    }) => {
      if (payload.orderId !== selectedOrderId) {
        return
      }

      showDeliveryCompletedNotice(payload)
      void loadTracking(selectedOrderId, true)
      void loadCustomerOrders(true)
    }

    void createSocket()
      .then((createdSocket) => {
        if (!isMounted) {
          createdSocket.disconnect()
          return
        }

        socket = createdSocket
        socket.on('driver:location', handleLocation)
        socket.on(`order:${selectedOrderId}:driver-location`, handleLocation)
        socket.on(`order:${selectedOrderId}:updated`, handleOrderUpdated)
        socket.on('order:claimed', handleOrderClaimed)
        socket.on('order:updated', handleOrderUpdated)
        if (user?.id) {
          socket.on(`customer:${user.id}:driver-assigned`, handleCustomerDriverAssigned)
          socket.on(`customer:${user.id}:driver-delivering`, handleCustomerDriverDelivering)
          socket.on(`customer:${user.id}:delivery-completed`, handleDeliveryCompleted)
        }
      })
      .catch(() => {
        // Polling keeps tracking alive when Socket.io is unavailable.
      })

    return () => {
      isMounted = false
      if (socket) {
        socket.off('driver:location', handleLocation)
        socket.off(`order:${selectedOrderId}:driver-location`, handleLocation)
        socket.off(`order:${selectedOrderId}:updated`, handleOrderUpdated)
        socket.off('order:claimed', handleOrderClaimed)
        socket.off('order:updated', handleOrderUpdated)
        if (user?.id) {
          socket.off(`customer:${user.id}:driver-assigned`, handleCustomerDriverAssigned)
          socket.off(`customer:${user.id}:driver-delivering`, handleCustomerDriverDelivering)
          socket.off(`customer:${user.id}:delivery-completed`, handleDeliveryCompleted)
        }
        socket.disconnect()
      }
    }
  }, [loadCustomerOrders, loadTracking, selectedOrderId, showDeliveryCompletedNotice, showDriverDeliveringNotice, user?.id])

  const deliveringOrders = useMemo(
    () => customerOrders.filter((order) => isActiveDelivery(order.statusCode)),
    [customerOrders],
  )
  const visibleCustomerOrders = useMemo(() => {
    if (orderListFilter === 'delivering') {
      return deliveringOrders
    }
    return customerOrders
  }, [customerOrders, deliveringOrders, orderListFilter])

  const ORDERS_PER_PAGE = 4
  const [currentPage, setCurrentPage] = useState(1)

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [orderListFilter])

  const totalPages = Math.max(1, Math.ceil(visibleCustomerOrders.length / ORDERS_PER_PAGE))
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * ORDERS_PER_PAGE
    return visibleCustomerOrders.slice(start, start + ORDERS_PER_PAGE)
  }, [visibleCustomerOrders, currentPage])

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

  if (!isCustomer && !hasTrackableOrder && !queryOrderId) {
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

  if (isCustomer && ordersLoading && customerOrders.length === 0) {
    return (
      <section className="tracking-page">
        <p className="empty-state">Dang tai don hang cua ban...</p>
      </section>
    )
  }

  if (isCustomer && !ordersLoading && customerOrders.length === 0 && !ordersError) {
    return (
      <section className="tracking-page">
        <div className="tracking-empty">
          <span className="hero-badge">Don hang cua ban</span>
          <h1>Chua co don hang nao</h1>
          <p>Dat mon de xem lich su va theo doi giao hang tai day.</p>
          <Link className="button-primary" to="/">
            Dat mon ngay
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="tracking-page">
      <Modal
        title="Tai xe da nhan don"
        subtitle={driverAssignedNotice ? `Don ${driverAssignedNotice.orderCode}` : undefined}
        isOpen={driverAssignedNotice !== null}
        onClose={() => setDriverAssignedNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDriverAssignedNotice(null)}>
            Da hieu
          </button>
        }
      >
        {driverAssignedNotice ? (
          <p>
            <strong>{driverAssignedNotice.driverName}</strong> da nhan don va dang di lay mon cho ban.
          </p>
        ) : null}
      </Modal>

      <Modal
        title="Tai xe dang giao den ban"
        subtitle={driverDeliveringNotice ? `Don ${driverDeliveringNotice.orderCode}` : undefined}
        isOpen={driverDeliveringNotice !== null}
        onClose={() => setDriverDeliveringNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDriverDeliveringNotice(null)}>
            Da hieu
          </button>
        }
      >
        {driverDeliveringNotice ? (
          <div className="tracking-delivering-notice">
            <p>
              <strong>{driverDeliveringNotice.driverName}</strong> da lay mon xong va dang chuan bi giao den cho ban.
            </p>
            <p className="tracking-delivering-amount">
              Vui long chuan bi tien mat: <strong>{formatPrice(driverDeliveringNotice.cashToCollect)} VND</strong>
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Da giao hang thanh cong"
        subtitle={deliveryCompletedNotice ? `Don ${deliveryCompletedNotice.orderCode}` : undefined}
        isOpen={deliveryCompletedNotice !== null}
        onClose={() => setDeliveryCompletedNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDeliveryCompletedNotice(null)}>
            Da hieu
          </button>
        }
      >
        {deliveryCompletedNotice ? (
          <div className="tracking-completed-notice">
            <p>
              <strong>{deliveryCompletedNotice.driverName}</strong> da giao don hang den cho ban thanh cong.
            </p>
            <p className="tracking-completed-amount">
              Tong gia tri don: <strong>{formatPrice(deliveryCompletedNotice.totalAmount)} VND</strong>
            </p>
            <p>Cam on ban da su dung dich vu!</p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Xác nhận hủy đơn hàng"
        subtitle={tracking ? `Đơn hàng ${toOrderCode(tracking.order.id, tracking.order.orderCode)}` : undefined}
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button
              type="button"
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 transition-all cursor-pointer bg-white"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Quay lại
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer border-0"
              onClick={confirmCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? 'Đang hủy...' : 'Xác nhận hủy'}
            </button>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-left">
          <p className="text-xs text-gray-600 font-medium leading-relaxed">
            Bạn có chắc chắn muốn hủy đơn hàng này không? Món ăn đang được chuẩn bị và hành động này không thể hoàn tác.
          </p>
          <div className="flex flex-col gap-1 mt-3">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lý do hủy đơn (không bắt buộc)</label>
            <input
              type="text"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ví dụ: Đổi ý, Đặt trùng đơn,..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent font-medium bg-gray-50"
            />
          </div>
        </div>
      </Modal>

      <div className="tracking-header">
        <div>
          <span className="hero-badge">Theo doi truc tiep</span>
          <h1>Don hang cua ban</h1>
          <p>
            {isCustomer
              ? `${customerOrders.length} don da dat · ${deliveringOrders.length} don dang xu ly`
              : tracking?.order.orderCode || 'Dang tai thong tin don hang...'}
          </p>
        </div>
      </div>

      {ordersError ? <p className="app-feedback error">{ordersError}</p> : null}
      {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

      {/* === TRACKING DETAIL (info + map) — displayed first when order selected === */}
      {selectedOrderId ? (
      <div className="tracking-layout">
        <div className="tracking-map-card">
          <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false}>
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
              <span>Tien can thu</span>
              <strong>{tracking ? formatCurrency(tracking.order.cashToCollect) : '-'}</strong>
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

          <DriverProfilePanel driverId={tracking?.driver?.id} />

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
                <div
                  className={`tracking-item-thumb ${item.imageUrl ? '' : 'tracking-item-thumb--placeholder'}`}
                  style={foodPhotoStyle(item.imageUrl)}
                >
                  {!item.imageUrl ? <span>Chua anh</span> : null}
                </div>
                <div className="tracking-item-body">
                  <span>{item.quantity} x {item.foodName || `Mon #${item.foodId}`}</span>
                  <strong>{formatCurrency(item.lineTotal)}</strong>
                </div>
              </div>
            ))}
          </div>

          {tracking ? (
            <div className="order-price-section">
              <div className="order-price-row">
                <span>Tam tinh</span>
                <span>{formatCurrency(tracking.order.subtotalAmount)}</span>
              </div>
              <div className="order-price-row">
                <span>Phi giao hang</span>
                <span>{formatCurrency(tracking.order.shippingFee)}</span>
              </div>
              {tracking.order.discountAmount > 0 ? (
                <div className="order-price-row discount">
                  <span>Giam gia</span>
                  <span>-{formatCurrency(tracking.order.discountAmount)}</span>
                </div>
              ) : null}
              {tracking.order.taxAmount > 0 ? (
                <div className="order-price-row">
                  <span>Thue</span>
                  <span>{formatCurrency(tracking.order.taxAmount)}</span>
                </div>
              ) : null}
              <div className="order-price-divider" />
              <div className="order-price-row total">
                <span>Tong thanh toan</span>
                <span>{formatCurrency(tracking.order.totalAmount)}</span>
              </div>
            </div>
          ) : null}

          <Link className="button-secondary" to="/">
            Dat them mon
          </Link>

          {isCustomer && tracking && (tracking.order.statusCode === 'PENDING' || tracking.order.statusCode === 'CONFIRMED') && !tracking.order.driverId && (
            <button
              type="button"
              className="w-full py-2.5 mt-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
              onClick={() => setIsCancelModalOpen(true)}
            >
              Hủy đơn hàng
            </button>
          )}
        </aside>
      </div>
      ) : null}

      {/* === ORDER LIST with pagination — below tracking === */}
      {isCustomer ? (
        <section className="customer-orders-panel" aria-label="Danh sach don hang">
          <div className="customer-orders-toolbar">
            <div className="customer-orders-head">
              <h2>Don da dat</h2>
              <p>
                {customerOrders.length} don · {deliveringOrders.length} dang xu ly
              </p>
            </div>
            <button
              type="button"
              className="customer-orders-reload"
              onClick={() => void loadCustomerOrders()}
              disabled={ordersLoading}
            >
              {ordersLoading ? 'Dang tai...' : 'Tai lai'}
            </button>
          </div>

          <div className="customer-orders-filters" role="tablist" aria-label="Loc don hang">
            <button
              type="button"
              role="tab"
              aria-selected={orderListFilter === 'all'}
              className={orderListFilter === 'all' ? 'active' : ''}
              onClick={() => setOrderListFilter('all')}
            >
              Tat ca
              <span>{customerOrders.length}</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={orderListFilter === 'delivering'}
              className={orderListFilter === 'delivering' ? 'active' : ''}
              onClick={() => setOrderListFilter('delivering')}
            >
              Dang giao
              <span>{deliveringOrders.length}</span>
            </button>
          </div>

          <div className="customer-orders-list">
            {paginatedOrders.map((order) => {
              const isSelected = order.id === selectedOrderId
              const tone = getStatusTone(order.statusCode)
              const delivering = isActiveDelivery(order.statusCode)
              const restaurantName = order.restaurant?.name || `Quan #${order.restaurantId}`
              
              // Map friendly order status labels
              let friendlyStatusLabel = order.statusLabel || order.statusCode || 'Khong ro'
              if (order.statusCode === 'COMPLETED' || order.statusCode === 'DELIVERED') {
                friendlyStatusLabel = 'Đã giao'
              } else if (
                order.statusCode === 'CANCELLED' ||
                order.statusCode === 'CANCELED' ||
                order.statusCode === 'REJECTED' ||
                order.statusCode === 'TIMEOUT'
              ) {
                friendlyStatusLabel = 'Đã hủy'
              } else if (order.statusCode === 'PENDING') {
                friendlyStatusLabel = 'Chờ xác nhận'
              } else if (isActiveDelivery(order.statusCode)) {
                friendlyStatusLabel = 'Đang giao'
              }

              const isDeliverableForReorder = order.statusCode === 'COMPLETED' || order.statusCode === 'DELIVERED'

              return (
                <article
                  key={order.id}
                  className={`customer-order-card ${isSelected ? 'active' : ''} ${delivering ? 'delivering' : ''}`}
                >
                  <button
                    type="button"
                    className="customer-order-card__button"
                    onClick={() => selectOrder(order.id)}
                  >
                    {/* Top Row: Order code + Status badge */}
                    <div className="order-card-top">
                      <span className="order-card-code">
                        {toOrderCode(order.id, order.orderCode)}
                      </span>
                      <span className={`customer-order-status ${tone}`}>
                        {friendlyStatusLabel}
                      </span>
                    </div>

                    {/* Merchant & Time Body */}
                    <div className="order-card-body">
                      <h3 className="order-card-merchant">{restaurantName}</h3>
                      <span className="order-card-time">{formatOrderTime(order.createdAt)}</span>
                    </div>

                    {/* Items list */}
                    {order.items && order.items.length > 0 ? (
                      <div className="order-card-items">
                        {order.items.slice(0, 4).map((item) => (
                          <div key={item.id} className="order-card-item-row">
                            <span className="order-card-item-name">
                              {item.quantity}x {item.foodName || `Mon #${item.foodId}`}
                            </span>
                            <span className="order-card-item-price">{formatCurrency(item.lineTotal)}</span>
                          </div>
                        ))}
                        {order.items.length > 4 ? (
                          <p className="order-card-items-more">+{order.items.length - 4} mon khac</p>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Price Summary */}
                    <div className="order-card-price-summary">
                      <div className="order-card-price-divider" />
                      {order.shippingFee > 0 ? (
                        <div className="order-card-price-line">
                          <span>Phi giao hang</span>
                          <span>{formatCurrency(order.shippingFee)}</span>
                        </div>
                      ) : null}
                      {order.discountAmount > 0 ? (
                        <div className="order-card-price-line discount">
                          <span>Giam gia</span>
                          <span>-{formatCurrency(order.discountAmount)}</span>
                        </div>
                      ) : null}
                      <div className="order-card-total-line">
                        <span>Tổng thanh toán</span>
                        <span>{formatCurrency(order.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Action Hint & Reorder button */}
                    <div className="order-card-action">
                      {isDeliverableForReorder ? (
                        <button
                          type="button"
                          className="order-card-reorder-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/restaurants/${order.restaurantId}`)
                          }}
                        >
                          Đặt lại
                        </button>
                      ) : <div />}
                      
                      {delivering ? (
                        <span className="customer-order-live">
                          <span className="customer-order-live__dot" aria-hidden="true" />
                          Theo doi
                        </span>
                      ) : (
                        <span className="order-card-hint">
                          {isSelected ? 'Dang xem' : 'Xem chi tiet →'}
                        </span>
                      )}
                    </div>
                  </button>
                </article>
              )
            })}
            {!ordersLoading && paginatedOrders.length === 0 ? (
              <p className="customer-orders-empty">Khong co don phu hop bo loc.</p>
            ) : null}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="orders-pagination">
              <button
                type="button"
                className="orders-pagination-btn"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                ← Truoc
              </button>
              <div className="orders-pagination-pages">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    className={`orders-pagination-page ${page === currentPage ? 'active' : ''}`}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="orders-pagination-btn"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Tiep →
              </button>
            </div>
          ) : null}

          {/* Elegant Partner Registration Footer */}
          <footer className="partner-register-footer">
            <h3>Bạn muốn đồng hành cùng chúng tôi?</h3>
            <div className="partner-register-buttons">
              <button
                type="button"
                className="partner-btn partner-btn-merchant"
                onClick={() => window.open('/register?role=MERCHANT', '_blank')}
              >
                🏢 Đăng ký làm Đối tác Quán ăn
              </button>
              <button
                type="button"
                className="partner-btn partner-btn-driver"
                onClick={() => window.open('/register?role=DRIVER', '_blank')}
              >
                🛵 Đăng ký làm Tài xế
              </button>
            </div>
          </footer>
        </section>
      ) : null}

      {!isCustomer && !selectedOrderId ? (
        <p className="empty-state">Chon mot don hang de xem ban do theo doi.</p>
      ) : null}
    </section>
  )
}
