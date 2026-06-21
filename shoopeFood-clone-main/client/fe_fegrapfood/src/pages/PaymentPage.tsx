import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { createOrder } from '../services/api/orders'
import { buildCreateOrderPayloadFromDraft, clearCheckoutDraft, getCheckoutDraft, notifyCartCleared, type CheckoutDraft } from '../utils/checkoutDraft'
import { formatCurrency } from '../utils/formatters'
import { setLastOrderId } from '../utils/orderStorage'
import { ErrorModal } from '../components/ErrorModal'

type PaymentMethod = 'CASH' | 'QR'

function shippingTypeLabel(type: CheckoutDraft['shippingType']) {
  if (type === 'FAST') return 'Giao nhanh'
  if (type === 'ECO') return 'Tiết kiệm'
  return 'Tiêu chuẩn'
}

export default function PaymentPage() {
  useDocumentTitle(`${APP_NAME} | Thanh toán`)
  const navigate = useNavigate()
  const { user } = useAuth()
  const [draft] = useState(() => getCheckoutDraft())
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function confirmOrder() {
    if (!draft || isSubmitting) {
      return
    }

    if (method === 'QR') {
      navigate('/payment/qr')
      return
    }

    try {
      setErrorMessage(null)
      setIsSubmitting(true)
      const payload = buildCreateOrderPayloadFromDraft(draft)
      if (note.trim()) {
        payload.note = note.trim()
      }
      const order = await createOrder(payload)
      setLastOrderId(order.id)
      clearCheckoutDraft()
      notifyCartCleared()
      navigate(`/tracking?orderId=${order.id}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tạo đơn hàng')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!draft) {
    return (
      <section className="payment-shell">
        <div className="payment-empty">
          <p className="payment-kicker">Thanh toán</p>
          <h1>Chưa có đơn hàng để thanh toán</h1>
          <p>Giỏ hàng tạm thời không còn dữ liệu. Vui lòng quay lại chọn món rồi đặt đơn hàng lại.</p>
          <Link to="/food" className="payment-primary-button">
            Quay lại đặt món
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="payment-shell">
      <div className="payment-container">
        <header className="payment-header">
          <div>
            <p className="payment-kicker">Thanh toán</p>
            <h1>Xác nhận đơn hàng</h1>
            <p>{draft.restaurant.name} · {draft.receiver.address}</p>
          </div>
          <Link to="/food" className="payment-secondary-button">
            Chỉnh sửa giỏ hàng
          </Link>
        </header>

        <ErrorModal isOpen={!!errorMessage} message={errorMessage || ''} onClose={() => setErrorMessage(null)} />

        <div className="payment-layout">
          <main className="payment-main">
            <section className="payment-card payment-card--restaurant">
              <div>
                <p className="payment-section-label">Thông tin sản phẩm</p>
                <h2>{draft.restaurant.name}</h2>
                <p>{draft.restaurant.address}</p>
              </div>
              <span className="payment-rating">★ {Number(draft.restaurant.ratingAvg || 0).toFixed(1)}</span>
            </section>

            <section className="payment-card">
              <div className="payment-items">
                {draft.items.map((item) => (
                  <article key={item.foodId} className="payment-item">
                    <div
                      className="payment-item__image"
                      style={{
                        backgroundImage: item.imageUrl ? `url("${item.imageUrl}")` : 'linear-gradient(135deg, #e9f7ef, #ffffff)',
                      }}
                    />
                    <div className="payment-item__body">
                      <h3>{item.name}</h3>
                      {item.toppingNames && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.toppingNames}</p>
                      )}
                      <p className="mt-1">
                        {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                    <strong>{formatCurrency(item.lineTotal)}</strong>
                  </article>
                ))}
              </div>
            </section>

            <section className="payment-info-grid">
              <div className="payment-card">
                <p className="payment-section-label">Người nhận</p>
                <h2>{user?.fullName || 'Khách hàng'}</h2>
                <p>{user?.phone || 'Chưa có số điện thoại'}</p>
                <div className="payment-soft-box">{draft.receiver.address}</div>
              </div>
              <div className="payment-card">
                <p className="payment-section-label">Giao hàng</p>
                <h2>{shippingTypeLabel(draft.shippingType)}</h2>
                <p>Khoảng cách {draft.receiver.distanceKm.toFixed(1)} km</p>
                <div className="payment-soft-box">
                  {draft.receiver.address}
                </div>
              </div>
            </section>

            <section className="payment-card mt-6">
              <p className="payment-section-label">Ghi chú cho nhà hàng</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Ít cay, không hành..."
                className="w-full mt-2 p-3 border border-gray-200 rounded-xl resize-none text-sm focus:outline-none focus:border-brand"
                rows={3}
              />
            </section>
          </main>

          <aside className="payment-side">
            <section className="payment-card">
              <p className="payment-section-label">Chi tiết thanh toán</p>
              <div className="payment-price-list">
                <div>
                  <span>Tiền đồ ăn</span>
                  <strong>{formatCurrency(draft.pricing.subtotalAmount)}</strong>
                </div>
                <div>
                  <span>Phí giao hàng</span>
                  <strong>{formatCurrency(draft.pricing.shippingFee)}</strong>
                </div>
                {draft.pricing.discountAmount > 0 ? (
                  <div className="is-discount">
                    <span>Giảm giá</span>
                    <strong>-{formatCurrency(draft.pricing.discountAmount)}</strong>
                  </div>
                ) : null}
                <div>
                  <span>Thuế</span>
                  <strong>{formatCurrency(draft.pricing.taxAmount)}</strong>
                </div>
                <div className="payment-total">
                  <span>Tổng thanh toán</span>
                  <strong>{formatCurrency(draft.pricing.totalAmount)}</strong>
                </div>
              </div>
            </section>

            <section className="payment-card">
              <p className="payment-section-label">Hình thức thanh toán</p>
              <div className="payment-methods">
                <button type="button" className={method === 'CASH' ? 'payment-method is-selected' : 'payment-method'} onClick={() => setMethod('CASH')}>
                  <span>
                    <strong>Trả khi nhận hàng</strong>
                    <small>Thanh toán tiền mặt cho tài xế.</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
                <button type="button" className={method === 'QR' ? 'payment-method is-selected' : 'payment-method'} onClick={() => setMethod('QR')}>
                  <span>
                    <strong>Thanh toán bằng mã QR</strong>
                    <small>Chuyển sang bước QR mock.</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              </div>
              <button type="button" className="payment-primary-button payment-confirm-button" onClick={() => void confirmOrder()} disabled={isSubmitting}>
                {isSubmitting ? 'Đang xác nhận...' : 'Xác nhận đơn hàng'}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </section>
  )
}
