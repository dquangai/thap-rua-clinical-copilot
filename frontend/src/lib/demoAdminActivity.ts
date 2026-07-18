import type { AuditEvent, UsageEvent } from '../api/adminApi'

const USAGE_KEY = 'thap-rua.demo.admin.usage.v1'
const AUDIT_KEY = 'thap-rua.demo.admin.audit.v1'
const RECORDS_KEY = 'thap-rua.demo.admin.records.v1'
const BATCH_RESULTS_KEY = 'thap-rua.demo.admin.batch-results.v1'

export type DemoManagedRecord = { id: string; patient: string; doctor: string; deleted: boolean; deletionReason?: string }
const DEFAULT_RECORDS: DemoManagedRecord[] = [
  { id: '2001175594', patient: 'NGUYỄN THỊ HỒNG NGỌC', doctor: 'BS. Lê Thị Mỹ Hạnh', deleted: false },
  { id: '2001180193', patient: 'TRẦN THỊ BÍCH CHÂU', doctor: 'BS. Nguyễn Thị Hương', deleted: false },
  { id: '2001194971', patient: 'BÙI THỊ NGÂN HÀ', doctor: 'BS. Lê Thị Mỹ Hạnh', deleted: false },
]

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback }
  catch { return fallback }
}

function write<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('thap-rua:demo-admin-activity'))
}

export type BatchAuditResult = { recordId: string; patientName: string; doctor: string; checkedAt: string; cacheStatus: 'hit' | 'miss'; conclusion: 'DAT' | 'KHONG_DAT' | 'ERROR'; issueCount: number; message?: string }

export const getDemoUsage = () => read<UsageEvent[]>(USAGE_KEY, []).map((item) => ({
  ...item,
  api_calls: item.api_calls ?? (item.cache_status === 'hit' || item.status === 'cache_hit' ? 0 : (item.total_tokens > 0 || item.cost_usd > 0 ? 1 : 0)),
  cache_status: item.cache_status ?? (item.status === 'cache_hit' ? 'hit' : 'miss'),
}))
export const getDemoAudit = () => {
  const seen = new Set<string>()
  return read<AuditEvent[]>(AUDIT_KEY, []).filter((item) => {
    const signature = `${item.action}|${item.entity_type}|${item.entity_id}|${item.reason}|${item.occurred_at}`
    if (seen.has(signature)) return false
    seen.add(signature)
    return true
  }).map((item, index) => ({ ...item, id: new Date(item.occurred_at).getTime() * 1000 + index }))
}
export const getDemoRecords = () => read<DemoManagedRecord[]>(RECORDS_KEY, DEFAULT_RECORDS)
export const getBatchAuditResults = () => read<BatchAuditResult[]>(BATCH_RESULTS_KEY, [])
export const getDemoRecordStats = () => { const records = getDemoRecords(); return { total: records.length, deleted: records.filter((item) => item.deleted).length } }

export function recordDemoUsage(event: Omit<UsageEvent, 'id' | 'occurred_at'>) {
  write(USAGE_KEY, [{ ...event, id: Date.now(), occurred_at: new Date().toISOString() }, ...getDemoUsage()].slice(0, 200))
}

export function recordDemoAudit(event: Omit<AuditEvent, 'id' | 'occurred_at'>) {
  write(AUDIT_KEY, [{ ...event, id: Date.now() * 1000 + Math.floor(Math.random() * 1000), occurred_at: new Date().toISOString() }, ...getDemoAudit()].slice(0, 200))
}

export function setDemoRecordDeleted(id: string, deleted: boolean, reason: string) {
  const records = getDemoRecords().map((item) => item.id === id ? { ...item, deleted, deletionReason: deleted ? reason : undefined } : item)
  write(RECORDS_KEY, records)
  recordDemoAudit({ action: deleted ? 'DELETE' : 'RESTORE', entity_type: 'clinical_record', entity_id: id, reason })
}

export function storeBatchAuditResults(results: BatchAuditResult[]) {
  write(BATCH_RESULTS_KEY, results)
  recordDemoAudit({ action: 'BATCH_AI_AUDIT', entity_type: 'clinical_record', entity_id: 'all-latest', reason: `Admin kiểm tra ${results.length} phiên bản hồ sơ mới nhất; ${results.filter((item) => item.conclusion === 'KHONG_DAT').length} hồ sơ có sai sót` })
}
