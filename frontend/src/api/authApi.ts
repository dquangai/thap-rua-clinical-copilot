import type { AuthTokens, AuthUser } from '../types/auth'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
const AUTH_URL = `${API_BASE_URL}/auth`

type ApiErrorPayload = {
  detail?: string | Array<{ msg?: string }>
  message?: string
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload
    if (typeof payload.detail === 'string') return payload.detail
    if (Array.isArray(payload.detail)) {
      const messages = payload.detail.map((item) => item.msg).filter(Boolean)
      if (messages.length) return messages.join('. ')
    }
    if (payload.message) return payload.message
  } catch {
    // The API may return an empty or non-JSON error response.
  }

  return `Yêu cầu không thành công (${response.status})`
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${AUTH_URL}${path}`, init)
  } catch {
    throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra backend và thử lại.', 0)
  }

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export function loginRequest(email: string, password: string) {
  return request<AuthTokens>('/login', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })
}

export function refreshTokenRequest(refreshToken: string) {
  return request<AuthTokens>('/refresh', {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
}

export function getCurrentUserRequest(accessToken: string) {
  return request<AuthUser>('/me', {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}

export function logoutRequest(accessToken: string) {
  return request<void>('/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
}
