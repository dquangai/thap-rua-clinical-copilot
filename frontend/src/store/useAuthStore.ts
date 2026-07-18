import { create } from 'zustand'
import {
  ApiError,
  getCurrentUserRequest,
  loginRequest,
  logoutRequest,
  refreshTokenRequest,
} from '../api/authApi'
import type { AuthSession, AuthStatus, AuthTokens, AuthUser } from '../types/auth'

const SESSION_STORAGE_KEY = 'thap-rua.auth.session.v1'
const REFRESH_EARLY_SECONDS = 60

export const DEMO_DOCTOR_EMAIL = 'myhanh@thaprua.vn'
export const DEMO_ACCOUNTS = [
  { id: 'demo-admin', email: 'admin@thaprua.vn', password: 'Admin@123', role: 'SUPER_ADMIN' as const, fullName: 'Quản trị viên', department: 'Quản trị hệ thống' },
  { id: 'demo-doctor-hanh', email: 'myhanh@thaprua.vn', password: 'Bacsi@123', role: 'DOCTOR' as const, fullName: 'BS. Lê Thị Mỹ Hạnh', department: 'Khoa Sản' },
  { id: 'demo-doctor-huong', email: 'thihuong@thaprua.vn', password: 'Bacsi@123', role: 'DOCTOR' as const, fullName: 'BS. Nguyễn Thị Hương', department: 'Khoa Sản' },
]

interface AuthStore {
  status: AuthStatus
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  isSubmitting: boolean
  isDemoMode: boolean
  error: string | null
  initialize: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  enterDemoMode: (email?: string) => void
  logout: () => Promise<void>
  refreshSession: () => Promise<void>
  clearError: () => void
}

let initializationPromise: Promise<void> | null = null

function normalizeTokens(tokens: AuthTokens): AuthTokens {
  return {
    ...tokens,
    expires_at: tokens.expires_at ?? Math.floor(Date.now() / 1000) + tokens.expires_in,
  }
}

function readStoredSession(): AuthSession | null {
  try {
    const rawSession = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!rawSession) return null

    const session = JSON.parse(rawSession) as AuthSession
    if (!session.tokens?.access_token || !session.tokens?.refresh_token || !session.user?.id) {
      localStorage.removeItem(SESSION_STORAGE_KEY)
      return null
    }
    return session
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY)
    return null
  }
}

function persistSession(tokens: AuthTokens, user: AuthUser) {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ tokens, user } satisfies AuthSession))
}

function clearStoredSession() {
  localStorage.removeItem(SESSION_STORAGE_KEY)
}

function messageFor(error: unknown, isLoginAttempt = false): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return isLoginAttempt ? 'Email hoặc mật khẩu không chính xác.' : 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    }
    if (error.status === 404) return 'API đăng nhập chưa sẵn sàng. Vui lòng khởi động lại backend.'
    if (error.status === 503) return 'Dịch vụ đăng nhập chưa được cấu hình.'
    return error.message
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}

function stateFrom(tokens: AuthTokens, user: AuthUser) {
  return {
    status: 'authenticated' as const,
    user,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
    isDemoMode: false,
    error: null,
  }
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  status: 'checking',
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  isSubmitting: false,
  isDemoMode: false,
  error: null,

  initialize: async () => {
    if (initializationPromise) return initializationPromise

    initializationPromise = (async () => {

      const storedSession = readStoredSession()
      if (!storedSession) {
        set({ status: 'anonymous', isDemoMode: false, error: null })
        return
      }

      try {
        let tokens = normalizeTokens(storedSession.tokens)
        const expiresSoon = (tokens.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + REFRESH_EARLY_SECONDS

        if (expiresSoon) {
          tokens = normalizeTokens(await refreshTokenRequest(tokens.refresh_token))
        }

        let user: AuthUser
        try {
          user = await getCurrentUserRequest(tokens.access_token)
        } catch (error) {
          if (!(error instanceof ApiError) || error.status !== 401 || expiresSoon) throw error
          tokens = normalizeTokens(await refreshTokenRequest(tokens.refresh_token))
          user = await getCurrentUserRequest(tokens.access_token)
        }

        persistSession(tokens, user)
        set(stateFrom(tokens, user))
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) clearStoredSession()
        set({
          status: 'anonymous',
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isDemoMode: false,
          error: messageFor(error),
        })
      }
    })()

    try {
      await initializationPromise
    } finally {
      initializationPromise = null
    }
  },

  login: async (email, password) => {
    clearStoredSession()
    set({ isSubmitting: true, isDemoMode: false, error: null })
    try {
      const tokens = normalizeTokens(await loginRequest(email.trim(), password))
      const user = await getCurrentUserRequest(tokens.access_token)
      persistSession(tokens, user)
      set({ ...stateFrom(tokens, user), isSubmitting: false })
    } catch (error) {
      set({ isSubmitting: false, error: messageFor(error, true) })
      throw error
    }
  },

  enterDemoMode: (email = DEMO_DOCTOR_EMAIL) => {
    const account = DEMO_ACCOUNTS.find((item) => item.email === email) ?? DEMO_ACCOUNTS[0]
    clearStoredSession()
    set({
      status: 'authenticated',
      user: { id: account.id, email: account.email, role: account.role, active: true, fullName: account.fullName, department: account.department },
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isSubmitting: false,
      isDemoMode: true,
      error: null,
    })
  },

  logout: async () => {
    const accessToken = get().accessToken
    set({ isSubmitting: true })
    try {
      if (accessToken) await logoutRequest(accessToken)
    } catch {
      // Local logout must still complete if the token has expired or the API is unavailable.
    } finally {
      clearStoredSession()
      set({
        status: 'anonymous',
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        isSubmitting: false,
        isDemoMode: false,
        error: null,
      })
    }
  },

  refreshSession: async () => {
    const { refreshToken, user } = get()
    if (!refreshToken || !user) return

    try {
      const tokens = normalizeTokens(await refreshTokenRequest(refreshToken))
      persistSession(tokens, user)
      set(stateFrom(tokens, user))
    } catch {
      clearStoredSession()
      set({
        status: 'anonymous',
        user: null,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        isDemoMode: false,
        error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      })
    }
  },

  clearError: () => set({ error: null }),
}))
