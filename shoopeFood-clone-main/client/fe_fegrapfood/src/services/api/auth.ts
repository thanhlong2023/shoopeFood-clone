import { httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, AuthSession, AuthUser, LoginPayload } from '../../types'

export async function login(payload: LoginPayload) {
  const response = await httpPost<ApiResponse<AuthSession>>('/api/auth/login', payload)
  return response.data
}

export async function getCurrentUser() {
  const response = await httpGet<ApiResponse<AuthUser>>('/api/auth/me')
  return response.data
}

export async function updateProfile(payload: { fullName: string; phone: string }) {
  const response = await httpPut<ApiResponse<AuthUser>>('/api/auth/profile', payload)
  return response.data
}
