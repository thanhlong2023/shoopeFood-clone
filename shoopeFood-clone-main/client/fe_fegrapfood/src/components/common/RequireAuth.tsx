import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import type { UserRole } from '../../types'

type RequireAuthProps = {
  allowedRoles?: UserRole[]
  children: ReactNode
}

export default function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const location = useLocation()
  const { isAuthenticated, hasRole } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
