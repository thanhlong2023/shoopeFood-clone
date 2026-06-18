import type { CSSProperties } from 'react'

const FAKE_FOODS = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1484723091791-0fee59ca0b09?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1414235077428-33898dd1508c?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=400&q=80",
  "https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=400&q=80"
];

export function getFoodImageUrl(imageUrl?: string | null, seed?: number | string) {
  const trimmed = imageUrl?.trim()
  if (!trimmed) {
    if (seed !== undefined) {
      const num = typeof seed === 'string' ? seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1) : Number(seed);
      return FAKE_FOODS[Math.abs(num || 0) % FAKE_FOODS.length];
    }
    return FAKE_FOODS[0];
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'
  return `${apiBase.replace(/\/$/, '')}/${trimmed.replace(/^\//, '')}`
}

export function foodPhotoStyle(imageUrl?: string | null, seed?: number | string): CSSProperties | undefined {
  const url = getFoodImageUrl(imageUrl, seed)
  return url ? { backgroundImage: `url("${url}")` } : undefined
}
