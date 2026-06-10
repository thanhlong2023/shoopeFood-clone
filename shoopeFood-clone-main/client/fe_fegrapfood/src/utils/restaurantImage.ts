import type { CSSProperties } from 'react'

export function getRestaurantImageUrl(imageUrl?: string | null) {
  const trimmed = imageUrl?.trim()
  return trimmed || null
}

export function restaurantCoverStyle(imageUrl?: string | null): CSSProperties {
  const url = getRestaurantImageUrl(imageUrl)
  if (!url) {
    return {
      backgroundImage: 'linear-gradient(135deg, #1f3d2d 0%, #2f5d44 45%, #1a2e22 100%)',
    }
  }

  return {
    backgroundImage: `linear-gradient(90deg, rgba(16, 24, 32, 0.78), rgba(16, 24, 32, 0.2)), url("${url}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }
}

export function restaurantThumbStyle(imageUrl?: string | null): CSSProperties | undefined {
  const url = getRestaurantImageUrl(imageUrl)
  return url ? { backgroundImage: `url("${url}")` } : undefined
}
