import { httpGet, httpPatch, httpPost } from './http'
import type { ApiResponse } from '../../types'

export type DriverApplicationPayload = {
  licensePlate: string
  idCardNumber: string
  vehicleType?: string
}

export type MerchantApplicationPayload = {
  name: string
  address: string
  latitude?: number
  longitude?: number
  openingTime?: string
  closingTime?: string
  imageUrl?: string | null
}

export type DriverApplication = {
  userId: number
  fullName: string
  phone: string
  licensePlate: string
  idCardNumber: string
  vehicleType: string
  approvalStatus: string
  rejectReason?: string | null
}

export type MyApplicationStatus = {
  role: string | null
  roles: string[]
  driver: { approvalStatus: string; rejectReason?: string | null } | null
  merchant: {
    pendingRestaurant: { id: number; name: string; approvalStatus: string } | null
    approvedRestaurant: { id: number; name: string; approvalStatus: string } | null
  }
}

export async function getMyApplicationStatus() {
  const response = await httpGet<ApiResponse<MyApplicationStatus>>('/api/applications/my-status')
  return response.data
}

export async function applyDriver(payload: DriverApplicationPayload) {
  const response = await httpPost<ApiResponse<DriverApplication>>('/api/applications/driver', payload)
  return response.data
}

export async function applyMerchant(payload: MerchantApplicationPayload) {
  const response = await httpPost<ApiResponse<{ id: number; name: string; approvalStatus: string }>>(
    '/api/applications/merchant',
    payload,
  )
  return response.data
}

export async function getPendingDriverApplications() {
  const response = await httpGet<ApiResponse<DriverApplication[]>>('/api/applications/drivers/pending')
  return response.data
}

export async function approveDriverApplication(userId: number) {
  const response = await httpPatch<ApiResponse<DriverApplication>>(`/api/applications/drivers/${userId}/approve`, {})
  return response.data
}

export async function rejectDriverApplication(userId: number, reason?: string) {
  const response = await httpPatch<ApiResponse<unknown>>(`/api/applications/drivers/${userId}/reject`, { reason })
  return response.data
}
