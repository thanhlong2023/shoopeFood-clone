import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MockQrCode from '../components/payment/MockQrCode'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createOrder } from '../services/api/orders'
import { buildCreateOrderPayloadFromDraft, clearCheckoutDraft, getCheckoutDraft, notifyCartCleared } from '../utils/checkoutDraft'
import { formatCurrency } from '../utils/formatters'
import { setLastOrderId } from '../utils/orderStorage'
import { ErrorModal } from '../components/ErrorModal'

type QrStage = 'ready' | 'processing' | 'success'

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function resolveStep(stage: QrStage) {
  if (stage === 'success') return 2
  if (stage === 'processing') return 1
  return 0
}

export default function QrPaymentPage() {
  useDocumentTitle(`${APP_NAME} | Thanh toán QR`)
  const navigate = useNavigate()
  const [draft] = useState(() => getCheckoutDraft())
  const [stage, setStage] = useState<QrStage>('ready')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleMockPaid() {
    if (!draft || isSubmitting) {
      return
    }

    try {
      setErrorMessage(null)
      setIsSubmitting(true)
      setStage('processing')
      await wait(1200)
      const order = await createOrder(buildCreateOrderPayloadFromDraft(draft))
      setStage('success')
      setLastOrderId(order.id)
      clearCheckoutDraft()
      notifyCartCleared()
      navigate(`/tracking?orderId=${order.id}`)
    } catch (error) {
      setStage('ready')
      setErrorMessage(error instanceof Error ? error.message : 'Không thể xác nhận thanh toán')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!draft) {
    return (
      <section className="payment-shell">
        <div className="payment-empty">
          <p className="payment-kicker">Thanh toán QR</p>
          <h1>Không có đơn hàng cần thanh toán</h1>
          <p>Giỏ hàng tạm thời không còn dữ liệu.</p>
          <Link to="/food" className="payment-primary-button">
            Quay lại đặt món
          </Link>
        </div>
      </section>
    )
  }

  const currentStep = resolveStep(stage)

  return (
    <section className="payment-shell payment-shell--compact">
      <div className="payment-qr-layout">
        <header className="payment-header payment-header--center">
          <p className="payment-kicker">Thanh toán online</p>
          <h1>Quét mã QR để thanh toán</h1>
          <p>{draft.restaurant.name}</p>
        </header>

        <div className="payment-progress">
          {['Quét mã QR', 'Đang thanh toán', 'Hoàn tất'].map((step, index) => (
            <div key={step} className={index <= currentStep ? 'payment-progress__step is-active' : 'payment-progress__step'}>
              <span>{index + 1}</span>
              <strong>{step}</strong>
            </div>
          ))}
        </div>

        <ErrorModal isOpen={!!errorMessage} message={errorMessage || ''} onClose={() => setErrorMessage(null)} />

        <main className="payment-qr-card">
          <MockQrCode seed={draft.idempotencyKey} />
          <div className="payment-qr-amount">
            <span>Số tiền</span>
            <strong>{formatCurrency(draft.pricing.totalAmount)}</strong>
          </div>
          <p className="payment-qr-order">{draft.idempotencyKey}</p>

          <div className="payment-qr-actions">
            <Link to="/payment" className="payment-secondary-button">
              Quay lại thay đổi phương thức thanh toán
            </Link>
            <button type="button" className="payment-primary-button" onClick={() => void handleMockPaid()} disabled={isSubmitting}>
              {isSubmitting ? 'Đang thanh toán...' : 'Mock giả đã thanh toán'}
            </button>
          </div>
        </main>
      </div>
    </section>
  )
}
