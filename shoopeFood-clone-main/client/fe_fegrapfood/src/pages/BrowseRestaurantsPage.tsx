import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getCategories } from '../services/api/categories'
import { getFoods } from '../services/api/foods'
import { getRestaurants } from '../services/api/restaurants'

import { restaurantThumbStyle } from '../utils/restaurantImage'
import type { Category, Food, Restaurant } from '../types'

const PAGE_SIZE = 9

type SortMode = 'nearby' | 'rating' | 'name'


function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function toEta(restaurantId: number) {
  const baseMinute = 18 + (restaurantId % 4) * 3
  return `${baseMinute}-${baseMinute + 7} phút`
}

function toCuisine(categories: Category[], restaurantId: number) {
  const names = categories.filter((item) => item.restaurantId === restaurantId).map((item) => item.name)
  return names.slice(0, 3).join(' · ') || 'Món ngon mỗi ngày'
}



export default function BrowseRestaurantsPage() {
  useDocumentTitle(`${APP_NAME} | Tất cả nhà hàng`)
  const [searchParams, setSearchParams] = useSearchParams()
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [foods, setFoods] = useState<Food[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [openOnly, setOpenOnly] = useState(false)

  const [categoryId, setCategoryId] = useState<number | 'all'>('all')
  const [sortMode, setSortMode] = useState<SortMode>('nearby')
  const [page, setPage] = useState(1)

  const query = searchParams.get('q') || ''
  const normalizedQuery = normalizeSearchText(query)

  useEffect(() => {
    let ignore = false

    async function fetchData() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const [restaurantData, categoryData, foodData] = await Promise.all([getRestaurants(), getCategories(), getFoods()])

        if (!ignore) {
          setRestaurants(restaurantData)
          setCategories(categoryData)
          setFoods(foodData)
        }
      } catch (error) {
        if (!ignore) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải danh sách nhà hàng')
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

  useEffect(() => {
    setPage(1)
  }, [query, openOnly, categoryId, sortMode])

  const categoryOptions = useMemo(() => {
    const byName = new Map<string, Category>()
    categories.forEach((category) => {
      const key = normalizeSearchText(category.name)
      if (!byName.has(key)) {
        byName.set(key, category)
      }
    })
    return Array.from(byName.values()).sort((left, right) => left.name.localeCompare(right.name, 'vi'))
  }, [categories])

  const filteredRestaurants = useMemo(() => {
    const items = restaurants.filter((restaurant) => {
      const restaurantCategories = categories.filter((category) => category.restaurantId === restaurant.id)
      const restaurantCategoryIds = new Set(restaurantCategories.map((category) => category.id))
      const restaurantFoods = foods.filter((food) => food.categoryId !== null && restaurantCategoryIds.has(food.categoryId))

      const matchesOpen = !openOnly || (restaurant.isOpen && restaurant.isOpenToday)
      const matchesCategory =
        categoryId === 'all' ||
        restaurantCategories.some((category) => normalizeSearchText(category.name) === normalizeSearchText(categories.find((item) => item.id === categoryId)?.name || ''))
      const matchesQuery =
        !normalizedQuery ||
        [
          restaurant.name,
          restaurant.address,
          ...restaurantCategories.map((category) => category.name),
          ...restaurantFoods.map((food) => food.name),
        ].some((value) => normalizeSearchText(value || '').includes(normalizedQuery))

     return matchesOpen && matchesCategory && matchesQuery
    })

    return items.sort((left, right) => {
      if (sortMode === 'rating') {
        return right.ratingAvg - left.ratingAvg
      }
      if (sortMode === 'name') {
        return left.name.localeCompare(right.name, 'vi')
      }
      return left.id - right.id
    })
  }, [categories, categoryId, foods, normalizedQuery, openOnly, restaurants, sortMode])

  const totalPages = Math.max(1, Math.ceil(filteredRestaurants.length / PAGE_SIZE))
  const visibleRestaurants = filteredRestaurants.slice(0, page * PAGE_SIZE)

  function setQuery(value: string) {
    setSearchParams((current) => {
      if (value.trim()) {
        current.set('q', value)
      } else {
        current.delete('q')
      }
      return current
    })
  }

  return (
    <section className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="rounded-3xl bg-gradient-to-r from-[#00b14f] to-[#00883d] p-6 text-white shadow-sm md:p-8">
          <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Khám phá</p>
          <h1 className="mt-2 text-3xl font-black md:text-4xl">Tất cả nhà hàng</h1>
          <p className="mt-2 max-w-2xl text-sm font-medium text-white/80">
            Tìm quán đang mở, lọc theo loại món và chọn nhanh nhà hàng bạn muốn đặt.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm tên nhà hàng, món ăn, địa chỉ..."
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#00b14f] focus:ring-2 focus:ring-[#00b14f]/20"
            />
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value === 'all' ? 'all' : Number(event.target.value))}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#00b14f]"
            >
              <option value="all">Tất cả món</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as SortMode)}
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold outline-none focus:border-[#00b14f]"
            >
              <option value="nearby">Gần bạn</option>
              <option value="rating">Đánh giá cao</option>
              <option value="name">Tên A-Z</option>
            </select>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gray-50 px-4 py-3 text-sm font-bold text-gray-700">
              <input type="checkbox" checked={openOnly} onChange={(event) => setOpenOnly(event.target.checked)} />
              Đang mở
            </label>
          </div>
        </div>

        {errorMessage ? <p className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-bold text-red-600">{errorMessage}</p> : null}

        <div className="flex items-center justify-between">
          <p className="text-sm font-bold text-gray-500">
            {isLoading ? 'Đang tải...' : `${filteredRestaurants.length} nhà hàng phù hợp`}
          </p>
          <Link to="/food" className="rounded-full bg-white px-4 py-2 text-xs font-black text-[#00b14f] shadow-sm">
            Về trang đặt món
          </Link>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visibleRestaurants.map((restaurant) => (
            <Link
              key={restaurant.id}
              to={`/restaurants/${restaurant.id}`}
              className="group overflow-hidden rounded-3xl bg-white text-gray-900 no-underline shadow-sm transition hover:-translate-y-1 hover:shadow-md"
            >
              <div
                className={`h-44 bg-cover bg-center ${restaurantThumbStyle(restaurant.imageUrl, restaurant.id) ? '' : 'restaurant-thumb--placeholder'}`}
                style={restaurantThumbStyle(restaurant.imageUrl, restaurant.id)}
              />
              <div className="flex flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-black">{restaurant.name}</h2>
                    <p className="mt-1 line-clamp-1 text-xs font-semibold text-gray-500">{restaurant.address}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-black ${restaurant.isOpen && restaurant.isOpenToday ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    {restaurant.isOpen && restaurant.isOpenToday ? 'Đang mở' : 'Đóng'}
                  </span>
                </div>
                <p className="line-clamp-1 text-xs font-bold text-gray-500">{toCuisine(categories, restaurant.id)}</p>
               
                <div className="flex items-center justify-between text-xs font-black">
                   <span className="text-yellow-500">★ {restaurant.ratingAvg.toFixed(1)}</span>
                  <span className="text-gray-400">{toEta(restaurant.id)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!isLoading && filteredRestaurants.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-lg font-black text-gray-800">Không tìm thấy nhà hàng</h2>
            <p className="mt-2 text-sm font-semibold text-gray-500">Thử đổi từ khóa hoặc bỏ bớt bộ lọc nha.</p>
          </div>
        ) : null}

        {page < totalPages ? (
          <button
            type="button"
            onClick={() => setPage((current) => current + 1)}
            className="mx-auto rounded-full bg-[#00b14f] px-6 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#00883d]"
          >
            Xem thêm
          </button>
        ) : null}
      </div>
    </section>
  )
}
