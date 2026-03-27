export type ApiResponse<T> = {
  data: T
  message?: string
}

export type Restaurant = {
  id: number
  ownerId: number
  name: string
  address: string
  latitude: number
  longitude: number
  isOpen: boolean
  imageUrl: string | null
  ratingAvg: number
}

export type Food = {
  id: number
  categoryId: number | null
  name: string
  price: number
  isAvailable: boolean
}
