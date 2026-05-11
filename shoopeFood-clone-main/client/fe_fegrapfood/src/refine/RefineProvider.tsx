import { Refine } from '@refinedev/core'
import type { ReactNode } from 'react'
import { dataProvider } from './dataProvider'

type RefineProviderProps = {
  children: ReactNode
}

const resources = [
  { name: 'users', list: '/admin/users', create: '/admin/users/create', edit: '/admin/users/:id/edit' },
  { name: 'drivers', list: '/admin/drivers', create: '/admin/drivers/create', edit: '/admin/drivers/:id/edit' },
  { name: 'restaurants', list: '/admin/restaurants', create: '/admin/restaurants/create', edit: '/admin/restaurants/:id/edit' },
  { name: 'categories', list: '/admin/categories', create: '/admin/categories/create', edit: '/admin/categories/:id/edit' },
  { name: 'foods', list: '/admin/foods', create: '/admin/foods/create', edit: '/admin/foods/:id/edit' },
  { name: 'orders', list: '/admin/orders', edit: '/admin/orders/:id/edit' },
]

export function AppRefineProvider({ children }: RefineProviderProps) {
  return (
    <Refine
      dataProvider={dataProvider}
      resources={resources}
      options={{
        syncWithLocation: false,
        warnWhenUnsavedChanges: false,
      }}
    >
      {children}
    </Refine>
  )
}
