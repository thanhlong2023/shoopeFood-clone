import { httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, AuthSession, AuthUser, LoginPayload } from '../../types'

export type RegisterPayload = {
  fullName: string
  phone: string
  password: string
}

export async function login(payload: LoginPayload) {
  const response = await httpPost<ApiResponse<AuthSession>>('/api/auth/login', payload)
  return response.data
}

export async function registerCustomer(payload: RegisterPayload) {
  const response = await httpPost<ApiResponse<AuthSession>>('/api/auth/register', payload)
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

export async function activateRole(role: AuthUser['role']) {
  const response = await httpPost<ApiResponse<AuthSession>>('/api/auth/activate-role', { role })
  return response.data
}
