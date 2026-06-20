import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import LoginPortalLinks from '../components/auth/LoginPortalLinks'
import FormInput from '../components/common/FormInput'
import { PhoneIcon, LockIcon } from '../components/common/Icons'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useLoginForm } from '../hooks/useLoginForm'
import { getDefaultRedirect } from '../utils/loginPaths'
import type { UserRole } from '../types'
import AuthModal from '../components/auth/AuthModal'

type LocationState = {
  from?: string
}

type LoginPageConfig = {
  title: string
  subtitle: string
  demoPhone: string
  accountNote?: string
  showRegisterLink?: boolean
}

const LOGIN_CONFIG: Record<UserRole, LoginPageConfig> = {
  CUSTOMER: {
    title: 'Đăng nhập khách hàng',
    subtitle: 'Đặt món, theo dõi đơn hàng và quản lý hồ sơ.',
    demoPhone: '0900000001',
    showRegisterLink: true,
  },
  MERCHANT: {
    title: 'Đăng nhập chủ quán',
    subtitle: 'Quản lý đơn hàng và thực đơn của quán.',
    demoPhone: '0900000003',
  },
  DRIVER: {
    title: 'Đăng nhập tài xế',
    subtitle: 'Nhận đơn giao hàng và cập nhật vị trí.',
    demoPhone: '0900000002',
    accountNote: 'Chưa là tài xế? Đăng ký tại trang chủ (cần biển số + CCCD) và chờ Admin duyệt.',
  },
  ADMIN: {
    title: 'Đăng nhập Admin',
    subtitle: 'Quản trị hệ thống, nhà hàng, menu và người dùng.',
    demoPhone: '0900000005',
    accountNote: 'Chỉ dành cho quản trị viên hệ thống.',
  },
}

type LoginPageProps = {
  role: UserRole
}

export default function LoginPage({ role }: LoginPageProps) {
  const config = LOGIN_CONFIG[role]
  useDocumentTitle(`${APP_NAME} | ${config.title}`)

  const navigate = useNavigate()
  const location = useLocation()
  const { login, isAuthenticated, user } = useAuth()
  
  const { phone, setPhone, password, setPassword, errors, isValid, handleBlur } = useLoginForm(config.demoPhone)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false)

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(getDefaultRedirect(user.role), { replace: true })
    }
  }, [isAuthenticated, navigate, user?.role])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid) return

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      const loggedUser = await login({ phone, password, role })
      const state = location.state as LocationState | null
      navigate(state?.from || getDefaultRedirect(loggedUser.role), { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Không thể đăng nhập')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-hero">
        <div>
          <span className="hero-badge">GrabFood</span>
          <h1>{config.title}</h1>
          <p>{config.subtitle}</p>
        </div>
      </div>

      <form className="login-panel" noValidate onSubmit={handleSubmit}>
        {config.accountNote ? <p className="login-account-note">{config.accountNote}</p> : null}
        {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

        <div className="login-form-grid">
          <FormInput
            label="Số điện thoại"
            icon={<PhoneIcon />}
            placeholder="0900000001"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => handleBlur('phone')}
            error={errors.phone}
            className="full-width"
            inputMode="tel"
          />

          <FormInput
            label="Mật khẩu"
            icon={<LockIcon />}
            type="password"
            placeholder="Nhập mật khẩu của bạn"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            className="full-width"
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-10px', marginBottom: '10px' }}>
            <button 
              type="button" 
              onClick={() => setIsForgotModalOpen(true)}
              style={{ background: 'none', border: 'none', color: '#ff7a00', cursor: 'pointer', fontWeight: 600, fontSize: '14px', padding: 0 }}
            >
              Quên mật khẩu?
            </button>
          </div>
        </div>

        <button type="submit" className={`checkout-button ${!isValid ? 'disabled' : ''}`} disabled={isSubmitting || !isValid}>
          {isSubmitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>

        {config.showRegisterLink ? (
          <p className="login-register-hint">
            Chưa có tài khoản? <Link to="/register">Đăng ký khách hàng</Link>
          </p>
        ) : null}

        {role !== 'ADMIN' ? <LoginPortalLinks activeRole={role} /> : null}
      </form>

      <AuthModal 
        isOpen={isForgotModalOpen} 
        onClose={() => setIsForgotModalOpen(false)} 
        initialView="forgot_password" 
      />
    </section>
  )
}
