import type { UserRole } from '../types'

export const LOGIN_PATH_BY_ROLE: Record<UserRole, string> = {
  CUSTOMER: '/login',
  MERCHANT: '/merchant/login',
  DRIVER: '/driver/login',
  ADMIN: '/admin/login',
}

export function getDefaultRedirect(role: UserRole) {
  if (role === 'ADMIN') return '/admin'
  if (role === 'DRIVER') return '/driver'
  if (role === 'MERCHANT') return '/merchant/orders'
  return '/'
}

export function resolveLoginPath(pathname: string) {
  if (pathname.startsWith('/merchant')) return LOGIN_PATH_BY_ROLE.MERCHANT
  if (pathname.startsWith('/admin')) return LOGIN_PATH_BY_ROLE.ADMIN
  if (pathname.startsWith('/driver')) return LOGIN_PATH_BY_ROLE.DRIVER
  return LOGIN_PATH_BY_ROLE.CUSTOMER
}
