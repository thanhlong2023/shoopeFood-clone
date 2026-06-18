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
  useDocumentTitle(`${APP_NAME} | �ang k� kh�ch h�ng`)

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
      setFormError(error instanceof Error ? error.message : 'Kh�ng th? dang k�')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-hero">
        <div>
          <span className="hero-badge">GrabFood</span>
          <h1>�ang k� kh�ch h�ng</h1>
          <p>T?o t�i kho?n d? d?t m�n ngay. Mu?n l�m t�i x? ho?c m? qu�n? �ang k� t?i trang ch? sau khi dang nh?p.</p>
        </div>
      </div>

      <form className="login-panel" noValidate onSubmit={handleSubmit}>
        {formError ? <p className="app-feedback error">{formError}</p> : null}

        <div className="login-form-grid">
          <FormInput
            label="H? t�n"
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
            label="S? di?n tho?i"
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
            label="M?t kh?u"
            icon={<LockIcon />}
            type="password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            placeholder="T?o m?t kh?u m?i"
            className="full-width"
          />

          <FormInput
            label="X�c nh?n m?t kh?u"
            icon={<LockIcon />}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => handleBlur('confirmPassword')}
            error={errors.confirmPassword}
            placeholder="Nh?p l?i m?t kh?u tr�n"
            className="full-width"
          />
        </div>

        <button type="submit" className={`checkout-button ${!isValid ? 'disabled' : ''}`} disabled={isSubmitting || !isValid}>
          {isSubmitting ? 'Dang xu ly...' : '�ang k�'}
        </button>

        <p className="login-register-hint">
          �� c� t�i kho?n? <Link to="/login">�ang nh?p kh�ch h�ng</Link>
        </p>

        <LoginPortalLinks activeRole="CUSTOMER" />
      </form>
    </section>
  )
}
