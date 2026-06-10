export type ApiResponse<T> = {
  data: T
  message?: string
}

export type UserRole = 'CUSTOMER' | 'DRIVER' | 'MERCHANT' | 'ADMIN'

export type LoginPayload = {
  phone: string
  password: string
  role: UserRole
}

export type AuthUser = {
  id: number
  fullName: string
  phone: string
  ratingAvg: number
  roles: UserRole[]
  role: UserRole
  createdAt?: string
}

export type AuthSession = {
  token: string
  user: AuthUser
}

export type Restaurant = {
  id: number
  ownerId: number
  name: string
  address: string
  latitude: number
  longitude: number
  openingTime: string        // HH:mm:ss
  closingTime: string        // HH:mm:ss
  isOpen: boolean
  isOpenToday: boolean
  temporaryClosedReason: string | null
  temporaryClosedUntil: string | null
  imageUrl: string | null
  ratingAvg: number
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'
  approvedBy: number | null
  approvedAt: string | null
  rejectReason: string | null
  deletedAt: string | null
}

export type RestaurantCreateInput = {
  ownerId: number
  name: string
  address: string
  latitude: number
  longitude: number
  openingTime: string
  closingTime: string
  isOpen?: boolean
  isOpenToday?: boolean
  temporaryClosedReason?: string | null
  temporaryClosedUntil?: string | null
  imageUrl?: string | null
  ratingAvg?: number
}

export type RestaurantUpdateInput = Partial<RestaurantCreateInput> & {
  requestedBy?: number
}

export type RestaurantChangeRequest = {
  id: number
  restaurantId: number
  requestedBy: number
  payload: Partial<RestaurantCreateInput>
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewedBy: number | null
  reviewedAt: string | null
  rejectReason: string | null
  createdAt: string | null
}

export type RestaurantPayload = RestaurantCreateInput

export type Food = {
  id: number
  categoryId: number | null
  name: string
  imageUrl: string | null
  price: number
  isAvailable: boolean
  defaultQuantity: number
  currentQuantity: number
  quantityResetDate: string | null
}

export type Category = {
  id: number
  restaurantId: number
  name: string
}

export type OrderItemPayload = {
  foodId: number
  quantity: number
}

export type CreateOrderPayload = {
  customerId: number
  restaurantId: number
  receiverAddress: string
  receiverLat: number
  receiverLng: number
  distanceKm: number
  shippingType?: 'STANDARD' | 'FAST' | 'ECO'
  discountAmount?: number
  taxAmount?: number
  items: OrderItemPayload[]
}

export type OrderItem = {
  id: number
  orderId: number
  foodId: number
  foodName: string | null
  quantity: number
  priceAtOrder: number
  lineTotal: number
}

export type Order = {
  id: number
  orderCode: string
  customerId: number
  restaurantId: number
  receiverAddress: string
  distanceKm: number
  subtotalAmount: number
  taxAmount: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  statusCode: string | null
  statusLabel: string | null
  items: OrderItem[]
  version: number
  createdAt: string
}

export type Driver = {
  id: number
  fullName: string
  phone: string
  ratingAvg?: number
  vehicleType: string
  licensePlate: string
  isOnline: boolean
}

export type DriverLocation = {
  id: number | null
  driverId: number
  orderId: number | null
  latitude: number
  longitude: number
  heading: number
  speedKmh: number
  createdAt: string | null
}

export type RoutePoint = {
  latitude: number
  longitude: number
}

export type OrderTracking = {
  order: Order
  restaurant: Pick<Restaurant, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'isOpen'> | null
  driver: Driver | null
  driverLocation: DriverLocation | null
  destination: RoutePoint
  routePoints: RoutePoint[]
  routeProgress: number
}

export type UpdateOrderPayload = Partial<{
  customerId: number
  restaurantId: number
  receiverAddress: string
  receiverLat: number
  receiverLng: number
  distanceKm: number
  baseFee: number
  statusCode: string
  discountAmount: number
  taxAmount: number
  shippingType: 'STANDARD' | 'FAST' | 'ECO'
  driverId: number | null
  voucherId: number | null
  expectedVersion: number
}>

export type UpdateDriverLocationPayload = {
  orderId?: number
  latitude: number
  longitude: number
  heading?: number
  speedKmh?: number
}
