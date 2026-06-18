import { httpGet, httpPost } from './http'
import type { ApiResponse, RestaurantReviewSummary, ReviewPayload } from '../../types'

export async function getRestaurantReviewSummary() {
  const response = await httpGet<ApiResponse<RestaurantReviewSummary[]>>('/api/reviews/restaurants/summary')
  return response.data
}

export async function createReview(payload: ReviewPayload) {
  const response = await httpPost<ApiResponse<unknown>>('/api/reviews', payload)
  return response.data
}
