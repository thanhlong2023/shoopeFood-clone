import { httpDelete, httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, Food } from '../../types'

type FoodFilters = {
  restaurantId?: number
  categoryId?: number
  name?: string
  isAvailable?: boolean
}

export async function getFoods(filters: FoodFilters = {}) {
  const response = await httpGet<ApiResponse<Food[]>>('/api/foods', { query: filters })
  return response.data
}

export type FoodPayload = {
  categoryId: number | null
  name: string
  imageUrl?: string | null
  price: number
  isAvailable?: boolean
  defaultQuantity?: number
  currentQuantity?: number
}

export async function createFood(payload: FoodPayload) {
  const response = await httpPost<ApiResponse<Food>>('/api/foods', payload)
  return response.data
}

export async function updateFood(id: number, payload: Partial<FoodPayload>) {
  const response = await httpPut<ApiResponse<Food>>(`/api/foods/${id}`, payload)
  return response.data
}

export async function deleteFood(id: number) {
  const response = await httpDelete<ApiResponse<Food>>(`/api/foods/${id}`)
  return response.data
}
