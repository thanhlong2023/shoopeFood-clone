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
  toppings?: Topping[] // Included when fetching food details
}

export type Topping = {
  id: number
  restaurantId: number
  name: string
  price: number
  isAvailable: boolean
  defaultQuantity: number
  currentQuantity: number
  startDate: string | null
  endDate: string | null
}

export type OrderItemTopping = {
  id: number
  toppingId: number
  toppingName: string
  priceAtOrder: number
  quantity: number
}

export type Category = {
  id: number
  restaurantId: number
  name: string
}

export type OrderItemPayload = {
  foodId: number
  quantity: number
  toppings?: { id: number; quantity: number }[]
}

export type CreateOrderPayload = {
  restaurantId: number
  receiverAddress: string
  receiverLat: number
  receiverLng: number
  distanceKm: number
  shippingType?: 'STANDARD' | 'FAST' | 'ECO'
  discountAmount?: number
  taxAmount?: number
  idempotencyKey?: string
  note?: string
  items: OrderItemPayload[]
}

export type AddressSuggestion = {
  placeId: string
  description: string
  mainText: string
  secondaryText: string
  latitude: number | null
  longitude: number | null
  provider: string
  raw?: unknown
}

export type AddressDetail = {
  placeId: string
  formattedAddress: string
  latitude: number | null
  longitude: number | null
  province: string
  district: string
  ward: string
  street: string
  houseNumber: string
  name?: string
  provider: string
  raw?: unknown
}

export type OrderItem = {
  id: number
  orderId: number
  foodId: number
  foodName: string | null
  imageUrl?: string | null
  quantity: number
  priceAtOrder: number
  lineTotal: number
  toppings?: OrderItemTopping[]
}

export type Order = {
  id: number
  orderCode: string
  idempotencyKey?: string
  customer: string
  customerName: string
  customerPhone: string
  customerId: number
  restaurantId: number
  restaurant?: Pick<Restaurant, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'isOpen'> | null
  driverId: number | null
  driver?: Driver | null
  driverName?: string | null
  receiverAddress: string
  receiverLat: number | null
  receiverLng: number | null
  distanceKm: number
  subtotalAmount: number
  taxAmount: number
  discountAmount: number
  shippingFee: number
  totalAmount: number
  cashToCollect: number
  statusCode: string | null
  statusLabel: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  items: OrderItem[]
  version: number
  note?: string | null
  cancelReason?: string | null
  cancelledByRole?: string | null
  cancelledByUserId?: number | null
  cancelledAt?: string | null
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

export type DriverCompletedDelivery = {
  id: number
  orderCode: string
  restaurantName: string
  restaurantAddress: string
  totalAmount: number
  cashToCollect: number
  receiverAddress: string
  customerName: string
  completedAt: string
  review: {
    id: number
    rating: number
    comment: string
    createdAt: string
  } | null
}

export type DriverCompletedOrdersPage = {
  items: DriverCompletedDelivery[]
  total: number
  page: number
  limit: number
}

export type DriverPublicProfile = {
  driver: Driver
  completedCount: number
  completedDeliveries: DriverCompletedDelivery[]
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

export type RouteStep = {
  instruction: string
  name: string
  distanceKm: number
  durationMinutes: number
  location: RoutePoint | null
}

export type RouteLeg = {
  key: 'driver_to_restaurant' | 'restaurant_to_customer' | string
  label: string
  from: RoutePoint
  to: RoutePoint
  provider: string
  ok: boolean
  distanceKm: number
  durationMinutes: number
  geometry: RoutePoint[]
  steps: RouteStep[]
  error: string | null
}

export type TrackingRoute = {
  provider: string
  status: 'OK' | 'PARTIAL' | 'ERROR' | 'UNAVAILABLE' | string
  totalDistanceKm: number
  totalDurationMinutes: number
  legs: RouteLeg[]
  routePoints: RoutePoint[]
}

export type Review = {
  id: number
  orderId?: number
  customerId?: number
  targetType: 'RESTAURANT' | 'DRIVER' | string
  targetId: number
  rating: number
  comment: string
  createdAt: string
}

export type OrderTracking = {
  order: Order
  restaurant: Pick<Restaurant, 'id' | 'name' | 'address' | 'latitude' | 'longitude' | 'isOpen'> | null
  driver: Driver | null
  driverLocation: DriverLocation | null
  destination: RoutePoint
  route: TrackingRoute
  routePoints: RoutePoint[]
  routeProgress: number
  reviews?: Review[]
}

export type RestaurantReviewSummary = {
  restaurantId: number
  reviewCount: number
  ratingAvg: number
}

export type ReviewPayload = {
  orderId: number
  targetType: 'RESTAURANT' | 'DRIVER'
  rating: number
  comment?: string
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
