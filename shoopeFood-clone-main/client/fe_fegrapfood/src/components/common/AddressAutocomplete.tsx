import { useEffect, useState, type ChangeEvent } from 'react'
import {
  addressDetailFromSuggestion,
  getAddressDetail,
  suggestAddresses,
} from '../../services/api/addresses'
import type { AddressDetail, AddressSuggestion } from '../../types'

type AddressAutocompleteProps = {
  value: string
  onTextChange: (value: string) => void
  onSelect: (address: AddressDetail) => void
  isSelectionConfirmed?: boolean
  id?: string
  inputMode?: 'input' | 'textarea'
  rows?: number
  placeholder?: string
  inputClassName?: string
  panelClassName?: string
}

const MIN_QUERY_LENGTH = 2
const DEBOUNCE_MS = 400

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export default function AddressAutocomplete({
  value,
  onTextChange,
  onSelect,
  isSelectionConfirmed = false,
  id,
  inputMode = 'input',
  rows = 2,
  placeholder = 'Nhap dia chi giao hang...',
  inputClassName,
  panelClassName,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [resolvingPlaceId, setResolvingPlaceId] = useState<string | null>(null)
  const trimmedQuery = value.trim()

  useEffect(() => {
    if (isSelectionConfirmed || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([])
      setIsLoading(false)
      setErrorMessage(null)
      return
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setIsLoading(true)
      setErrorMessage(null)

      void suggestAddresses(trimmedQuery, { signal: controller.signal })
        .then((items) => {
          setSuggestions(items)
        })
        .catch((error) => {
          if (isAbortError(error)) {
            return
          }

          setSuggestions([])
          setErrorMessage(error instanceof Error ? error.message : 'Khong the tai goi y dia chi')
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsLoading(false)
          }
        })
    }, DEBOUNCE_MS)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [isSelectionConfirmed, trimmedQuery])

  async function handleSuggestionSelect(suggestion: AddressSuggestion) {
    setResolvingPlaceId(suggestion.placeId)
    setErrorMessage(null)

    try {
      const fallbackDetail = addressDetailFromSuggestion(suggestion)
      const detail = await getAddressDetail(suggestion.placeId, { suggestion })
      onSelect({
        ...fallbackDetail,
        ...detail,
        formattedAddress: detail.formattedAddress || fallbackDetail.formattedAddress,
        provider: detail.provider || fallbackDetail.provider,
      })
      setSuggestions([])
    } catch (error) {
      onSelect(addressDetailFromSuggestion(suggestion))
      setSuggestions([])
      setErrorMessage(error instanceof Error ? error.message : 'Khong the lay chi tiet dia chi')
    } finally {
      setResolvingPlaceId(null)
    }
  }

  const shouldShowPanel = !isSelectionConfirmed && trimmedQuery.length >= MIN_QUERY_LENGTH
  const sharedInputProps = {
    id,
    value,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onTextChange(event.target.value),
    placeholder,
    className: inputClassName,
    autoComplete: 'off',
  }

  return (
    <div className="address-autocomplete">
      {inputMode === 'textarea' ? (
        <textarea {...sharedInputProps} rows={rows} />
      ) : (
        <input {...sharedInputProps} />
      )}

      {shouldShowPanel ? (
        <div className={panelClassName || 'address-suggestion-panel'}>
          {isLoading ? <p className="address-suggestion-state">Dang tim dia chi...</p> : null}
          {errorMessage ? <p className="address-suggestion-state error">{errorMessage}</p> : null}

          {!isLoading && suggestions.length === 0 ? (
            <p className="address-suggestion-state">Khong co goi y phu hop trong Viet Nam.</p>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="address-suggestion-list">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.placeId}
                  type="button"
                  className="address-suggestion-item"
                  onClick={() => void handleSuggestionSelect(suggestion)}
                  disabled={resolvingPlaceId === suggestion.placeId}
                >
                  <strong>{suggestion.mainText}</strong>
                  <span>{suggestion.secondaryText || suggestion.description}</span>
                </button>
              ))}
            </div>
          ) : null}

          <p className="address-suggestion-provider">Powered by VietMap</p>
        </div>
      ) : null}
    </div>
  )
}
