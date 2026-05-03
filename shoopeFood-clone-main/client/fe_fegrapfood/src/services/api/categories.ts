import { httpDelete, httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, Category } from '../../types'

type CategoryFilters = {
  restaurantId?: number
}

export async function getCategories(filters: CategoryFilters = {}) {
  const response = await httpGet<ApiResponse<Category[]>>('/api/categories', { query: filters })
  return response.data
}

export type CategoryPayload = {
  restaurantId: number
  name: string
}

export async function createCategory(payload: CategoryPayload) {
  const response = await httpPost<ApiResponse<Category>>('/api/categories', payload)
  return response.data
}

export async function updateCategory(id: number, payload: Partial<CategoryPayload>) {
  const response = await httpPut<ApiResponse<Category>>(`/api/categories/${id}`, payload)
  return response.data
}

export async function deleteCategory(id: number) {
  const response = await httpDelete<ApiResponse<Category>>(`/api/categories/${id}`)
  return response.data
}
