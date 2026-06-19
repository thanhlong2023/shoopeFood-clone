/**
 * Format a number as Vietnamese currency: 60000 → "60.000 đ"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '0 đ'
  return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' đ'
}

/**
 * Format an ISO date string to "HH:mm - DD/MM/YYYY"
 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${hours}:${minutes} - ${day}/${month}/${year}`
}

/**
 * Generate a user-friendly order code: #SPF-102938
 */
export function toOrderCode(id: number, orderCode?: string | null): string {
  if (orderCode) {
    const tail = orderCode.includes('-') ? (orderCode.split('-').pop() ?? orderCode) : orderCode
    return `#SPF-${tail.slice(-6)}`
  }
  return `#SPF-${String(id).padStart(6, '0')}`
}

/**
 * Map a UserRole to a friendly Vietnamese name
 */
export function getRoleName(role?: string | null): string {
  switch (role) {
    case 'CUSTOMER':
      return 'Khách hàng'
    case 'DRIVER':
      return 'Tài xế'
    case 'MERCHANT':
      return 'Chủ quán'
    case 'ADMIN':
      return 'Quản trị viên'
    default:
      return role || 'Không rõ'
  }
}
