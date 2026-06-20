import { httpGet, httpPost, httpPut } from './http'
import type { ApiResponse, AuthSession, AuthUser, LoginPayload } from '../../types'

export type RegisterPayload = {
  fullName: string
  phone: string
  password: string
}

export type ResetPasswordPayload = {
  phone: string
  otp: string
  newPassword: string
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

export async function changePassword(payload: { currentPassword: string; newPassword: string }) {
  return httpPut<{ message: string }>('/api/auth/password', payload)
}

export async function requestPasswordReset(phone: string) {
  return httpPost<{ message: string }>('/api/auth/forgot-password', { phone })
}

export async function resetPassword(payload: ResetPasswordPayload) {
  return httpPost<{ message: string }>('/api/auth/reset-password', payload)
}

export async function activateRole(role: AuthUser['role']) {
  const response = await httpPost<ApiResponse<AuthSession>>('/api/auth/activate-role', { role })
  return response.data
}
