import { createContext, useContext, useState, type ReactNode } from 'react'
import AuthModal from '../components/auth/AuthModal'

type AuthModalContextType = {
  openModal: (view?: 'login' | 'register', callbackUrl?: string) => void
  closeModal: () => void
}

const AuthModalContext = createContext<AuthModalContextType | undefined>(undefined)

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [view, setView] = useState<'login' | 'register'>('login')
  const [callbackUrl, setCallbackUrl] = useState<string | undefined>()

  const openModal = (v: 'login' | 'register' = 'login', url?: string) => {
    setView(v)
    setCallbackUrl(url)
    setIsOpen(true)
  }

  const closeModal = () => setIsOpen(false)

  return (
    <AuthModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <AuthModal isOpen={isOpen} onClose={closeModal} initialView={view} callbackUrl={callbackUrl} />
    </AuthModalContext.Provider>
  )
}

export function useAuthModal() {
  const context = useContext(AuthModalContext)
  if (!context) throw new Error('useAuthModal must be used within an AuthModalProvider')
  return context
}
