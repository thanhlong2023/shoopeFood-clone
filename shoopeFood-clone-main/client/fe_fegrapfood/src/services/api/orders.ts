import { httpGet, httpPatch, httpPost, httpPut } from './http'
import type { ApiResponse, CreateOrderPayload, Order, OrderTracking, UpdateOrderPayload } from '../../types'

export async function createOrder(payload: CreateOrderPayload) {
  const response = await httpPost<ApiResponse<Order>>('/api/orders', payload)
  return response.data
}

type OrderFilters = {
  statusCode?: string
  restaurantId?: number
  customerId?: number
  driverId?: number
}

export async function getOrders(filters: OrderFilters = {}) {
  const response = await httpGet<ApiResponse<Order[]>>('/api/orders', { query: filters })
  return response.data
}

export async function getOrderById(id: number) {
  const response = await httpGet<ApiResponse<Order>>(`/api/orders/${id}`)
  return response.data
}

export async function getOrderTracking(id: number) {
  const response = await httpGet<ApiResponse<OrderTracking>>(`/api/orders/${id}/tracking`)
  return response.data
}

export async function acceptOrder(id: number) {
  const response = await httpPost<ApiResponse<Order>>(`/api/orders/${id}/accept`, {})
  return response.data
}

export async function updateOrder(id: number, payload: UpdateOrderPayload) {
  const response = await httpPut<ApiResponse<Order>>(`/api/orders/${id}`, payload)
  return response.data
}

export async function updateOrderStatus(id: number, statusCode: string, expectedVersion?: number) {
  const response = await httpPut<ApiResponse<Order>>(`/api/orders/${id}/status`, { statusCode, expectedVersion })
  return response.data
}

export async function rejectOrder(id: number, reason: string, expectedVersion?: number) {
  const response = await httpPatch<ApiResponse<Order>>(`/api/orders/${id}/reject`, { reason, expectedVersion })
  return response.data
}

export async function cancelOrder(id: number, reason?: string) {
  const response = await httpPost<ApiResponse<Order>>(`/api/orders/${id}/cancel`, { reason })
  return response.data
}
