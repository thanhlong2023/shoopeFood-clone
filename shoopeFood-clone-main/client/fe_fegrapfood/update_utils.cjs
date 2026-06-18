const fs = require('fs');

const foodImgs = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1484723091791-0fee59ca0b09?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1493770348161-369560ae357d?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1414235077428-33898dd1508c?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=400&q=80',
  'https://images.unsplash.com/photo-1499028344343-cd173ffc68a9?auto=format&fit=crop&w=400&q=80'
];

const resImgs = [
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1525610553991-2bede1a236e2?auto=format&fit=crop&w=600&q=80'
];

// Write foodImage.ts
const foodImageCode = `import type { CSSProperties } from 'react'

const FAKE_FOODS = ${JSON.stringify(foodImgs, null, 2)};

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
  return \`\${apiBase.replace(/\\/$/, '')}/\${trimmed.replace(/^\\//, '')}\`
}

export function foodPhotoStyle(imageUrl?: string | null, seed?: number | string): CSSProperties | undefined {
  const url = getFoodImageUrl(imageUrl, seed)
  return url ? { backgroundImage: \`url("\${url}")\` } : undefined
}
`;

fs.writeFileSync('src/utils/foodImage.ts', foodImageCode, 'utf8');

// Write restaurantImage.ts
const resImageCode = `import type { CSSProperties } from 'react'

const FAKE_RES = ${JSON.stringify(resImgs, null, 2)};

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
  return \`\${apiBase.replace(/\\/$/, '')}/\${trimmed.replace(/^\\//, '')}\`
}

export function restaurantCoverStyle(imageUrl?: string | null, seed?: number | string): CSSProperties {
  const url = getRestaurantImageUrl(imageUrl, seed)
  return {
    backgroundImage: \`linear-gradient(90deg, rgba(16, 24, 32, 0.78), rgba(16, 24, 32, 0.2)), url("\${url}")\`,
    backgroundPosition: 'center',
    backgroundSize: 'cover',
  }
}

export function restaurantThumbStyle(imageUrl?: string | null, seed?: number | string): CSSProperties | undefined {
  const url = getRestaurantImageUrl(imageUrl, seed)
  return url ? { backgroundImage: \`url("\${url}")\` } : undefined
}
`;

fs.writeFileSync('src/utils/restaurantImage.ts', resImageCode, 'utf8');
console.log('Updated util files');
