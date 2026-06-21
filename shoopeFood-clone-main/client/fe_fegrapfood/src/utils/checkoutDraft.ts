import type { CreateOrderPayload, Restaurant } from '../types'

export const CHECKOUT_DRAFT_STORAGE_KEY = 'grabfood.checkoutDraft'

export type CheckoutDraftItem = {
  foodId: number
  name: string
  imageUrl: string | null
  price: number
  quantity: number
  toppings?: { id: number; quantity: number }[]
  toppingNames?: string
  lineTotal: number
}

export type CheckoutDraft = {
  id: string
  createdAt: string
  idempotencyKey: string
  note?: string
  restaurant: Pick<Restaurant, 'id' | 'name' | 'address' | 'imageUrl' | 'ratingAvg'>
  receiver: {
    address: string
    lat: number
    lng: number
    distanceKm: number
    placeId?: string
    formattedAddress?: string
    province?: string
    district?: string
    ward?: string
    street?: string
    houseNumber?: string
    provider?: string
  }
  shippingType: NonNullable<CreateOrderPayload['shippingType']>
  pricing: {
    subtotalAmount: number
    shippingFee: number
    discountAmount: number
    taxAmount: number
    totalAmount: number
  }
  items: CheckoutDraftItem[]
}

export function saveCheckoutDraft(draft: CheckoutDraft) {
  sessionStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
}

export function getCheckoutDraft(): CheckoutDraft | null {
  const raw = sessionStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as CheckoutDraft

    if (!parsed.restaurant?.id || !Array.isArray(parsed.items) || parsed.items.length === 0) {
      clearCheckoutDraft()
      return null
    }

    return parsed
  } catch {
    clearCheckoutDraft()
    return null
  }
}

export function clearCheckoutDraft() {
  sessionStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY)
}

export function notifyCartCleared() {
  window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: 0 } }))
}

export function buildCreateOrderPayloadFromDraft(draft: CheckoutDraft): CreateOrderPayload {
  return {
    restaurantId: draft.restaurant.id,
    receiverAddress: draft.receiver.address,
    receiverLat: draft.receiver.lat,
    receiverLng: draft.receiver.lng,
    distanceKm: draft.receiver.distanceKm,
    shippingType: draft.shippingType,
    discountAmount: draft.pricing.discountAmount,
    taxAmount: draft.pricing.taxAmount,
    idempotencyKey: draft.idempotencyKey,
    note: draft.note,
    items: draft.items.map((item) => ({
      foodId: item.foodId,
      quantity: item.quantity,
      toppings: item.toppings,
    })),
  }
}
