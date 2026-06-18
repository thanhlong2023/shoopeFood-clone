import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { getOrderById } from '../../services/api/orders'
import { createSocket } from '../../services/socket'
import type { Driver, Order } from '../../types'
import { formatCurrency, toOrderCode } from '../../utils/formatters'

type DriverWaitingOverlayProps = {
  order: Order | null
}

type CustomerDriverAssignedPayload = {
  orderId: number
  orderCode: string
  driver?: Driver | null
}

const DRIVER_READY_STATUSES = new Set(['DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'PICKING_UP', 'DELIVERING'])

function isDriverReady(statusCode?: string | null) {
  return Boolean(statusCode && DRIVER_READY_STATUSES.has(statusCode))
}

export default function DriverWaitingOverlay({ order }: DriverWaitingOverlayProps) {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    if (!order) {
      return undefined
    }

    if (isDriverReady(order.statusCode)) {
      navigate(`/tracking?orderId=${order.id}`, { replace: true })
      return undefined
    }

    let isMounted = true
    let socket: Awaited<ReturnType<typeof createSocket>> | null = null

    const goToTracking = () => {
      if (isMounted) {
        navigate(`/tracking?orderId=${order.id}`, { replace: true })
      }
    }

    const handleOrderUpdated = (payload: Order) => {
      if (Number(payload.id) === Number(order.id) && isDriverReady(payload.statusCode)) {
        goToTracking()
      }
    }

    const handleCustomerDriverAssigned = (payload: CustomerDriverAssignedPayload) => {
      if (Number(payload.orderId) === Number(order.id)) {
        goToTracking()
      }
    }

    const pollTimer = window.setInterval(() => {
      void getOrderById(order.id)
        .then((latestOrder) => {
          if (isDriverReady(latestOrder.statusCode)) {
            goToTracking()
          }
        })
        .catch(() => {
          // Socket and manual refresh still keep the user in the waiting state.
        })
    }, 3500)

    void createSocket()
      .then((createdSocket) => {
        if (!isMounted) {
          createdSocket.disconnect()
          return
        }

        socket = createdSocket
        socket.on(`order:${order.id}:updated`, handleOrderUpdated)
        socket.on('order:updated', handleOrderUpdated)
        socket.on('order:claimed', handleOrderUpdated)
        if (user?.id) {
          socket.on(`customer:${user.id}:driver-assigned`, handleCustomerDriverAssigned)
        }
      })
      .catch(() => {
        // Polling handles this case.
      })

    return () => {
      isMounted = false
      window.clearInterval(pollTimer)
      if (socket) {
        socket.off(`order:${order.id}:updated`, handleOrderUpdated)
        socket.off('order:updated', handleOrderUpdated)
        socket.off('order:claimed', handleOrderUpdated)
        if (user?.id) {
          socket.off(`customer:${user.id}:driver-assigned`, handleCustomerDriverAssigned)
        }
        socket.disconnect()
      }
    }
  }, [navigate, order, user?.id])

  if (!order) {
    return null
  }

  return (
    <div className="driver-wait-overlay" role="dialog" aria-modal="true" aria-labelledby="driver-wait-title">
      <div className="driver-wait-dialog">
        <div className="driver-wait-spinner" aria-hidden="true" />
        <p className="payment-kicker">Đơn hàng đã được xác nhận</p>
        <h2 id="driver-wait-title">Đang chờ tài xế nhận đơn</h2>
        <p>
          {toOrderCode(order.id, order.orderCode)} · {formatCurrency(order.totalAmount)}
        </p>
      </div>
    </div>
  )
}
