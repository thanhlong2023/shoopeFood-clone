import type { CSSProperties } from 'react'

export function getFoodImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim()
  return trimmed || null
}

export function foodPhotoStyle(imageUrl?: string | null): CSSProperties | undefined {
  const url = getFoodImageUrl(imageUrl)
  return url ? { backgroundImage: `url("${url}")` } : undefined
}
