import { httpGet } from './http'
import type { ApiResponse, Food } from '../../types'

export async function getFoods() {
  const response = await httpGet<ApiResponse<Food[]>>('/api/foods')
  return response.data
}
