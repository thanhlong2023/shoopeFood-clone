import { useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { EyeIcon, EyeOffIcon } from './Icons'

export interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  icon?: ReactNode
  error?: string
}

export default function FormInput({ label, icon, error, type = 'text', className = '', ...props }: FormInputProps) {
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type
  const hasError = Boolean(error)

  return (
    <div className={`form-input-wrapper ${className}`}>
      <label className="form-input-label">{label}</label>
      <div className={`form-input-container ${hasError ? 'has-error' : ''}`}>
        {icon && <span className="form-input-icon">{icon}</span>}
        
        <input
          type={inputType}
          className={`form-input-field ${icon ? 'with-icon' : ''} ${isPassword ? 'with-toggle' : ''}`}
          {...props}
        />
        
        {isPassword && (
          <button
            type="button"
            className="form-input-toggle"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            title={showPassword ? 'An mat khau' : 'Hien mat khau'}
          >
            {showPassword ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <p className="form-input-error">{error}</p>}
    </div>
  )
}
