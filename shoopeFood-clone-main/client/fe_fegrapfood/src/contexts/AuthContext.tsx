import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '../constants/auth'
import { getCurrentUser, login as loginRequest } from '../services/api/auth'
import type { AuthUser, LoginPayload, UserRole } from '../types'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<AuthUser | null>
  hasRole: (roles: UserRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readStoredUser() {
  const storedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY)

  if (!storedUser) {
    return null
  }

  try {
    return JSON.parse(storedUser) as AuthUser
  } catch {
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    return null
  }
}

type AuthProviderProps = {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [token, setToken] = useState(() => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY))
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser())

  async function login(payload: LoginPayload) {
    const session = await loginRequest(payload)
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token)
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user))
    setToken(session.token)
    setUser(session.user)
    return session.user
  }

  function logout() {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    localStorage.removeItem(AUTH_USER_STORAGE_KEY)
    setToken(null)
    setUser(null)
  }

  async function refreshUser() {
    if (!localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) {
      logout()
      return null
    }

    try {
      const nextUser = await getCurrentUser()
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(nextUser))
      setUser(nextUser)
      return nextUser
    } catch {
      logout()
      return null
    }
  }

  function hasRole(roles: UserRole[]) {
    if (!user) {
      return false
    }

    return roles.includes(user.role)
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      refreshUser,
      hasRole,
    }),
    [token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider')
  }

  return value
}
