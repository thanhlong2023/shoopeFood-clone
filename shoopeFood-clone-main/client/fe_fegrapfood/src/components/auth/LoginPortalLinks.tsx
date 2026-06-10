import { Link } from 'react-router-dom'
import { LOGIN_PATH_BY_ROLE } from '../../utils/loginPaths'
import type { UserRole } from '../../types'

const portals: Array<{ role: UserRole; label: string }> = [
  { role: 'CUSTOMER', label: 'Khach hang' },
  { role: 'MERCHANT', label: 'Chu quan' },
  { role: 'DRIVER', label: 'Tai xe' },
]

type LoginPortalLinksProps = {
  activeRole: UserRole
}

export default function LoginPortalLinks({ activeRole }: LoginPortalLinksProps) {
  return (
    <div className="login-portal-links" aria-label="Cac cong dang nhap">
      <span>Dang nhap khac:</span>
      {portals.map((portal) => (
        <Link
          key={portal.role}
          to={LOGIN_PATH_BY_ROLE[portal.role]}
          className={portal.role === activeRole ? 'active' : undefined}
          aria-current={portal.role === activeRole ? 'page' : undefined}
        >
          {portal.label}
        </Link>
      ))}
    </div>
  )
}
