import { httpGet, httpPost } from './http'
import type { ApiResponse, Driver, DriverLocation, UpdateDriverLocationPayload } from '../../types'

export async function getDrivers() {
  const response = await httpGet<ApiResponse<Driver[]>>('/api/drivers')
  return response.data
}

export async function updateDriverLocation(driverId: number, payload: UpdateDriverLocationPayload) {
  const response = await httpPost<ApiResponse<DriverLocation>>(`/api/drivers/${driverId}/location`, payload)
  return response.data
}
