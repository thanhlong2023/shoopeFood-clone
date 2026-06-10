import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import LoginPortalLinks from '../components/auth/LoginPortalLinks'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { getDefaultRedirect } from '../utils/loginPaths'
import type { UserRole } from '../types'

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
    title: 'Dang nhap khach hang',
    subtitle: 'Dat mon, theo doi don hang va quan ly ho so.',
    demoPhone: '0900000001',
    showRegisterLink: true,
  },
  MERCHANT: {
    title: 'Dang nhap chu quan',
    subtitle: 'Quan ly don hang va thuc don cua quan.',
    demoPhone: '0900000003',
    accountNote: 'Chua co quan? Dang ky mo nha hang tai trang chu va cho Admin duyet.',
  },
  DRIVER: {
    title: 'Dang nhap tai xe',
    subtitle: 'Nhan don giao hang va cap nhat vi tri.',
    demoPhone: '0900000002',
    accountNote: 'Chua la tai xe? Dang ky tai trang chu (can bien so + CCCD) va cho Admin duyet.',
  },
  ADMIN: {
    title: 'Dang nhap Admin',
    subtitle: 'Quan tri he thong, nha hang, menu va nguoi dung.',
    demoPhone: '0900000005',
    accountNote: 'Chi danh cho quan tri vien he thong.',
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
  const [phone, setPhone] = useState(config.demoPhone)
  const [password, setPassword] = useState('123456')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated && user?.role) {
      navigate(getDefaultRedirect(user.role), { replace: true })
    }
  }, [isAuthenticated, navigate, user?.role])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setErrorMessage(null)
      const user = await login({ phone, password, role })
      const state = location.state as LocationState | null
      navigate(state?.from || getDefaultRedirect(user.role), { replace: true })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Khong the dang nhap')
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
          <label>
            <span>So dien thoai</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0900000001" />
          </label>

          <label>
            <span>Mat khau</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        </div>

        <button type="submit" className="checkout-button" disabled={isSubmitting}>
          {isSubmitting ? 'Dang dang nhap...' : 'Dang nhap'}
        </button>

        {config.showRegisterLink ? (
          <p className="login-register-hint">
            Chua co tai khoan? <Link to="/register">Dang ky khach hang</Link>
          </p>
        ) : null}

        {role !== 'ADMIN' ? <LoginPortalLinks activeRole={role} /> : null}
      </form>
    </section>
  )
}
