<<<<<<< HEAD
import { httpDelete, httpGet, httpPatch, httpPost, httpPut } from './http'
import type { ApiSuccessResponse, Restaurant, RestaurantChangeRequest, RestaurantCreateInput, RestaurantUpdateInput } from '../../types'

function unwrap<T>(response: ApiSuccessResponse<T>) {
  return response.success?.data ?? response.data
}

export async function getRestaurants() {
  const response = await httpGet<ApiSuccessResponse<Restaurant[]>>('/api/restaurants')
  return unwrap(response)
}

export async function getAllRestaurantsForAdmin() {
  const response = await httpGet<ApiSuccessResponse<Restaurant[]>>('/api/restaurants', { query: { includePending: true } })
  return unwrap(response)
}

export async function getMyRestaurants(ownerId: number) {
  const response = await httpGet<ApiSuccessResponse<Restaurant[]>>('/api/restaurants/mine', { query: { ownerId } })
  return unwrap(response)
}

export async function getRestaurantById(id: number) {
  const response = await httpGet<ApiSuccessResponse<Restaurant>>(`/api/restaurants/${id}`)
  return unwrap(response)
}

export async function createRestaurant(payload: RestaurantCreateInput) {
  const response = await httpPost<ApiSuccessResponse<Restaurant>>('/api/restaurants', payload)
  return unwrap(response)
}

export async function updateRestaurant(id: number, payload: RestaurantUpdateInput) {
  const response = await httpPut<ApiSuccessResponse<Restaurant | { restaurant: Restaurant; changeRequest: RestaurantChangeRequest | null }>>(
    `/api/restaurants/${id}`,
    payload,
  )
  const data = unwrap(response)
  return 'restaurant' in data ? data : { restaurant: data, changeRequest: null }
}

export async function deleteRestaurant(id: number) {
  const response = await httpDelete<ApiSuccessResponse<Restaurant>>(`/api/restaurants/${id}`)
  return unwrap(response)
}

export async function patchRestaurantStatus(id: number, isOpen: boolean) {
  const response = await httpPatch<ApiSuccessResponse<Restaurant>>(`/api/restaurants/${id}/status`, { isOpen })
  return unwrap(response)
}

export async function patchRestaurantTodayStatus(id: number, isOpenToday: boolean, reason?: string, temporaryClosedUntil?: string | null) {
  const response = await httpPatch<ApiSuccessResponse<Restaurant>>(`/api/restaurants/${id}/today-status`, {
    isOpenToday,
    reason,
    temporaryClosedUntil,
  })
  return unwrap(response)
}

export async function patchRestaurantLocation(id: number, latitude: number, longitude: number) {
  const response = await httpPatch<ApiSuccessResponse<Restaurant>>(`/api/restaurants/${id}/location`, { latitude, longitude })
  return unwrap(response)
}

export async function getPendingRestaurants() {
  const response = await httpGet<ApiSuccessResponse<Restaurant[]>>('/api/restaurants/admin/pending')
  return unwrap(response)
}

export async function approveRestaurant(id: number, approvedBy?: number) {
  const response = await httpPatch<ApiSuccessResponse<Restaurant>>(`/api/restaurants/admin/${id}/approve`, { approvedBy })
  return unwrap(response)
}

export async function rejectRestaurant(id: number, reason: string) {
  const response = await httpPatch<ApiSuccessResponse<Restaurant>>(`/api/restaurants/admin/${id}/reject`, { reason })
  return unwrap(response)
}

export async function getRestaurantChangeRequests(status: RestaurantChangeRequest['status'] = 'PENDING') {
  const response = await httpGet<ApiSuccessResponse<RestaurantChangeRequest[]>>('/api/restaurants/admin/change-requests', {
    query: { status },
  })
  return unwrap(response)
}

export async function approveRestaurantChangeRequest(id: number, reviewedBy?: number) {
  const response = await httpPatch<ApiSuccessResponse<{ restaurant: Restaurant; changeRequest: RestaurantChangeRequest }>>(
    `/api/restaurants/admin/change-requests/${id}/approve`,
    { reviewedBy },
  )
  return unwrap(response)
}

export async function rejectRestaurantChangeRequest(id: number, reason: string) {
  const response = await httpPatch<ApiSuccessResponse<RestaurantChangeRequest>>(`/api/restaurants/admin/change-requests/${id}/reject`, { reason })
  return unwrap(response)
=======
import { httpDelete, httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, Restaurant, RestaurantPayload } from '../../types'

export async function getRestaurants() {
  const response = await httpGet<ApiResponse<Restaurant[]>>('/api/restaurants')
  return response.data
}

export async function getRestaurantById(id: number) {
  const response = await httpGet<ApiResponse<Restaurant>>(`/api/restaurants/${id}`)
  return response.data
}

export async function createRestaurant(payload: RestaurantPayload) {
  const response = await httpPost<ApiResponse<Restaurant>>('/api/restaurants', payload)
  return response.data
}

export async function updateRestaurant(id: number, payload: RestaurantPayload) {
  const response = await httpPut<ApiResponse<Restaurant>>(`/api/restaurants/${id}`, payload)
  return response.data
}

export async function deleteRestaurant(id: number) {
  const response = await httpDelete<ApiResponse<Restaurant>>(`/api/restaurants/${id}`)
  return response.data
>>>>>>> origin/main
}
