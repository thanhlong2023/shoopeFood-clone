export const CART_DRAFT_STORAGE_KEY = 'grabfood.cartDraft'

export type CartItemDraft = {
  foodId: number
  quantity: number
  toppings: { id: number; quantity: number }[]
}

export type CartState = Record<string, CartItemDraft>

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
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null

    // Migrate old format Record<number, number> to Record<string, CartItemDraft>
    const migratedCart: CartState = {}
    if (parsed.cart && typeof parsed.cart === 'object') {
      for (const [key, val] of Object.entries(parsed.cart)) {
        if (typeof val === 'number') {
          // Old format
          const foodId = Number(key)
          migratedCart[String(foodId)] = { foodId, quantity: val, toppings: [] }
        } else {
          // New format
          migratedCart[key] = val as CartItemDraft
        }
      }
    }
    return { restaurantId: parsed.restaurantId, cart: migratedCart } as CartDraft
  } catch {
    return null
  }
}

export function clearCartDraft() {
  sessionStorage.removeItem(CART_DRAFT_STORAGE_KEY)
}
