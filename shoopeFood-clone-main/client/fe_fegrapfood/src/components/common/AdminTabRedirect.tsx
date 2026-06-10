import { Navigate, useLocation } from 'react-router-dom'

type AdminTabRedirectProps = {
  tab: string
  action?: string
}

export default function AdminTabRedirect({ tab, action }: AdminTabRedirectProps) {
  const location = useLocation()
  const params = new URLSearchParams({ tab })
  if (action) {
    params.set('action', action)
  }

  return <Navigate to={`/admin?${params.toString()}`} replace state={location.state} />
}
