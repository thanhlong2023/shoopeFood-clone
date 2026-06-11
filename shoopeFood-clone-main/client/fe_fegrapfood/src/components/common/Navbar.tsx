import { NavLink } from 'react-router-dom'
import { APP_NAME } from '../../constants/app'
import { useAuth } from '../../contexts/AuthContext'
import { useTrackableOrder } from '../../hooks/useTrackableOrder'

export default function Navbar() {
  const { isAuthenticated, user, logout, hasRole } = useAuth()
  const { hasTrackableOrder } = useTrackableOrder()

  const isMerchant = hasRole(['MERCHANT'])
  const isAdmin = hasRole(['ADMIN'])
  const isDriver = hasRole(['DRIVER'])
  const showCustomerNav = !isAuthenticated || hasRole(['CUSTOMER'])

  return (
    <header className="topbar-wrap">
      <nav className="topbar" aria-label="Global navigation">
        <div className="brand-block">
          <span className="brand-mark" aria-hidden="true">
            G
          </span>
          <strong>{APP_NAME}</strong>
        </div>

        <ul className="topbar-links">
          {isMerchant ? (
            <>
              <li>
                <NavLink to="/merchant/orders">Don hang</NavLink>
              </li>
              <li>
                <NavLink to="/merchant/menu">Thuc don</NavLink>
              </li>
            </>
          ) : null}

          {showCustomerNav && !isMerchant ? (
            <>
              <li>
                <NavLink to="/">Dat mon</NavLink>
              </li>
              {isAuthenticated ? (
                <li>
                  <NavLink to="/tracking">Don hang</NavLink>
                </li>
              ) : hasTrackableOrder ? (
                <li>
                  <NavLink to="/tracking">Theo doi</NavLink>
                </li>
              ) : null}
            </>
          ) : null}

          {isDriver || isAdmin ? (
            <li>
              <NavLink to="/driver">Tai xe</NavLink>
            </li>
          ) : null}

          {isAdmin ? (
            <li>
              <NavLink to="/admin">Admin</NavLink>
            </li>
          ) : null}
        </ul>

        <div className="topbar-account">
          {isAuthenticated ? (
            <>
              <NavLink to="/profile" className="topbar-profile-link">
                <span className="topbar-profile-avatar" aria-hidden="true">
                  {(user?.fullName || user?.phone || 'U').charAt(0).toUpperCase()}
                </span>
                <span className="topbar-profile-copy">
                  <strong>{user?.fullName || 'Ho so'}</strong>
                  <small>{user?.role}</small>
                </span>
              </NavLink>
              <button type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink className="topbar-cta" to="/login">
                Dang nhap
              </NavLink>
              <NavLink className="topbar-cta secondary" to="/register">
                Dang ky
              </NavLink>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
