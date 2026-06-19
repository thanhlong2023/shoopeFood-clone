import { httpGet, httpPost } from './http'
import type { ApiResponse, Driver, DriverCompletedOrdersPage, DriverLocation, DriverPublicProfile, Order, UpdateDriverLocationPayload } from '../../types'

export type DriverOrderFeed = {
  driver: Driver
  available: Order[]
  active: Order[]
  completed?: Order[]
}

export async function getDrivers() {
  const response = await httpGet<ApiResponse<Driver[]>>('/api/drivers')
  return response.data
}

export async function getDriverProfile(driverId: number) {
  const response = await httpGet<ApiResponse<DriverPublicProfile>>(`/api/drivers/${driverId}/profile`)
  return response.data
}

export async function getMyDriverOrderFeed() {
  const response = await httpGet<ApiResponse<DriverOrderFeed>>('/api/drivers/me/orders')
  return response.data
}

export async function getMyCompletedOrders(page = 1, limit = 20) {
  const response = await httpGet<ApiResponse<DriverCompletedOrdersPage>>(
    `/api/drivers/me/completed?page=${page}&limit=${limit}`
  )
  return response.data
}

export async function updateDriverLocation(driverId: number, payload: UpdateDriverLocationPayload) {
  const response = await httpPost<ApiResponse<DriverLocation>>(`/api/drivers/${driverId}/location`, payload)
  return response.data
}
