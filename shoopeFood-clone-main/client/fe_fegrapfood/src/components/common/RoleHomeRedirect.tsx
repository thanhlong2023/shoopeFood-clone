import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

type RoleHomeRedirectProps = {
  children: ReactNode
}

export default function RoleHomeRedirect({ children }: RoleHomeRedirectProps) {
  const { isAuthenticated, user } = useAuth()

  if (isAuthenticated && user?.role === 'MERCHANT') {
    return <Navigate to="/merchant/orders" replace />
  }

  if (isAuthenticated && user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />
  }

  if (isAuthenticated && user?.role === 'DRIVER') {
    return <Navigate to="/driver" replace />
  }

  return <>{children}</>
}
