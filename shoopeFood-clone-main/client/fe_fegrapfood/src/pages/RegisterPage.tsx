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
  useDocumentTitle(`${APP_NAME} | Đăng ký khách hàng`)

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
      setFormError(error instanceof Error ? error.message : 'Không thể đăng ký')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="login-page">
      <div className="login-hero">
        <div>
          <span className="hero-badge">GrabFood</span>
          <h1>Đăng ký khách hàng</h1>
          <p>Tạo tài khoản để đặt món ngay. Muốn làm tài xế hoặc mở quán? Đăng ký tại trang chủ sau khi đăng nhập.</p>
        </div>
      </div>

      <form className="login-panel" noValidate onSubmit={handleSubmit}>
        {formError ? <p className="app-feedback error">{formError}</p> : null}

        <div className="login-form-grid">
          <FormInput
            label="Họ tên"
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
            label="Số điện thoại"
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
            label="Mật khẩu"
            icon={<LockIcon />}
            type="password"
            maxLength={72}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onBlur={() => handleBlur('password')}
            error={errors.password}
            placeholder="Tạo mật khẩu mới"
            className="full-width"
          />

          <FormInput
            label="Xác nhận mật khẩu"
            icon={<LockIcon />}
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => handleBlur('confirmPassword')}
            error={errors.confirmPassword}
            placeholder="Nhập lại mật khẩu trên"
            className="full-width"
          />
        </div>

        <button type="submit" className={`checkout-button ${!isValid ? 'disabled' : ''}`} disabled={isSubmitting || !isValid}>
          {isSubmitting ? 'Đang xử lý...' : 'Đăng ký'}
        </button>

        <p className="login-register-hint">
          Đã có tài khoản? <Link to="/login">Đăng nhập khách hàng</Link>
        </p>

        <LoginPortalLinks activeRole="CUSTOMER" />
      </form>
    </section>
  )
}
