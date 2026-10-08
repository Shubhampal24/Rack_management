// src/context/AuthContext.jsx
import * as React from 'react'
import { authService } from '@/lib/api/apiService'

const AuthContext = React.createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = React.useState(() => {
    try {
      const stored = localStorage.getItem('hopshop_user')
      return stored ? JSON.parse(stored) : null
    } catch { return null }
  })
  const [loading, setLoading] = React.useState(false)
  const [error, setError]     = React.useState(null)

  // Listen for global auth:logout event (fired by apiClient on 401)
  React.useEffect(() => {
    const handler = () => {
      setUser(null)
      localStorage.removeItem('hopshop_token')
      localStorage.removeItem('hopshop_user')
    }
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const login = async (userId, pin) => {
    setLoading(true)
    setError(null)
    try {
      const { token, user: userData } = await authService.login(userId, pin)
      localStorage.setItem('hopshop_token', token)
      localStorage.setItem('hopshop_user', JSON.stringify(userData))
      setUser(userData)
      return { ok: true }
    } catch (err) {
      setError(err.message)
      return { ok: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    try { await authService.logout() } catch {}
    localStorage.removeItem('hopshop_token')
    localStorage.removeItem('hopshop_user')
    setUser(null)
    setError(null)
  }

  const isAuthenticated = !!user && !!localStorage.getItem('hopshop_token')

  return (
    <AuthContext.Provider value={{ user, loading, error, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
