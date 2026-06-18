import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LoginPortalLinks from '../components/auth/LoginPortalLinks'
import FormInput from '../components/common/FormInput'
import { PhoneIcon, LockIcon, UserIcon } from '../components/common/Icons'
import { APP_NAME } from '../constants/app'
import { useAuth } from '../contexts/AuthContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { registerCustomer } from '../services/api/auth'
import { getDefaultRedirect } from '../utils/loginPaths'
import { useRegisterForm } from '../hooks/useRegisterForm'

export default function RegisterPage() {
  useDocumentTitle(`${APP_NAME} | Dang ky khach hang`)

  const navigate = useNavigate()
  const { login } = useAuth()
  
  const {
    fullName, setFullName,
    phone, setPhone,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    errors, isValid, handleBlur
  } = useRegisterForm()
  
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!isValid) return

    setFormError(null)
    try {
      setIsSubmitting(true)
      await registerCustomer({ fullName: fullName.trim(), phone: phone.trim(), password })
      await login({ phone: phone.trim(), password, role: 'CUSTOMER' })
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
          <FormInput
            label="Ho ten"
            icon={<UserIcon />}
            maxLength={100}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => handleBlur('fullName')}
            error={errors.fullName}
            placeholder="Nguyen Van A"
            className="full-width"
          />

          <FormInput
            label="So dien thoai"
            icon={<PhoneIcon />}
            inputMode="tel"
            maxLength={15}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => handleBlur('phone')}
            error={errors.phone}
            placeholder="0901234567"
            className="full-width"
          />

          <FormInput
            label="Mat khau"
            icon={<LockIcon />}
            type="password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            placeholder="Tao mat khau moi"
            className="full-width"
          />

          <FormInput
            label="Xac nhan mat khau"
            icon={<LockIcon />}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => handleBlur('confirmPassword')}
            error={errors.confirmPassword}
            placeholder="Nhap lai mat khau tren"
            className="full-width"
          />
        </div>

        <button type="submit" className={`checkout-button ${!isValid ? 'disabled' : ''}`} disabled={isSubmitting || !isValid}>
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
