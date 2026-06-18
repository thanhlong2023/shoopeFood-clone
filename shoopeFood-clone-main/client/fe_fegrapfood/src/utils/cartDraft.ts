export const CART_DRAFT_STORAGE_KEY = 'grabfood.cartDraft'

export type CartState = Record<number, number>

export type CartDraft = {
  restaurantId: number | null
  cart: CartState
}

export function saveCartDraft(draft: CartDraft) {
  try {
    sessionStorage.setItem(CART_DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch (error) {
    console.error('Failed to save cart draft', error)
  }
}

export function getCartDraft(): CartDraft | null {
  const raw = sessionStorage.getItem(CART_DRAFT_STORAGE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as CartDraft
    if (typeof parsed !== 'object' || parsed === null) return null
    return parsed
  } catch {
    return null
  }
}

export function clearCartDraft() {
  sessionStorage.removeItem(CART_DRAFT_STORAGE_KEY)
}
