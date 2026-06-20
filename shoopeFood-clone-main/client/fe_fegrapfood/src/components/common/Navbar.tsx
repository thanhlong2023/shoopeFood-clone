import { NavLink, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { APP_NAME } from '../../constants/app'
import { useAuth } from '../../contexts/AuthContext'
import ApplyDriverModal from '../partner/ApplyDriverModal'
import ApplyMerchantModal from '../partner/ApplyMerchantModal'

export default function Navbar() {
  const { isAuthenticated, user, logout, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const isMerchant = hasRole(['MERCHANT'])
  const isAdmin = hasRole(['ADMIN'])
  const isDriver = hasRole(['DRIVER'])
  const showCustomerNav = !isAuthenticated || hasRole(['CUSTOMER'])
  const isPortal = location.pathname === '/'

  // Search logic synced with URL search parameter
  const searchTerm = searchParams.get('q') || ''
  const handleSearchChange = (val: string) => {
    if (window.location.pathname !== '/food') {
      navigate(`/food?q=${encodeURIComponent(val)}`)
    } else {
      setSearchParams((prev) => {
        if (!val) {
          prev.delete('q')
        } else {
          prev.set('q', val)
        }
        return prev
      })
    }
  }

  // Cart count state updated via custom event
  const [cartCount, setCartCount] = useState(0)
  useEffect(() => {
    const handleCartUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<{ count: number }>
      setCartCount(customEvent.detail.count || 0)
    }
    window.addEventListener('cart-updated', handleCartUpdate)
    return () => window.removeEventListener('cart-updated', handleCartUpdate)
  }, [])

  // B2B Partner links modal state
  const [driverOpen, setDriverOpen] = useState(false)
  const [merchantOpen, setMerchantOpen] = useState(false)

  // Scroll to checkout or home
  const handleCartClick = () => {
    const checkoutEl = document.getElementById('checkout')
    if (checkoutEl) {
      checkoutEl.scrollIntoView({ behavior: 'smooth' })
    } else {
      navigate('/food')
    }
  }

  return (
    <header className="topbar-wrap border-b border-gray-100 bg-white/96 sticky top-0 z-[1010] backdrop-blur-md">
      <nav className="max-w-[1440px] mx-auto min-height-[68px] flex items-center justify-between gap-4 px-4 py-3" aria-label="Global navigation">
        {/* Left: Brand Logo + Integrated Search Bar */}
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <NavLink to="/" className="flex items-center gap-2 text-gray-900 no-underline font-bold shrink-0 hover:opacity-80 transition-opacity">
            <span className="w-[34px] h-[34px] inline-grid place-items-center rounded-lg bg-brand text-white font-black" aria-hidden="true">
              G
            </span>
            <strong className="text-lg tracking-tight hidden sm:inline">{APP_NAME}</strong>
          </NavLink>

          {/* App Switcher Button (Go back to Portal) */}
          {!isPortal && (
            <NavLink 
              to="/" 
              className="p-2 text-gray-400 hover:text-brand hover:bg-brand-light rounded-lg transition-colors border-0 bg-transparent flex items-center justify-center cursor-pointer ml-2"
              title="Chọn ứng dụng khác"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </NavLink>
          )}

          {/* Integrated Search Input for Customer Role */}
          {showCustomerNav && !isPortal && (
            <div className="relative flex-1 max-w-md hidden md:block ml-4">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Tìm món ăn, nhà hàng..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent text-sm bg-gray-50 transition-all font-sans leading-normal"
              />
            </div>
          )}
        </div>

        {/* Right: Cart, Navlinks & User profile */}
        <div className="flex items-center gap-4 shrink-0">
          {!isPortal && (
            <ul className="list-none m-0 p-1 flex gap-1 border border-gray-200 rounded-full bg-gray-50">
              {isMerchant && (
                <>
                  <li>
                    <NavLink to="/merchant/orders" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>Đơn hàng</NavLink>
                  </li>
                  <li>
                    <NavLink to="/merchant/menu" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-500'}`}>Thực đơn</NavLink>
                  </li>
                </>
              )}

              {showCustomerNav && !isMerchant && (
                <>
                  <li>
                    <NavLink to="/food" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>Đặt món</NavLink>
                  </li>
                  <li>
                    <NavLink to="/restaurants" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>Nhà hàng</NavLink>
                  </li>
                  {isAuthenticated ? (
                    <li>
                      <NavLink to="/tracking" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-brand shadow-sm' : 'text-gray-500'}`}>Theo dõi</NavLink>
                    </li>
                  ) : null}
                  {isAuthenticated && user?.role === 'CUSTOMER' && (
                    <>
                      <li>
                        <button
                          type="button"
                          onClick={() => setDriverOpen(true)}
                          className="inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline text-gray-500 hover:text-blue-500 hover:bg-blue-50/50 border-0 bg-transparent cursor-pointer transition-all"
                        >
                          Trở thành Tài xế
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => setMerchantOpen(true)}
                          className="inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline text-gray-500 hover:text-orange-500 hover:bg-orange-50/50 border-0 bg-transparent cursor-pointer transition-all"
                        >
                          Trở thành Nhà hàng
                        </button>
                      </li>
                    </>
                  )}
                </>
              )}

              {(isDriver || isAdmin) && (
                <li>
                  <NavLink to="/driver" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-blue-500 shadow-sm' : 'text-gray-500'}`}>Tài xế</NavLink>
                </li>
              )}

              {isAdmin && (
                <li>
                  <NavLink to="/admin" className={({ isActive }) => `inline-flex min-h-[34px] items-center justify-center px-4 py-1.5 rounded-full text-xs font-bold no-underline ${isActive ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500'}`}>Admin</NavLink>
                </li>
              )}
            </ul>
          )}

          {/* Cart Icon with badge for Customer Role */}
          {showCustomerNav && !isPortal && (
            <button
              type="button"
              onClick={handleCartClick}
              className="relative p-2 text-gray-600 hover:text-brand bg-transparent border-0 cursor-pointer transition-colors"
              aria-label="Xem giỏ hàng"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[10px] w-5 h-5 flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* User profile dropdown/actions */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-full hover:bg-gray-50 transition-all no-underline text-gray-700">
                  <span className="w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center font-black">
                    {(user?.fullName || user?.phone || 'U').charAt(0).toUpperCase()}
                  </span>
                  <span className="hidden lg:flex flex-col text-left leading-tight">
                    <strong className="text-xs font-bold text-gray-800">{user?.fullName || 'Hồ sơ'}</strong>
                    <small className="text-[10px] text-gray-400 font-medium">{user?.role}</small>
                  </span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/');
                  }}
                  className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border-0 rounded-full text-xs font-bold transition-all cursor-pointer"
                >
                  Đăng xuất
                </button>
              </>
            ) : (
              <div className="flex gap-2">
                <NavLink className="px-4 py-2 bg-gray-900 text-white rounded-full text-xs font-bold no-underline hover:bg-gray-800 transition-all" to="/login">
                  Đăng nhập
                </NavLink>
                <NavLink className="px-4 py-2 border border-gray-200 text-gray-700 rounded-full text-xs font-bold no-underline hover:bg-gray-50 transition-all" to="/register">
                  Đăng ký
                </NavLink>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Driver/Merchant Registration Modals */}
      <ApplyDriverModal isOpen={driverOpen} onClose={() => setDriverOpen(false)} />
      <ApplyMerchantModal isOpen={merchantOpen} onClose={() => setMerchantOpen(false)} />
    </header>
  )
}
