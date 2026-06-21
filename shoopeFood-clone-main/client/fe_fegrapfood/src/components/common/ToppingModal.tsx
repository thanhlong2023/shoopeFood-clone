import { useState, useEffect } from 'react'
import type { Food, Topping } from '../../types'

type ToppingModalProps = {
  isOpen: boolean
  food: Food | null
  onClose: () => void
  onConfirm: (food: Food, quantity: number, toppings: { id: number; quantity: number }[]) => void
}

export function ToppingModal({ isOpen, food, onClose, onConfirm }: ToppingModalProps) {
  const [quantity, setQuantity] = useState(1)
  const [toppingQty, setToppingQty] = useState<Record<number, number>>({})

  useEffect(() => {
    if (isOpen) {
      setQuantity(1)
      setToppingQty({})
    }
  }, [isOpen, food])

  if (!isOpen || !food) return null

  const handleUpdateToppingQty = (toppingId: number, nextQty: number, maxQty: number) => {
    setToppingQty((current) => {
      const next = { ...current }
      const finalQty = Math.max(0, Math.min(nextQty, maxQty))
      if (finalQty <= 0) {
        delete next[toppingId]
      } else {
        next[toppingId] = finalQty
      }
      return next
    })
  }

  const handleConfirm = () => {
    const toppingsArr = Object.entries(toppingQty)
      .map(([idStr, qty]) => ({ id: Number(idStr), quantity: qty }))
      .filter(t => t.quantity > 0)
    onConfirm(food, quantity, toppingsArr)
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const toppings = food.toppings?.filter(t => {
    if (!t.isAvailable) return false;
    if (t.startDate && t.startDate > todayStr) return false;
    if (t.endDate && t.endDate < todayStr) return false;
    return true;
  }) || []
  const toppingsCost = toppings.reduce((sum, t) => {
    const qty = toppingQty[t.id] || 0
    return sum + Number(t.price) * qty
  }, 0)
  const totalCost = (Number(food.price) + toppingsCost) * quantity

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
          <h3 className="font-bold text-gray-900 m-0">Thêm món</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-200 flex items-center justify-center cursor-pointer border-0 bg-transparent text-gray-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          <div className="flex gap-4 mb-6">
            <div
              className="w-20 h-20 rounded-xl bg-cover bg-center shrink-0 border border-gray-100"
              style={{ backgroundImage: `url(${food.imageUrl || ''})`, backgroundColor: '#f3f4f6' }}
            />
            <div>
              <h4 className="font-bold text-gray-900 m-0 mb-1">{food.name}</h4>
              <p className="text-brand font-bold m-0">{Number(food.price).toLocaleString('vi-VN')} đ</p>
            </div>
          </div>

          {toppings.length > 0 && (
            <div className="mb-6">
              <h5 className="font-bold text-gray-800 m-0 mb-3 text-sm bg-gray-100 px-3 py-1.5 rounded-md">
                Topping (Tùy chọn)
              </h5>
              <div className="flex flex-col gap-3">
                {toppings.map(topping => {
                  const qty = toppingQty[topping.id] || 0;
                  const maxQty = Number(topping.currentQuantity || 0);
                  return (
                    <div key={topping.id} className="flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm text-gray-700 font-medium select-none">{topping.name}</span>
                          <span className="text-xs text-gray-500">Còn: {maxQty}</span>
                        </div>
                        <span className="px-2 py-0.5 bg-brand/10 text-brand rounded text-xs font-bold">+{Number(topping.price).toLocaleString('vi-VN')} đ</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer disabled:opacity-50 text-gray-700 bg-white"
                          onClick={() => handleUpdateToppingQty(topping.id, qty - 1, maxQty)}
                          disabled={qty <= 0}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
                        </button>
                        <span className="text-sm font-bold w-4 text-center">{qty}</span>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer disabled:opacity-50 text-gray-700 bg-white"
                          onClick={() => handleUpdateToppingQty(topping.id, qty + 1, maxQty)}
                          disabled={qty >= maxQty}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 mt-8 mb-2">
            <button
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer disabled:opacity-50 hover:bg-gray-50 text-gray-700 bg-white"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"/></svg>
            </button>
            <span className="text-xl font-bold w-8 text-center">{quantity}</span>
            <button
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-50 text-gray-700 bg-white"
              onClick={() => setQuantity(Math.min(Number(food.currentQuantity || 0), quantity + 1))}
              disabled={quantity >= Number(food.currentQuantity || 0)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-white">
          <button
            onClick={handleConfirm}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-xl transition-colors border-0 cursor-pointer shadow-md flex justify-between px-6 items-center"
          >
            <span>Thêm vào giỏ hàng</span>
            <span>{totalCost.toLocaleString('vi-VN')} đ</span>
          </button>
        </div>
      </div>
    </div>
  )
}
