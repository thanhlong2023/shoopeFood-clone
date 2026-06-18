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
    title: '�ang nh?p kh�ch h�ng',
    subtitle: '�?t m�n, theo d�i don h�ng v� qu?n l� h? so.',
    demoPhone: '0900000001',
    showRegisterLink: true,
  },
  MERCHANT: {
    title: '�ang nh?p ch? qu�n',
    subtitle: 'Qu?n l� don h�ng v� th?c don c?a qu�n.',
    demoPhone: '0900000003',
  },
  DRIVER: {
    title: '�ang nh?p tai xe',
    subtitle: 'Nhan don giao hang va cap nhat vi tri.',
    demoPhone: '0900000002',
    accountNote: 'Chua la tai xe? �ang k� tai trang chu (can bien so + CCCD) va cho Admin duyet.',
  },
  ADMIN: {
    title: '�ang nh?p Admin',
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
  
  const { phone, setPhone, password, setPassword, errors, isValid, handleBlur } = useLoginForm(config.demoPhone)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
      setErrorMessage(error instanceof Error ? error.message : 'Kh�ng th? dang nh?p')
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
            label="S? di?n tho?i"
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
            label="M?t kh?u"
            icon={<LockIcon />}
            type="password"
            placeholder="Nh?p m?t kh?u c?a b?n"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            className="full-width"
          />
        </div>

        <button type="submit" className={`checkout-button ${!isValid ? 'disabled' : ''}`} disabled={isSubmitting || !isValid}>
          {isSubmitting ? '�ang dang nh?p...' : '�ang nh?p'}
        </button>

        {config.showRegisterLink ? (
          <p className="login-register-hint">
            Chua c� t�i kho?n? <Link to="/register">�ang k� kh�ch h�ng</Link>
          </p>
        ) : null}

        {role !== 'ADMIN' ? <LoginPortalLinks activeRole={role} /> : null}
      </form>
    </section>
  )
}
