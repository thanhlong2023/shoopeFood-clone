import { httpGet } from './http'
import type { ApiResponse, Category } from '../../types'

type CategoryFilters = {
  restaurantId?: number
}

export async function getCategories(filters: CategoryFilters = {}) {
  const response = await httpGet<ApiResponse<Category[]>>('/api/categories', { query: filters })
  return response.data
}
