import { NavLink } from 'react-router-dom'
import { APP_NAME } from '../../constants/app'
import { useAuth } from '../../contexts/AuthContext'

export default function Navbar() {
  const { isAuthenticated, user, logout, hasRole } = useAuth()

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
          <li>
            <NavLink to="/">Dat mon</NavLink>
          </li>
          <li>
            <NavLink to="/tracking">Theo doi</NavLink>
          </li>
<<<<<<< HEAD
          {hasRole(['DRIVER', 'ADMIN']) ? (
            <li>
              <NavLink to="/driver">Tai xe</NavLink>
            </li>
          ) : null}
          {hasRole(['CUSTOMER', 'MERCHANT', 'ADMIN']) ? (
            <li>
              <NavLink to="/restaurants">Nha hang</NavLink>
            </li>
          ) : null}
=======
          <li>
            <NavLink to="/driver">Tai xe</NavLink>
          </li>
          <li>
            <NavLink to="/restaurants">Nha hang</NavLink>
          </li>
>>>>>>> origin/main
          {hasRole(['ADMIN']) ? (
            <li>
              <NavLink to="/admin">Admin</NavLink>
            </li>
          ) : null}
        </ul>

        <div className="topbar-account">
          {isAuthenticated ? (
            <>
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
