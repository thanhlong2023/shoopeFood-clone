import { httpGet } from './http'
import type { AddressDetail, AddressSuggestion, ApiResponse } from '../../types'

type AddressRequestOptions = {
  signal?: AbortSignal
}

const developmentAddressDetails: AddressDetail[] = [
  {
    placeId: 'dev-38-man-thien',
    name: '38 Man Thien',
    formattedAddress: '38 Man Thien, Phuong Tang Nhon Phu A, TP Thu Duc, TP. Ho Chi Minh',
    latitude: 10.8428,
    longitude: 106.7786,
    province: 'TP. Ho Chi Minh',
    district: 'TP Thu Duc',
    ward: 'Phuong Tang Nhon Phu A',
    street: 'Man Thien',
    houseNumber: '38',
  },
  {
    placeId: 'dev-nguyen-hue-12',
    name: '12 Nguyen Hue',
    formattedAddress: '12 Nguyen Hue, Ben Nghe, Quan 1, TP. Ho Chi Minh',
    latitude: 10.7744,
    longitude: 106.7032,
    province: 'TP. Ho Chi Minh',
    district: 'Quan 1',
    ward: 'Ben Nghe',
    street: 'Nguyen Hue',
    houseNumber: '12',
  },
  {
    placeId: 'dev-landmark-81',
    name: 'Landmark 81',
    formattedAddress: 'Vincom Center Landmark 81, Binh Thanh, TP. Ho Chi Minh',
    latitude: 10.795,
    longitude: 106.7218,
    province: 'TP. Ho Chi Minh',
    district: 'Binh Thanh',
    ward: 'Phuong 22',
    street: 'Dien Bien Phu',
    houseNumber: '720A',
  },
]

function unwrapAddressResponse<T>(response: ApiResponse<T> | T): T {
  if (response && typeof response === 'object' && 'data' in response) {
    return (response as ApiResponse<T>).data
  }

  return response as T
}

function normalizeSearchText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

export function getDevelopmentAddressSuggestions(query: string): AddressSuggestion[] {
  const normalizedQuery = normalizeSearchText(query)

  if (normalizedQuery.length < 2) {
    return []
  }

  return developmentAddressDetails
    .filter((address) =>
      [
        address.name,
        address.formattedAddress,
        address.province,
        address.district,
        address.ward,
        address.street,
        address.houseNumber,
      ].some((value) => normalizeSearchText(value || '').includes(normalizedQuery)),
    )
    .map((address) => ({
      placeId: address.placeId,
      description: address.formattedAddress,
      mainText: address.name || address.formattedAddress,
      secondaryText: address.formattedAddress,
    }))
}

export function getDevelopmentAddressDetail(placeId: string): AddressDetail | null {
  return developmentAddressDetails.find((address) => address.placeId === placeId) ?? null
}

export async function suggestAddresses(query: string, options: AddressRequestOptions = {}) {
  const response = await httpGet<ApiResponse<AddressSuggestion[]> | AddressSuggestion[]>('/api/addresses/suggest', {
    query: { q: query },
    signal: options.signal,
  })

  return unwrapAddressResponse(response)
}

export async function getAddressDetail(placeId: string, options: AddressRequestOptions = {}) {
  const response = await httpGet<ApiResponse<AddressDetail> | AddressDetail>(`/api/addresses/detail/${encodeURIComponent(placeId)}`, {
    signal: options.signal,
  })

  return unwrapAddressResponse(response)
}
