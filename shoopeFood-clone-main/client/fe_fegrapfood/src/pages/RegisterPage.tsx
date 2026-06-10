import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoginPortalLinks from '../components/auth/LoginPortalLinks'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { registerCustomer } from '../services/api/auth'
import { getDefaultRedirect } from '../utils/loginPaths'

type RegisterErrors = Partial<Record<'fullName' | 'phone' | 'password' | 'confirmPassword', string>>

export default function RegisterPage() {
  useDocumentTitle(`${APP_NAME} | Dang ky khach hang`)

  const navigate = useNavigate()
  const { login } = useAuth()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errors, setErrors] = useState<RegisterErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedName = fullName.trim()
    const trimmedPhone = phone.trim()
    const nextErrors: RegisterErrors = {}

    if (!trimmedName) {
      nextErrors.fullName = 'Ho ten la bat buoc'
    }

    if (!trimmedPhone) {
      nextErrors.phone = 'So dien thoai la bat buoc'
    }

    if (!password || password.length < 6) {
      nextErrors.password = 'Mat khau phai co it nhat 6 ky tu'
    }

    if (password !== confirmPassword) {
      nextErrors.confirmPassword = 'Mat khau xac nhan khong khop'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setErrors({})
    setFormError(null)

    try {
      setIsSubmitting(true)
      await registerCustomer({ fullName: trimmedName, phone: trimmedPhone, password })
      await login({ phone: trimmedPhone, password, role: 'CUSTOMER' })
      navigate(getDefaultRedirect('CUSTOMER'), { replace: true })
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Khong the dang ky')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-hero">
        <div>
          <span className="hero-badge">GrabFood</span>
          <h1>Dang ky khach hang</h1>
          <p>Tao tai khoan de dat mon ngay. Muon lam tai xe hoac mo quan? Dang ky tai trang chu sau khi dang nhap.</p>
        </div>
      </div>

      <form className="login-panel" noValidate onSubmit={handleSubmit}>
        {formError ? <p className="app-feedback error">{formError}</p> : null}

        <div className="login-form-grid">
          <label>
            <span>Ho ten</span>
            <input
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value)
                setErrors((current) => ({ ...current, fullName: undefined }))
              }}
              placeholder="Nguyen Van A"
            />
            {errors.fullName ? <p className="field-error">{errors.fullName}</p> : null}
          </label>

          <label>
            <span>So dien thoai</span>
            <input
              value={phone}
              onChange={(event) => {
                setPhone(event.target.value)
                setErrors((current) => ({ ...current, phone: undefined }))
              }}
              placeholder="0901234567"
            />
            {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
          </label>

          <label>
            <span>Mat khau</span>
            <input
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setErrors((current) => ({ ...current, password: undefined }))
              }}
            />
            {errors.password ? <p className="field-error">{errors.password}</p> : null}
          </label>

          <label>
            <span>Xac nhan mat khau</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value)
                setErrors((current) => ({ ...current, confirmPassword: undefined }))
              }}
            />
            {errors.confirmPassword ? <p className="field-error">{errors.confirmPassword}</p> : null}
          </label>
        </div>

        <button type="submit" className="checkout-button" disabled={isSubmitting}>
          {isSubmitting ? 'Dang xu ly...' : 'Dang ky'}
        </button>

        <p className="login-register-hint">
          Da co tai khoan? <Link to="/login">Dang nhap khach hang</Link>
        </p>

        <LoginPortalLinks activeRole="CUSTOMER" />
      </form>
    </section>
  )
}
