import type { CSSProperties } from 'react'

export function getFoodImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${apiBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`
}

export function foodPhotoStyle(imageUrl?: string | null): CSSProperties | undefined {
  const url = getFoodImageUrl(imageUrl)
  return url ? { backgroundImage: `url("${url}")` } : undefined
}
