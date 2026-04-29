import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import type { UserRole } from '../types'

type LocationState = {
  from?: string
}

const roleOptions: Array<{ role: UserRole; label: string; hint: string; phone: string }> = [
  { role: 'CUSTOMER', label: 'Khach hang', hint: 'Dat mon va theo doi don', phone: '0900000011' },
  { role: 'DRIVER', label: 'Tai xe', hint: 'Nhan don va cap nhat vi tri', phone: '0900000012' },
  { role: 'MERCHANT', label: 'Chu quan', hint: 'Quan ly nha hang', phone: '0900000010' },
  { role: 'ADMIN', label: 'Admin', hint: 'Quan tri he thong', phone: '0900000010' },
]

function getDefaultRedirect(role: UserRole) {
  if (role === 'ADMIN') {
    return '/admin'
  }

  if (role === 'DRIVER') {
    return '/driver'
  }

  if (role === 'MERCHANT') {
    return '/restaurants'
  }

  return '/'
}

export default function LoginPage() {
  useDocumentTitle(`${APP_NAME} | Dang nhap`)

  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuth()
  const [role, setRole] = useState<UserRole>('CUSTOMER')
  const [phone, setPhone] = useState(roleOptions[0].phone)
  const [password, setPassword] = useState('123456')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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
          <h1>Dang nhap theo vai tro</h1>
          <p>Moi role se vao dung khu vuc: khach hang, tai xe, chu quan hoac admin.</p>
        </div>
      </div>

      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="role-grid" aria-label="Chon vai tro">
          {roleOptions.map((option) => (
            <button
              key={option.role}
              type="button"
              className={`role-card ${role === option.role ? 'active' : ''}`}
              onClick={() => {
                setRole(option.role)
                setPhone(option.phone)
              }}
            >
              <strong>{option.label}</strong>
              <span>{option.hint}</span>
            </button>
          ))}
        </div>

        {errorMessage ? <p className="app-feedback error">{errorMessage}</p> : null}

        <div className="login-form-grid">
          <label>
            <span>So dien thoai</span>
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0900000010" />
          </label>

          <label>
            <span>Mat khau</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
        </div>

        <button type="submit" className="checkout-button" disabled={isSubmitting}>
          {isSubmitting ? 'Dang dang nhap...' : 'Dang nhap'}
        </button>
      </form>
    </section>
  )
}
