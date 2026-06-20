import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { EyeIcon, EyeOffIcon, XIcon, LockIcon, PhoneIcon, ShieldIcon } from '../common/Icons'
import { requestPasswordReset, resetPassword } from '../../services/api/auth'

type AuthView = 'login' | 'register' | 'forgot_password' | 'reset_password'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register'
  callbackUrl?: string
}

const PHONE_REGEX = /^(84|0[3|5|7|8|9])+([0-9]{8})\b/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export default function AuthModal({ isOpen, onClose, initialView = 'login', callbackUrl }: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView)
  const [showPassword, setShowPassword] = useState(false)
  
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  
  const [touched, setTouched] = useState({ phone: false, password: false, confirmPassword: false, otp: false })
  const [errors, setErrors] = useState({ phone: '', password: '', confirmPassword: '', otp: '', form: '' })
  
  const { login, register } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    if (isOpen) {
      setView(initialView)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
      resetForm()
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen, initialView])

  const resetForm = () => {
    setPhone('')
    setPassword('')
    setConfirmPassword('')
    setOtp('')
    setTouched({ phone: false, password: false, confirmPassword: false, otp: false })
    setErrors({ phone: '', password: '', confirmPassword: '', otp: '', form: '' })
    setSuccessMessage('')
  }

  useEffect(() => {
    const newErrors = { phone: '', password: '', confirmPassword: '', otp: '', form: errors.form }
    
    if (touched.phone) {
      if (!phone) newErrors.phone = 'Vui lòng nhập số điện thoại'
      else if (!PHONE_REGEX.test(phone)) newErrors.phone = 'Số điện thoại không hợp lệ (VD: 0912345678)'
    }
    
    if (touched.password) {
      if (!password) newErrors.password = 'Vui lòng nhập mật khẩu'
      else if (!PASSWORD_REGEX.test(password)) newErrors.password = 'Mật khẩu ≥ 8 ký tự, gồm chữ hoa, chữ thường và số.'
    }

    if ((view === 'register' || view === 'reset_password') && touched.confirmPassword) {
      if (password !== confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp!'
    }

    if (view === 'reset_password' && touched.otp) {
      if (!otp) newErrors.otp = 'Vui lòng nhập mã OTP'
      else if (otp.length !== 6) newErrors.otp = 'Mã OTP phải có 6 chữ số'
    }

    setErrors(newErrors)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone, password, confirmPassword, otp, touched, view])

  const isValid = () => {
    if (view === 'login') return phone && password && !errors.phone && !errors.password
    if (view === 'register') return phone && password && confirmPassword && !errors.phone && !errors.password && !errors.confirmPassword
    if (view === 'forgot_password') return phone && !errors.phone
    if (view === 'reset_password') return otp && password && confirmPassword && !errors.otp && !errors.password && !errors.confirmPassword
    return false
  }

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid()) return
    
    setIsSubmitting(true)
    setErrors(prev => ({ ...prev, form: '' }))
    setSuccessMessage('')

    try {
      if (view === 'login') {
        await login({ phone, password, role: 'CUSTOMER' })
        onClose()
        if (callbackUrl) window.location.href = callbackUrl
      } else if (view === 'register') {
        await register({ fullName: 'Khách hàng', phone, password })
        onClose()
        if (callbackUrl) window.location.href = callbackUrl
      } else if (view === 'forgot_password') {
        await requestPasswordReset(phone)
        setSuccessMessage('Mã OTP đã được gửi đến số điện thoại của bạn.')
        setTimeout(() => {
          setView('reset_password')
          setSuccessMessage('')
        }, 2000)
      } else if (view === 'reset_password') {
        await resetPassword({ phone, otp, newPassword: password })
        setSuccessMessage('Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.')
        setTimeout(() => {
          onClose()
          setPassword('')
          setConfirmPassword('')
          setOtp('')
          setSuccessMessage('')
          setTouched(t => ({ ...t, password: false, confirmPassword: false, otp: false }))
        }, 2000)
      }
    } catch (err) {
      if (view === 'login' || view === 'register') {
        setErrors((prev) => ({ ...prev, form: 'Thông tin đăng nhập không chính xác hoặc lỗi mạng.' }))
      } else {
        setErrors((prev) => ({ ...prev, form: err instanceof Error ? err.message : 'Đã có lỗi xảy ra.' }))
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTitle = () => {
    if (view === 'login') return 'Đăng Nhập'
    if (view === 'register') return 'Tạo Tài Khoản'
    if (view === 'forgot_password') return 'Quên Mật Khẩu'
    if (view === 'reset_password') return 'Đặt Lại Mật Khẩu'
  }

  const getSubtitle = () => {
    if (view === 'login') return 'Chào mừng bạn quay lại ShopeeFood'
    if (view === 'register') return 'Trải nghiệm ẩm thực tuyệt vời ngay hôm nay'
    if (view === 'forgot_password') return 'Nhập số điện thoại để nhận mã OTP khôi phục'
    if (view === 'reset_password') return `Nhập mã OTP đã được gửi tới ${phone}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-8 text-left align-middle shadow-2xl transition-all duration-300 scale-100"
        role="dialog"
      >
        <button 
          onClick={onClose} 
          className="absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
        >
          <XIcon className="h-5 w-5" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            {getTitle()}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {getSubtitle()}
          </p>
        </div>

        {errors.form && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center animate-fade-in">
            {errors.form}
          </div>
        )}
        
        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 text-green-600 rounded-lg text-sm text-center animate-fade-in">
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {(view === 'login' || view === 'register' || view === 'forgot_password') && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <PhoneIcon className={`h-5 w-5 ${errors.phone ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, phone: true }))}
                disabled={view === 'forgot_password' && isSubmitting}
                className={`block w-full rounded-xl border px-10 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all ${
                  errors.phone 
                    ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 bg-gray-50 focus:border-orange-500 focus:ring-orange-200'
                }`}
                placeholder="Số điện thoại"
              />
              {errors.phone && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.phone}</p>}
            </div>
          )}

          {view === 'reset_password' && (
            <div className="relative animate-fade-in-down">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <ShieldIcon className={`h-5 w-5 ${errors.otp ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched(t => ({ ...t, otp: true }))}
                className={`block w-full rounded-xl border px-10 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all ${
                  errors.otp 
                    ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 bg-gray-50 focus:border-orange-500 focus:ring-orange-200'
                }`}
                placeholder="Mã OTP 6 số"
              />
              {errors.otp && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.otp}</p>}
            </div>
          )}

          {(view === 'login' || view === 'register' || view === 'reset_password') && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <LockIcon className={`h-5 w-5 ${errors.password ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, password: true }))}
                className={`block w-full rounded-xl border px-10 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all ${
                  errors.password 
                    ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 bg-gray-50 focus:border-orange-500 focus:ring-orange-200'
                }`}
                placeholder={view === 'reset_password' ? 'Mật khẩu mới' : 'Mật khẩu'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
              </button>
              {errors.password && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.password}</p>}
            </div>
          )}

          {view === 'login' && (
            <div className="flex justify-end mt-1">
              <button 
                type="button"
                onClick={() => setView('forgot_password')} 
                className="text-sm font-medium text-orange-500 hover:text-orange-600 transition-colors focus:outline-none"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          {(view === 'register' || view === 'reset_password') && (
            <div className="relative animate-fade-in-down">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <LockIcon className={`h-5 w-5 ${errors.confirmPassword ? 'text-red-500' : 'text-gray-400'}`} />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onBlur={() => setTouched(t => ({ ...t, confirmPassword: true }))}
                className={`block w-full rounded-xl border px-10 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all ${
                  errors.confirmPassword 
                    ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-200' 
                    : 'border-gray-300 bg-gray-50 focus:border-orange-500 focus:ring-orange-200'
                }`}
                placeholder={view === 'reset_password' ? 'Xác nhận mật khẩu mới' : 'Xác nhận mật khẩu'}
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.confirmPassword}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid() || isSubmitting}
            className={`w-full py-3.5 rounded-xl text-white font-semibold text-lg transition-all shadow-md ${
              isValid() && !isSubmitting
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transform hover:-translate-y-0.5'
                : 'bg-gray-300 cursor-not-allowed opacity-70'
            }`}
          >
            {isSubmitting ? 'Đang xử lý...' : (
              view === 'login' ? 'Đăng Nhập' : 
              view === 'register' ? 'Đăng Ký' : 
              view === 'forgot_password' ? 'Nhận mã OTP' : 'Xác nhận Đổi Mật Khẩu'
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 flex flex-col items-center gap-2">
          {view === 'login' && (
            <p>
              Chưa có tài khoản?{' '}
              <button onClick={() => setView('register')} className="font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Đăng ký ngay
              </button>
            </p>
          )}
          
          {(view === 'register' || view === 'forgot_password') && (
            <p>
              Đã có tài khoản?{' '}
              <button onClick={() => setView('login')} className="font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Đăng nhập
              </button>
            </p>
          )}

          {view === 'reset_password' && (
            <button 
              type="button"
              onClick={() => setView('forgot_password')} 
              className="text-orange-500 hover:text-orange-600 transition-colors"
            >
              Gửi lại mã OTP
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
