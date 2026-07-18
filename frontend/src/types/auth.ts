export interface AuthTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  expires_at: number | null
}

export interface AuthUser {
  id: string
  email: string | null
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR'
  active: boolean
  fullName?: string
  department?: string
}

export interface AuthSession {
  tokens: AuthTokens
  user: AuthUser
}

export type AuthStatus = 'checking' | 'anonymous' | 'authenticated'
