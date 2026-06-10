import { NavLink } from 'react-router-dom'
import { APP_NAME } from '../../constants/app'
import { useAuth } from '../../contexts/AuthContext'

export default function Navbar() {
  const { isAuthenticated, user, logout, hasRole } = useAuth()

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
              <li>
                <NavLink to="/tracking">Theo doi</NavLink>
              </li>
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
                Ho so
              </NavLink>
              <span>{user?.role}</span>
              <button type="button" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink className="topbar-cta" to="/login">
              Dang nhap
            </NavLink>
          )}
        </div>
      </nav>
    </header>
  )
}
