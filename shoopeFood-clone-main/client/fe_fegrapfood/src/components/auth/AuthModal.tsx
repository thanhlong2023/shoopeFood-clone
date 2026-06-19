import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { EyeIcon, EyeOffIcon, XIcon, LockIcon, PhoneIcon } from '../common/Icons'

type AuthModalProps = {
  isOpen: boolean
  onClose: () => void
  initialView?: 'login' | 'register'
  callbackUrl?: string
}

const PHONE_REGEX = /^(84|0[3|5|7|8|9])+([0-9]{8})\b/
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/

export default function AuthModal({ isOpen, onClose, initialView = 'login', callbackUrl }: AuthModalProps) {
  const [view, setView] = useState<'login' | 'register'>(initialView)
  const [showPassword, setShowPassword] = useState(false)
  
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [touched, setTouched] = useState({ phone: false, password: false, confirmPassword: false })
  const [errors, setErrors] = useState({ phone: '', password: '', confirmPassword: '' })
  
  const { login, register } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setView(initialView)
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
      setPhone('')
      setPassword('')
      setConfirmPassword('')
      setTouched({ phone: false, password: false, confirmPassword: false })
    }
    return () => { document.body.style.overflow = 'auto' }
  }, [isOpen, initialView])

  useEffect(() => {
    const newErrors = { phone: '', password: '', confirmPassword: '' }
    
    if (touched.phone) {
      if (!phone) newErrors.phone = 'Vui lòng nhập số điện thoại'
      else if (!PHONE_REGEX.test(phone)) newErrors.phone = 'Số điện thoại không hợp lệ (VD: 0912345678)'
    }
    
    if (touched.password) {
      if (!password) newErrors.password = 'Vui lòng nhập mật khẩu'
      else if (!PASSWORD_REGEX.test(password)) newErrors.password = 'Mật khẩu ≥ 8 ký tự, gồm chữ hoa, chữ thường và số.'
    }

    if (view === 'register' && touched.confirmPassword) {
      if (password !== confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp!'
    }

    setErrors(newErrors)
  }, [phone, password, confirmPassword, touched, view])

  const isValid = view === 'login' 
    ? phone && password && !errors.phone && !errors.password
    : phone && password && confirmPassword && !errors.phone && !errors.password && !errors.confirmPassword

  if (!isOpen) return null

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    
    setIsSubmitting(true)
    try {
      if (view === 'login') {
        await login({ phone, password, role: 'CUSTOMER' })
      } else {
        await register({ fullName: 'Khách hàng', phone, password })
      }
      onClose()
      if (callbackUrl) window.location.href = callbackUrl
    } catch (err) {
      setErrors((prev) => ({ ...prev, phone: 'Thông tin đăng nhập không chính xác hoặc lỗi mạng.' }))
    } finally {
      setIsSubmitting(false)
    }
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
            {view === 'login' ? 'Đăng Nhập' : 'Tạo Tài Khoản'}
          </h2>
          <p className="mt-2 text-sm text-gray-500">
            {view === 'login' ? 'Chào mừng bạn quay lại ShopeeFood' : 'Trải nghiệm ẩm thực tuyệt vời ngay hôm nay'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <PhoneIcon className={`h-5 w-5 ${errors.phone ? 'text-red-500' : 'text-gray-400'}`} />
            </div>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setTouched(t => ({ ...t, phone: true }))}
              className={`block w-full rounded-xl border px-10 py-3 text-gray-900 focus:outline-none focus:ring-2 transition-all ${
                errors.phone 
                  ? 'border-red-500 bg-red-50/50 focus:border-red-500 focus:ring-red-200' 
                  : 'border-gray-300 bg-gray-50 focus:border-orange-500 focus:ring-orange-200'
              }`}
              placeholder="Số điện thoại"
            />
            {errors.phone && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.phone}</p>}
          </div>

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
              placeholder="Mật khẩu"
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

          {view === 'register' && (
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
                placeholder="Xác nhận mật khẩu"
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-red-500 animate-fade-in">{errors.confirmPassword}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={`w-full py-3.5 rounded-xl text-white font-semibold text-lg transition-all shadow-md ${
              isValid && !isSubmitting
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 hover:shadow-lg transform hover:-translate-y-0.5'
                : 'bg-gray-300 cursor-not-allowed opacity-70'
            }`}
          >
            {isSubmitting ? 'Đang xử lý...' : (view === 'login' ? 'Đăng Nhập' : 'Đăng Ký')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600">
          {view === 'login' ? (
            <p>
              Chưa có tài khoản?{' '}
              <button onClick={() => setView('register')} className="font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Đăng ký ngay
              </button>
            </p>
          ) : (
            <p>
              Đã có tài khoản?{' '}
              <button onClick={() => setView('login')} className="font-semibold text-orange-500 hover:text-orange-600 transition-colors">
                Đăng nhập
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
