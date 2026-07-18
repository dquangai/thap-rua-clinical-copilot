import { ApiError } from './authApi'
import { API_BASE_URL } from './config'

const BASE = `${API_BASE_URL}/admin`

async function request<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    throw new ApiError(payload.detail ?? `Yêu cầu thất bại (${response.status})`, response.status)
  }
  return response.json()
}

export type AdminOverview = {
  users: { total: number; active: number }
  records: { total: number; deleted: number }
  api: { calls: number; errors: number; cost_usd: number; avg_latency_ms: number; p50_latency_ms: number; p95_latency_ms: number; p99_latency_ms: number; total_tokens: number }
}
export type AdminUser = { id: string; full_name: string; department_id: string | null; role: string; active: boolean; created_at: string; departments?: { name: string } | null }
export type UsageEvent = { id: number; endpoint: string; status: string; status_code: number; model: string | null; latency_ms: number; total_tokens: number; cost_usd: number; api_calls: number; cache_status: 'hit' | 'miss' | 'bypass'; occurred_at: string }
export type AuditEvent = { id: number; action: string; entity_type: string; entity_id: string; reason: string; occurred_at: string }
export type AdminRecord = { id: string; status: string; deleted_at: string | null; deletion_reason: string | null; patient?: { medical_record_number: string; full_name: string }; doctor?: { full_name: string } | null }

export const getAdminOverview = (token: string | null) => request<AdminOverview>('/overview', token)
export const getAdminUsers = (token: string | null) => request<AdminUser[]>('/users', token)
export const getUsage = (token: string | null) => request<UsageEvent[]>('/api-usage?limit=50', token)
export const getAudit = (token: string | null) => request<AuditEvent[]>('/audit-events?limit=50', token)
export const getAdminRecords = (token: string | null) => request<AdminRecord[]>('/records?limit=100', token)
export const createAdminUser = (token: string | null, data: object) => request<AdminUser>('/users', token, { method: 'POST', body: JSON.stringify(data) })
export const updateAdminUser = (token: string | null, id: string, data: object) => request<AdminUser>(`/users/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
