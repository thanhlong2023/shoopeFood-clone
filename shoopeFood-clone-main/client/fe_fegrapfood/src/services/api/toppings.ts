import type { ApiResponse, Topping } from '../../types'
import { httpDelete, httpGet, httpPost, httpPut } from './http'

export async function getRestaurantToppings(restaurantId: number): Promise<Topping[]> {
  const result = await httpGet<ApiResponse<Topping[]>>(`/api/restaurants/${restaurantId}/toppings`)
  return result.data || []
}

export async function createTopping(restaurantId: number, payload: { name: string; price: number; isAvailable?: boolean; defaultQuantity?: number; currentQuantity?: number; startDate?: string; endDate?: string }): Promise<Topping> {
  const result = await httpPost<ApiResponse<Topping>>(`/api/restaurants/${restaurantId}/toppings`, payload)
  return result.data
}

export async function updateTopping(toppingId: number, payload: { name?: string; price?: number; isAvailable?: boolean; defaultQuantity?: number; currentQuantity?: number; startDate?: string; endDate?: string }): Promise<Topping> {
  const result = await httpPut<ApiResponse<Topping>>(`/api/toppings/${toppingId}`, payload)
  return result.data
}

export async function deleteTopping(toppingId: number): Promise<void> {
  await httpDelete(`/api/toppings/${toppingId}`)
}

export async function assignToFood(foodId: number, toppingIds: number[]): Promise<Topping[]> {
  const result = await httpPost<ApiResponse<Topping[]>>(`/api/foods/${foodId}/toppings`, { toppingIds })
  return result.data || []
}
