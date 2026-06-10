import { httpGet, httpPost } from './http'
import type { ApiResponse, Driver, DriverLocation, Order, UpdateDriverLocationPayload } from '../../types'

export type DriverOrderFeed = {
  driver: Driver
  available: Order[]
  active: Order[]
}

export async function getDrivers() {
  const response = await httpGet<ApiResponse<Driver[]>>('/api/drivers')
  return response.data
}

export async function getMyDriverOrderFeed() {
  const response = await httpGet<ApiResponse<DriverOrderFeed>>('/api/drivers/me/orders')
  return response.data
}

export async function updateDriverLocation(driverId: number, payload: UpdateDriverLocationPayload) {
  const response = await httpPost<ApiResponse<DriverLocation>>(`/api/drivers/${driverId}/location`, payload)
  return response.data
}
