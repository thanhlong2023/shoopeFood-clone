import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } from '../constants/auth'
import { activateRole as activateRoleRequest, getCurrentUser, login as loginRequest } from '../services/api/auth'
import type { AuthUser, LoginPayload, UserRole } from '../types'

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<AuthUser>
  register: (payload: any) => Promise<AuthUser>
  logout: () => void
  refreshUser: () => Promise<AuthUser | null>
  activateRole: (role: UserRole) => Promise<AuthUser>
  hasRole: (roles: UserRole[]) => boolean
  hasAssignedRole: (roles: UserRole[]) => boolean
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

  async function register(payload: any) {
    const { registerCustomer } = await import('../services/api/auth')
    const session = await registerCustomer(payload)
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

  async function activateRole(role: UserRole) {
    const session = await activateRoleRequest(role)
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, session.token)
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(session.user))
    setToken(session.token)
    setUser(session.user)
    return session.user
  }

  function hasRole(roles: UserRole[]) {
    if (!user) {
      return false
    }

    return roles.includes(user.role)
  }

  function hasAssignedRole(roles: UserRole[]) {
    if (!user) {
      return false
    }

    return (user.roles || []).some((item) => roles.includes(item))
  }

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      login,
      register,
      logout,
      refreshUser,
      activateRole,
      hasRole,
      hasAssignedRole,
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
