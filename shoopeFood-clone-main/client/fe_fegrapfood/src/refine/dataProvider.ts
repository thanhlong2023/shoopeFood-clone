import type { DataProvider } from '@refinedev/core'
import simpleRestDataProvider from '@refinedev/simple-rest'
import axios, { AxiosHeaders, type AxiosResponse } from 'axios'
import { AUTH_TOKEN_STORAGE_KEY } from '../constants/auth'

type ApiEnvelope = {
  data?: unknown
  message?: string
}

export const REFINE_API_URL = import.meta.env.VITE_REFINE_API_URL ?? 'http://localhost:3000/api'

export const httpClient = axios.create()

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)

  if (token) {
    const headers = AxiosHeaders.from(config.headers)
    headers.set('Authorization', `Bearer ${token}`)
    config.headers = headers
  }

  return config
})

httpClient.interceptors.response.use(
  (response: AxiosResponse<ApiEnvelope | unknown>) => {
    const envelope = response.data

    if (envelope && typeof envelope === 'object' && 'data' in envelope) {
      const normalizedData = (envelope as ApiEnvelope).data
      const headers = response.headers as Record<string, string>
      const total = Array.isArray(normalizedData) ? normalizedData.length : normalizedData ? 1 : 0

      if (!headers['x-total-count']) {
        headers['x-total-count'] = String(total)
      }

      response.data = normalizedData
    }

    return response
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'Request failed'
    error.message = message
    return Promise.reject(error)
  },
)

const baseDataProvider = simpleRestDataProvider(REFINE_API_URL, httpClient)

export const dataProvider: DataProvider = {
  ...baseDataProvider,
  getList: async (params) => {
    if (params.resource === 'restaurants') {
      const { data: responseData } = await httpClient.get(`${REFINE_API_URL}/restaurants`, {
        params: { includePending: 'true' },
      })
      const data = Array.isArray(responseData) ? responseData : []
      return {
        data,
        total: data.length,
      }
    }

    return baseDataProvider.getList(params)
  },
  update: (params) =>
    baseDataProvider.update({
      ...params,
      meta: {
        ...params.meta,
        method: params.meta?.method ?? 'put',
      },
    }),
}
