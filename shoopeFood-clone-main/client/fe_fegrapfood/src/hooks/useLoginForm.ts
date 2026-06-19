import { useState, useCallback, useMemo } from 'react'

export const PHONE_REGEX = /^(84|0[3|5|7|8|9])+([0-9]{8})\b/

export function useLoginForm(initialPhone = '') {
  const [phone, setPhone] = useState(initialPhone)
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState({ phone: false, password: false })

  const errors = useMemo(() => {
    const nextErrors: Record<'phone' | 'password', string> = { phone: '', password: '' }
    
    if (touched.phone) {
      if (!phone.trim()) {
        nextErrors.phone = 'Vui lòng nhâp số điện thoại'
      } else if (!PHONE_REGEX.test(phone.trim())) {
        nextErrors.phone = 'Số điện thoại khong hop le'
      }
    }

    if (touched.password) {
      if (!password) {
        nextErrors.password = 'Vui lòng nhập mật khẩu'
      } else if (password.length < 6) {
        nextErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự'
      }
    }

    return nextErrors
  }, [phone, password, touched])

  const isValid = useMemo(() => {
    const isPhoneValid = phone.trim() && PHONE_REGEX.test(phone.trim())
    const isPasswordValid = password && password.length >= 6
    return Boolean(isPhoneValid && isPasswordValid)
  }, [phone, password])

  const handleBlur = useCallback((field: 'phone' | 'password') => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  return {
    phone,
    setPhone,
    password,
    setPassword,
    errors,
    isValid,
    handleBlur,
  }
}
