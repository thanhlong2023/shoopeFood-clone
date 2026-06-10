import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { resolveLoginPath } from '../../utils/loginPaths'
import type { UserRole } from '../../types'

type RequireAuthProps = {
  allowedRoles?: UserRole[]
  children: ReactNode
}

export default function RequireAuth({ allowedRoles, children }: RequireAuthProps) {
  const location = useLocation()
  const { isAuthenticated, hasRole, user } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to={resolveLoginPath(location.pathname)} replace state={{ from: location.pathname }} />
  }

  if (allowedRoles && !hasRole(allowedRoles)) {
    if (user?.role === 'MERCHANT') {
      return <Navigate to="/merchant/orders" replace />
    }
    if (user?.role === 'ADMIN') {
      return <Navigate to="/admin" replace />
    }
    if (user?.role === 'DRIVER') {
      return <Navigate to="/driver" replace />
    }
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
