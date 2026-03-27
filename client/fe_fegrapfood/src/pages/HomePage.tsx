import { useEffect, useMemo, useState } from 'react'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { MapContainer, CircleMarker, Popup, TileLayer } from 'react-leaflet'
import { getRestaurants } from '../services/api/restaurants'
import { getFoods } from '../services/api/foods'
import type { Food, Restaurant } from '../types'

const quickFilters = ['Gan ban', 'Pho bien', 'Mon moi', 'Sieu re', 'Do uong', 'Trang mieng']
const defaultMapCenter: [number, number] = [10.77689, 106.70081]

function formatPrice(value: number) {
  return new Intl.NumberFormat('vi-VN').format(Math.round(value))
}

function toEta(restaurantId: number) {
  const baseMinute = 12 + (restaurantId % 6) * 2
  return `${baseMinute}-${baseMinute + 8} phut`
}

function toPromotion(restaurantId: number) {
  const promotions = ['Giam 20% toi da 40k', 'Mien phi giao hang 3km', 'Combo trua giam 35k', 'Tang nuoc cho don tu 99k']
  return promotions[restaurantId % promotions.length]
}

function hasLocation(restaurant: Restaurant) {
  return Number.isFinite(restaurant.latitude) && Number.isFinite(restaurant.longitude) && restaurant.latitude !== 0 && restaurant.longitude !== 0
}

export default function HomePage() {
  useDocumentTitle(`${APP_NAME} | Home`)

  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        setIsLoading(true)
        setErrorMessage(null)

        const [restaurantData, foodData] = await Promise.all([getRestaurants(), getFoods()])

        if (!ignore) {
          setRestaurants(restaurantData)
          setFoods(foodData)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Khong the ket noi API')
        }
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    void fetchData()

    return () => {
      ignore = true
    }
  }, [])

  const availableFoodCount = useMemo(() => foods.filter((item) => item.isAvailable).length, [foods])
  const averageFoodPrice = useMemo(() => {
    if (foods.length === 0) {
      return 0
    }
    const total = foods.reduce((sum, item) => sum + Number(item.price || 0), 0)
    return total / foods.length
  }, [foods])

  const mapRestaurants = useMemo(() => restaurants.filter(hasLocation), [restaurants])
  const mapCenter = mapRestaurants[0]
    ? ([mapRestaurants[0].latitude, mapRestaurants[0].longitude] as [number, number])
    : defaultMapCenter

  const restaurantCards = useMemo(
    () =>
      restaurants.slice(0, 8).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.address || 'Quan an dia phuong',
        eta: toEta(item.id),
        rating: Number(item.ratingAvg || 0),
        price: averageFoodPrice > 0 ? `${formatPrice(averageFoodPrice)} VND` : 'Dang cap nhat gia',
        promotion: toPromotion(item.id),
        isOpen: item.isOpen,
        location: [item.latitude, item.longitude] as [number, number],
      })),
    [averageFoodPrice, restaurants],
  )

  return (
    <section className="grab-home">
      <div className="hero-area" id="deals">
        <p className="hero-kicker">GrabFood in Ho Chi Minh City</p>
        <h1>Dat mon nhanh, theo doi don tren ban do theo thoi gian thuc.</h1>
        <p className="hero-subtitle">
          Chon nha hang yeu thich, ap ma uu dai va xem khu vuc giao hang ngay trong mot man hinh.
        </p>

        <div className="search-strip" role="search">
          <input type="text" placeholder="Tim nha hang, mon an, do uong..." aria-label="Search food" />
          <button type="button">Tim mon</button>
        </div>

        <div className="quick-filters" aria-label="Quick filters">
          {quickFilters.map((filter) => (
            <button key={filter} type="button" className="filter-chip">
              {filter}
            </button>
          ))}
        </div>

        <p className="hero-meta">
          {isLoading ? 'Dang tai du lieu...' : `${restaurants.length} nha hang | ${availableFoodCount} mon dang mo ban`}
        </p>
        {errorMessage ? <p className="hero-error">{errorMessage}</p> : null}
      </div>

      <div className="content-grid">
        <div className="restaurants-panel" id="restaurants">
          <div className="section-head">
            <h2>Nha hang noi bat</h2>
            <p>Du lieu dang lay truc tiep tu API backend cua ban.</p>
          </div>

          <div className="restaurant-list">
            {restaurantCards.map((item) => (
              <article key={item.id} className="restaurant-card">
                <div className="card-top">
                  <span className="pill">{item.category}</span>
                  <span className="eta">{item.eta}</span>
                </div>
                <h3>{item.name}</h3>
                <p className="price">{item.price}</p>
                <div className="card-bottom">
                  <strong>{item.rating.toFixed(1)} sao</strong>
                  <span>{item.promotion}</span>
                </div>
                <p className={`status-tag ${item.isOpen ? 'open' : 'closed'}`}>{item.isOpen ? 'Dang mo cua' : 'Tam dong cua'}</p>
              </article>
            ))}
            {!isLoading && restaurantCards.length === 0 ? <p className="empty-state">Khong co nha hang nao tu API.</p> : null}
          </div>
        </div>

        <aside className="map-panel" id="delivery-map">
          <div className="map-head">
            <h2>Ban do giao hang</h2>
            <p>Marker duoc render tu du lieu latitude/longitude cua backend.</p>
          </div>

          <div className="map-wrap" role="img" aria-label="Delivery map">
            <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mapRestaurants.map((restaurant) => (
                <CircleMarker
                  key={restaurant.id}
                  center={[restaurant.latitude, restaurant.longitude]}
                  radius={8}
                  pathOptions={{ color: '#00a63e', fillColor: '#00c853', fillOpacity: 0.75 }}
                >
                  <Popup>
                    <strong>{restaurant.name}</strong>
                    <br />
                    {restaurant.address || 'Khong co dia chi'}
                    <br />
                    {restaurant.isOpen ? 'Dang mo cua' : 'Tam dong cua'}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </aside>
      </div>
    </section>
  )
}
