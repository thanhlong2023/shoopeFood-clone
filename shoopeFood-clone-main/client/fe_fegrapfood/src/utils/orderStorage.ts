import { LAST_ORDER_STORAGE_KEY, ORDER_UPDATED_EVENT } from '../constants/order'

const LEGACY_LAST_ORDER_STORAGE_KEY = 'lastOrderId'

export function getLastOrderId(): number | null {
  let raw = localStorage.getItem(LAST_ORDER_STORAGE_KEY)

  if (!raw) {
    raw = localStorage.getItem(LEGACY_LAST_ORDER_STORAGE_KEY)
    if (raw) {
      localStorage.setItem(LAST_ORDER_STORAGE_KEY, raw)
      localStorage.removeItem(LEGACY_LAST_ORDER_STORAGE_KEY)
    }
  }

  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

export function setLastOrderId(orderId: number) {
  localStorage.setItem(LAST_ORDER_STORAGE_KEY, String(orderId))
  window.dispatchEvent(new CustomEvent(ORDER_UPDATED_EVENT, { detail: { orderId } }))
}

export function hasTrackableOrder() {
  return getLastOrderId() !== null
}
