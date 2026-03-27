import { httpGet } from './http'
import type { ApiResponse, Restaurant } from '../../types'

export async function getRestaurants() {
  const response = await httpGet<ApiResponse<Restaurant[]>>('/api/restaurants')
  return response.data
}

export async function getRestaurantById(id: number) {
  const response = await httpGet<ApiResponse<Restaurant>>(`/api/restaurants/${id}`)
  return response.data
}
