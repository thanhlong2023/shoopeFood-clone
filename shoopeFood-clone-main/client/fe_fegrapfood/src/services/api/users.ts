import { httpGet, httpPost } from './http'
import type { ApiResponse, AuthUser } from '../../types'

export async function getMerchants() {
  const response = await httpGet<ApiResponse<AuthUser[]>>('/api/users/merchants')
  return response.data
}

export async function createMerchant(payload: {
  fullName: string
  phone: string
  password?: string
  ratingAvg?: number
}) {
  const response = await httpPost<ApiResponse<AuthUser>>('/api/users/merchants', payload)
  return response.data
}
