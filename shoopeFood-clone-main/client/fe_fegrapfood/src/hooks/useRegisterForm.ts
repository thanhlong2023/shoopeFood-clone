import { useState, useCallback, useMemo } from 'react'
import { PHONE_REGEX } from './useLoginForm'

export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/

export function useRegisterForm() {
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [touched, setTouched] = useState({
    fullName: false,
    phone: false,
    password: false,
    confirmPassword: false,
  })

  const errors = useMemo(() => {
    const nextErrors: Record<'fullName' | 'phone' | 'password' | 'confirmPassword', string> = {
      fullName: '',
      phone: '',
      password: '',
      confirmPassword: '',
    }

    if (touched.fullName) {
      if (!fullName.trim()) {
        nextErrors.fullName = 'Vui long nhap ho ten'
      } else if (fullName.trim().length < 2) {
        nextErrors.fullName = 'Họ tên phai co it nhat 2 ky tu'
      }
    }

    if (touched.phone) {
      if (!phone.trim()) {
        nextErrors.phone = 'Vui long nhap so dien thoai'
      } else if (!PHONE_REGEX.test(phone.trim())) {
        nextErrors.phone = 'Số điện thoại khong hop le'
      }
    }

    if (touched.password) {
      if (!password) {
        nextErrors.password = 'Vui long nhap mat khau'
      } else if (!PASSWORD_REGEX.test(password)) {
        nextErrors.password = 'Mật khẩu gom it nhat 8 ky tu, 1 chu in hoa, 1 chu thuong, 1 so va 1 ky tu dac biet'
      }
    }

    if (touched.confirmPassword || touched.password) {
      if (confirmPassword && confirmPassword !== password) {
        nextErrors.confirmPassword = 'Mật khẩu xác nhận khong khop'
      }
    }

    return nextErrors
  }, [fullName, phone, password, confirmPassword, touched])

  const isValid = useMemo(() => {
    const isNameValid = fullName.trim().length >= 2
    const isPhoneValid = phone.trim() && PHONE_REGEX.test(phone.trim())
    const isPasswordValid = PASSWORD_REGEX.test(password)
    const isConfirmValid = confirmPassword === password && confirmPassword.length > 0
    return Boolean(isNameValid && isPhoneValid && isPasswordValid && isConfirmValid)
  }, [fullName, phone, password, confirmPassword])

  const handleBlur = useCallback((field: 'fullName' | 'phone' | 'password' | 'confirmPassword') => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  return {
    fullName,
    setFullName,
    phone,
    setPhone,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    isValid,
    handleBlur,
  }
}
