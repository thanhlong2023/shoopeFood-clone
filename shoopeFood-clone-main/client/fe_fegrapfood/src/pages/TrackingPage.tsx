import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useTrackableOrder } from '../hooks/useTrackableOrder'
import { getOrders, getOrderTracking, cancelOrder } from '../services/api/orders'
import { createReview } from '../services/api/reviews'
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
    { code: 'DRIVER_ACCEPTED', label: 'T�i x? nhan' },
    { code: 'PICKING_UP', label: 'Lay mon' },
    { code: 'DELIVERING', label: 'Dang giao' },
    { code: 'COMPLETED', label: 'Hoàn thành' },
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
  useDocumentTitle(`${APP_NAME} | Theo d�i don`)
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
  const [reviewRating, setReviewRating] = useState(5)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null)
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
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
        driverName: payload.driver?.fullName || 'T�i x?',
        orderCode: payload.orderCode,
        totalAmount: Number(payload.totalAmount ?? 0),
      })
    },
    [],
  )

  async function handleSubmitRestaurantReview() {
    if (!tracking) return

    try {
      setIsSubmittingReview(true)
      setReviewFeedback(null)
      await createReview({
        orderId: tracking.order.id,
        targetType: 'RESTAURANT',
        rating: reviewRating,
        comment: reviewComment,
      })
      setReviewFeedback('�� g?i d�nh gi� nh� h�ng. C?m on b?n!')
      setReviewComment('')
    } catch (error) {
      setReviewFeedback(error instanceof Error ? error.message : 'Kh�ng th? g?i d�nh gi�')
    } finally {
      setIsSubmittingReview(false)
    }
  }

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
        driverName: payload.driver?.fullName || 'T�i x?',
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
      setOrdersError(error instanceof Error ? error.message : 'Kh�ng th? t?i danh s�ch don h�ng')
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
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? t?i tracking')
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
        socket.emit('order:join', { orderId: selectedOrderId })
        if (user?.id) {
          socket.emit('customer:join', { customerId: user.id })
        }
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
        socket.emit('order:leave', { orderId: selectedOrderId })
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

  const simulatedDriverLocation = driverLocation

  const bounds = useMemo(() => {
    const points: { latitude: number; longitude: number }[] = []
    if (simulatedDriverLocation) {
      points.push({ latitude: simulatedDriverLocation.latitude, longitude: simulatedDriverLocation.longitude })
    }
    if (tracking?.restaurant) points.push(tracking.restaurant)
    if (tracking?.destination) points.push(tracking.destination)
    return points
  }, [simulatedDriverLocation, tracking])

  const routeLegs = tracking?.route?.legs || []
  const driverPoint = simulatedDriverLocation ? { latitude: simulatedDriverLocation.latitude, longitude: simulatedDriverLocation.longitude } : null
  const nextPoint = tracking?.routePoints.find((point) => driverPoint && Math.hypot(point.latitude - driverPoint.latitude, point.longitude - driverPoint.longitude) > 0.0005)
  const motoHeading = simulatedDriverLocation?.heading || (driverPoint && nextPoint ? getHeading(driverPoint, nextPoint) : 0)
  const mapCenter: [number, number] = driverPoint
    ? toLatLng(driverPoint)
    : tracking?.restaurant
      ? [tracking.restaurant.latitude, tracking.restaurant.longitude]
      : defaultCenter

  if (!isCustomer && !hasTrackableOrder && !queryOrderId) {
    return (
      <section className="tracking-page">
        <div className="tracking-empty">
          <span className="hero-badge">Theo d�i don hang</span>
          <h1>Chua c� don h�ng d? theo d�i</h1>
          <p>�?t m�n xong b?n s? th?y ti?n tr�nh giao h�ng v� l? tr�nh t�i x? t?i d�y.</p>
          <Link className="button-primary" to="/food">
            �?t m�n ngay
          </Link>
        </div>
      </section>
    )
  }

  if (isCustomer && ordersLoading && customerOrders.length === 0) {
    return (
      <section className="tracking-page">
        <p className="empty-state">�ang t?i don hang cua ban...</p>
      </section>
    )
  }

  if (isCustomer && !ordersLoading && customerOrders.length === 0 && !ordersError) {
    return (
      <section className="tracking-page">
        <div className="tracking-empty">
          <span className="hero-badge">�on hang cua ban</span>
          <h1>Chua c� don h�ng n�o</h1>
          <p>�?t m�n d? xem l?ch s? v� theo d�i giao h�ng t?i d�y.</p>
          <Link className="button-primary" to="/food">
            �?t m�n ngay
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="tracking-page">
      <Modal
        title="T�i x? d� nh?n don"
        subtitle={driverAssignedNotice ? `�on ${driverAssignedNotice.orderCode}` : undefined}
        isOpen={driverAssignedNotice !== null}
        onClose={() => setDriverAssignedNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDriverAssignedNotice(null)}>
            �� hi?u
          </button>
        }
      >
        {driverAssignedNotice ? (
          <p>
            <strong>{driverAssignedNotice.driverName}</strong> d� nh?n don v� dang di l?y m�n cho b?n.
          </p>
        ) : null}
      </Modal>

      <Modal
        title="T�i x? dang giao d?n b?n"
        subtitle={driverDeliveringNotice ? `�on ${driverDeliveringNotice.orderCode}` : undefined}
        isOpen={driverDeliveringNotice !== null}
        onClose={() => setDriverDeliveringNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDriverDeliveringNotice(null)}>
            �� hi?u
          </button>
        }
      >
        {driverDeliveringNotice ? (
          <div className="tracking-delivering-notice">
            <p>
              <strong>{driverDeliveringNotice.driverName}</strong> d� l?y m�n xong v� dang chu?n b? giao d?n cho b?n.
            </p>
            <p className="tracking-delivering-amount">
              Vui l�ng chu?n b? ti?n m?t: <strong>{formatPrice(driverDeliveringNotice.cashToCollect)} VND</strong>
            </p>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="�� giao h�ng th�nh c�ng"
        subtitle={deliveryCompletedNotice ? `�on ${deliveryCompletedNotice.orderCode}` : undefined}
        isOpen={deliveryCompletedNotice !== null}
        onClose={() => setDeliveryCompletedNotice(null)}
        footer={
          <button type="button" className="button-primary" onClick={() => setDeliveryCompletedNotice(null)}>
            �� hi?u
          </button>
        }
      >
        {deliveryCompletedNotice ? (
          <div className="tracking-completed-notice">
            <p>
              <strong>{deliveryCompletedNotice.driverName}</strong> d� giao don h�ng d?n cho b?n th�nh c�ng.
            </p>
            <p className="tracking-completed-amount">
              T?ng gi� tr? don: <strong>{formatPrice(deliveryCompletedNotice.totalAmount)} VND</strong>
            </p>
            <p>C?m on b?n d� s? d?ng d?ch v?!</p>
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
          <span className="hero-badge">Theo d�i tr?c ti?p</span>
          <h1>�on hang cua ban</h1>
          <p>
            {isCustomer
              ? `${customerOrders.length} don da dat · ${deliveringOrders.length} don dang x? l�`
              : tracking?.order.orderCode || '�ang t?i th�ng tin don h�ng...'}
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
            <MapAutoFit points={bounds} />

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

            {simulatedDriverLocation ? (
              <>
                <Marker position={[simulatedDriverLocation.latitude, simulatedDriverLocation.longitude]} icon={makeMotoIcon(motoHeading)}>
                  <Popup>{tracking?.driver?.fullName || 'T�i x?'}</Popup>
                </Marker>
                <CircleMarker center={[simulatedDriverLocation.latitude, simulatedDriverLocation.longitude]} radius={16} pathOptions={{ color: '#00b14f', opacity: 0.2 }} />
              </>
            ) : null}
          </MapContainer>
        </div>

        <aside className="tracking-card">
          <div className="tracking-card-head">
            <span>{isLoading ? '�ang t?i' : tracking?.order.statusLabel || tracking?.order.statusCode || 'Ch? t�i x?'}</span>
            <strong>{tracking ? `${tracking.routeProgress}%` : '0%'}</strong>
          </div>

          <StatusSteps order={tracking?.order || null} />

          <div className="tracking-info-grid">
            <div>
              <span>Nh� h�ng</span>
              <strong>{tracking?.restaurant?.name || '�ang c?p nh?t'}</strong>
            </div>
            <div>
              <span>T�i x?</span>
              <strong>{tracking?.driver?.fullName || 'Chua c� t�i x?'}</strong>
            </div>
            <div>
              <span>S�T kh�ch</span>
              <strong>{tracking?.order.customerPhone || '-'}</strong>
            </div>
            <div>
              <span>Bi?n s?</span>
              <strong>{tracking?.driver?.licensePlate || '-'}</strong>
            </div>
            <div>
              <span>Ti?n c?n thu</span>
              <strong>{tracking ? formatCurrency(tracking.order.cashToCollect) : '-'}</strong>
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

          <DriverProfilePanel driverId={tracking?.driver?.id} />

          <div className="driver-route-list">
            {routeLegs.map((leg) => (
              <div key={leg.key} className="driver-route-leg">
                <div>
                  <strong>{leg.label}</strong>
                  <span>{leg.ok ? `${formatDistance(leg.distanceKm)} - ${formatDuration(leg.durationMinutes)}` : leg.error || 'Chua c� l? tr�nh'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tracking-items">
            <h2>M�n d� d?t</h2>
            {(tracking?.order.items || []).map((item) => (
              <div key={item.id} className="tracking-item">
                <div
                  className={`tracking-item-thumb ${item.imageUrl ? '' : 'tracking-item-thumb--placeholder'}`}
                  style={foodPhotoStyle(item.imageUrl, item.id)}
                >
                  {!item.imageUrl ? <span>Chua ?nh</span> : null}
                </div>
                <div className="tracking-item-body">
                  <span>{item.quantity} x {item.foodName || `M�n #${item.foodId}`}</span>
                  <strong>{formatCurrency(item.lineTotal)}</strong>
                </div>
              </div>
            ))}
          </div>

          {tracking ? (
            <div className="order-price-section">
              <div className="order-price-row">
                <span>T?m t�nh</span>
                <span>{formatCurrency(tracking.order.subtotalAmount)}</span>
              </div>
              <div className="order-price-row">
                <span>Ph� giao h�ng</span>
                <span>{formatCurrency(tracking.order.shippingFee)}</span>
              </div>
              {tracking.order.discountAmount > 0 ? (
                <div className="order-price-row discount">
                  <span>Gi?m gi�</span>
                  <span>-{formatCurrency(tracking.order.discountAmount)}</span>
                </div>
              ) : null}
              {tracking.order.taxAmount > 0 ? (
                <div className="order-price-row">
                  <span>Thu?</span>
                  <span>{formatCurrency(tracking.order.taxAmount)}</span>
                </div>
              ) : null}
              <div className="order-price-divider" />
              <div className="order-price-row total">
                <span>T?ng thanh to�n</span>
                <span>{formatCurrency(tracking.order.totalAmount)}</span>
              </div>
            </div>
          ) : null}

          <Link className="button-secondary" to="/food">
            �?t th�m m�n
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
          {isCustomer && tracking?.order.statusCode === 'COMPLETED' ? (
            <div className="mt-4 rounded-2xl border border-yellow-100 bg-yellow-50 p-4">
              <h3 className="text-sm font-black text-gray-900">��nh gi� nh� h�ng</h3>
              <p className="mt-1 text-xs font-semibold text-gray-500">�on da hoan thanh, ban co the cham sao cho trai nghiem vua roi.</p>
              <div className="mt-3 flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`text-2xl ${star <= reviewRating ? 'text-yellow-500' : 'text-gray-300'}`}
                    onClick={() => setReviewRating(star)}
                    aria-label={`${star} sao`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <textarea
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={3}
                className="mt-3 w-full rounded-xl border border-yellow-100 bg-white p-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-yellow-300"
                placeholder="Nh?n x�t ng?n v? nh� h�ng..."
              />
              <button
                type="button"
                className="mt-3 w-full rounded-xl bg-yellow-500 px-4 py-2.5 text-xs font-black text-white disabled:bg-gray-200 disabled:text-gray-400"
                onClick={() => void handleSubmitRestaurantReview()}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? '�ang g?i...' : 'G?i d�nh gi�'}
              </button>
              {reviewFeedback ? <p className="mt-2 text-xs font-bold text-gray-600">{reviewFeedback}</p> : null}
            </div>
          ) : null}
        </aside>
      </div>
      ) : null}

      {/* === ORDER LIST with pagination — below tracking === */}
      {isCustomer ? (
        <section className="customer-orders-panel" aria-label="Danh sach don hang">
          <div className="customer-orders-toolbar">
            <div className="customer-orders-head">
              <h2>�on da dat</h2>
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
              {ordersLoading ? '�ang t?i...' : 'Tai lai'}
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
              T?t c?
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
                              {item.quantity}x {item.foodName || `M�n #${item.foodId}`}
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
                          <span>Ph� giao h�ng</span>
                          <span>{formatCurrency(order.shippingFee)}</span>
                        </div>
                      ) : null}
                      {order.discountAmount > 0 ? (
                        <div className="order-card-price-line discount">
                          <span>Gi?m gi�</span>
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
                          Theo d�i
                        </span>
                      ) : (
                        <span className="order-card-hint">
                          {isSelected ? '�ang xem' : 'Xem chi ti?t →'}
                        </span>
                      )}
                    </div>
                  </button>
                </article>
              )
            })}
            {!ordersLoading && paginatedOrders.length === 0 ? (
              <p className="customer-orders-empty">Kh�ng c� don ph� h?p b? l?c.</p>
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
                ← Tru?c
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
                Ti?p →
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
                Đăng ký làm đối tác Quán ăn
              </button>
              <button
                type="button"
                className="partner-btn partner-btn-driver"
                onClick={() => window.open('/register?role=DRIVER', '_blank')}
              >
                Đăng ký làm Tài xế
              </button>
            </div>
          </footer>
        </section>
      ) : null}

      {!isCustomer && !selectedOrderId ? (
        <p className="empty-state">Chọn một đơn hàng để xem bản đồ theo dõi.</p>
      ) : null}
    </section>
  )
}
