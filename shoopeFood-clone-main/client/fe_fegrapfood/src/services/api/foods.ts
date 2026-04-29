import { httpGet } from './http'
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
