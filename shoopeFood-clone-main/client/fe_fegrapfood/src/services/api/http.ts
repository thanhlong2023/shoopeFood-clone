import { AUTH_TOKEN_STORAGE_KEY } from '../../constants/auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | boolean>
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  const url = new URL(path, API_BASE_URL)

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  return url.toString()
}

function normalizeHeaders(headers?: HeadersInit) {
  const normalized: Record<string, string> = {}

  if (!headers) {
    return normalized
  }

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      normalized[key] = value
    })
    return normalized
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      normalized[key] = value
    })
    return normalized
  }

  return headers
}

export async function httpGet<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'GET',
    ...options,
  })
}

export async function httpPost<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    ...options,
  })
}

export async function httpPut<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
    ...options,
  })
}

export async function httpPatch<T>(path: string, body: unknown, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    ...options,
  })
}

export async function httpDelete<T>(path: string, options: RequestOptions = {}): Promise<T> {
  return request<T>(path, {
    method: 'DELETE',
    ...options,
  })
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { query, headers, ...restOptions } = options
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`
  }

  const response = await fetch(buildUrl(path, query), {
    headers: {
      ...requestHeaders,
      ...normalizeHeaders(headers),
    },
    ...restOptions,
  })

  if (!response.ok) {
    let errorMessage = `Request failed: ${response.status}`

    try {
      const errorData = (await response.json()) as { message?: string; error?: { message?: string } }
      if (errorData.error?.message || errorData.message) {
        errorMessage = errorData.error?.message || errorData.message || errorMessage
      }
    } catch {
      // Keep the default message when the server does not return JSON.
    }

    throw new Error(errorMessage)
  }

  return response.json() as Promise<T>
}
