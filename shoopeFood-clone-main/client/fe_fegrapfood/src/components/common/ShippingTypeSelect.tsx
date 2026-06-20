import { useEffect, useId, useRef, useState } from 'react'
import type { CreateOrderPayload } from '../../types'

type ShippingType = NonNullable<CreateOrderPayload['shippingType']>

type ShippingTypeSelectProps = {
  id?: string
  value: ShippingType
  onChange: (value: ShippingType) => void
  compact?: boolean
  prices?: Record<ShippingType, number>
}

const shippingOptions: Array<{
  value: ShippingType
  icon: string
  label: string
  description: string
}> = [
  {
    value: 'STANDARD',
    icon: '🛵',
    label: 'Giao tiêu chuẩn (Standard)',
    description: 'Cân bằng giữa tốc độ và phí giao hàng.',
  },
  {
    value: 'FAST',
    icon: '🚀',
    label: 'Giao siêu tốc (Fast)',
    description: 'Ưu tiên xử lý nhanh hơn khi nhà hàng sẵn sàng.',
  },
  {
    value: 'ECO',
    icon: '🛺',
    label: 'Tiết kiệm (Eco)',
    description: 'Phí mềm hơn, phù hợp khi bạn không quá vội.',
  },
]

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M16 5L7.75 13.25L4 9.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function ShippingTypeSelect({ id, value, onChange, compact = false, prices }: ShippingTypeSelectProps) {
  const generatedId = useId()
  const buttonId = id || generatedId
  const menuId = `${buttonId}-menu`
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selectedOption = shippingOptions.find((option) => option.value === value) || shippingOptions[0]

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        id={buttonId}
        type="button"
        className={`flex w-full items-center justify-between gap-3 rounded-lg bg-[#00B14F] px-4 text-left font-bold text-white shadow-sm shadow-emerald-900/10 transition hover:bg-[#009140] focus:outline-none focus:ring-2 focus:ring-[#00B14F]/30 focus:ring-offset-2 ${
          compact ? 'py-2.5 text-sm' : 'py-3 text-sm'
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2">
          <CheckIcon />
          <span className="truncate">
            {selectedOption.label}
            {prices ? ` - ${new Intl.NumberFormat('vi-VN').format(prices[selectedOption.value])} đ` : ''}
          </span>
        </span>
        <span className="flex h-6 items-center border-l border-white/30 pl-3">
          <ChevronIcon isOpen={isOpen} />
        </span>
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="listbox"
          aria-labelledby={buttonId}
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl shadow-gray-900/12"
        >
          {shippingOptions.map((option) => {
            const isSelected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`flex w-full items-start gap-3 border-b border-gray-100 px-4 py-3 text-left transition last:border-b-0 ${
                  isSelected ? 'bg-emerald-50 text-gray-950' : 'bg-white text-gray-800 hover:bg-emerald-50/70'
                }`}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
              >
                <span className="mt-0.5 text-base" aria-hidden="true">
                  {option.icon}
                </span>
                <span className="min-w-0 flex-1 flex justify-between items-start gap-4">
                  <span>
                    <span className="block text-sm font-bold leading-5">{option.label}</span>
                    <span className="mt-1 block text-xs font-medium leading-5 text-gray-500">{option.description}</span>
                  </span>
                  {prices ? (
                    <span className="text-sm font-bold whitespace-nowrap text-emerald-700">
                      {new Intl.NumberFormat('vi-VN').format(prices[option.value])} đ
                    </span>
                  ) : null}
                </span>
                {isSelected ? <span className="mt-1 text-[#00B14F]"><CheckIcon /></span> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
