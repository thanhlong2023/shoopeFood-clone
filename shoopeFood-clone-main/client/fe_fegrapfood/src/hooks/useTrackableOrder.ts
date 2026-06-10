import { useEffect, useState } from 'react'
import { ORDER_UPDATED_EVENT } from '../constants/order'
import { getLastOrderId } from '../utils/orderStorage'

export function useTrackableOrder() {
  const [lastOrderId, setLastOrderId] = useState<number | null>(() => getLastOrderId())

  useEffect(() => {
    function sync() {
      setLastOrderId(getLastOrderId())
    }

    window.addEventListener(ORDER_UPDATED_EVENT, sync)
    window.addEventListener('storage', sync)

    return () => {
      window.removeEventListener(ORDER_UPDATED_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return {
    lastOrderId,
    hasTrackableOrder: lastOrderId !== null,
  }
}
