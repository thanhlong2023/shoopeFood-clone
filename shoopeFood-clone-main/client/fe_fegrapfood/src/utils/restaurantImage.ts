import type { CSSProperties } from 'react'

const FAKE_RES = [
  "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=600&q=80"
];

export function getRestaurantImageUrl(imageUrl?: string | null, seed?: number | string) {
  const trimmed = imageUrl?.trim()
  if (!trimmed) {
    if (seed !== undefined) {
      const num = typeof seed === 'string' ? seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1) : Number(seed);
      return FAKE_RES[Math.abs(num || 0) % FAKE_RES.length];
    }
    return FAKE_RES[0];
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${apiBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`
}

export function restaurantCoverStyle(imageUrl?: string | null, seed?: number | string): CSSProperties {
  const url = getRestaurantImageUrl(imageUrl, seed)
  return {
    backgroundImage: `linear-gradient(90deg, rgba(16, 24, 32, 0.78), rgba(16, 24, 32, 0.2)), url("${url}")`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }
}

export function restaurantThumbStyle(imageUrl?: string | null, seed?: number | string): CSSProperties | undefined {
  const url = getRestaurantImageUrl(imageUrl, seed)
  return url ? { backgroundImage: `url("${url}")` } : undefined
}
