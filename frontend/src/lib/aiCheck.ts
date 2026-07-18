import type { PatientRecord } from '../types/clinical'
import type { AiCheckResponse } from '../types/aiCheck'
import { API_BASE_URL } from '../api/config'
import { recordDemoAudit, recordDemoUsage } from './demoAdminActivity'

// Mock data dùng 0 cho chỉ số chưa đo; checker cần null để phân biệt thiếu dữ liệu.
const measured = (value: number | null): number | null => (value ? value : null)

export interface CheckerNotes {
  clinicalProgress: string
  treatmentPlan: string
  diagnosisSummary: string
  counselingRecord: string
}

const normalizeDiagnosisText = (value: string) => value
  .toLocaleUpperCase('vi-VN')
  .replace(/[–—-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const isDuplicateDiagnosis = (note: string, code: string, description: string) => {
  const normalizedNote = normalizeDiagnosisText(note)
  const normalizedDescription = normalizeDiagnosisText(description)
  const normalizedFull = normalizeDiagnosisText(`${code} ${description}`)
  return normalizedNote === normalizedDescription || normalizedNote === normalizedFull
}

// Chỉ gửi minimum-necessary theo allowlist của backend/ai/clinical_checker/privacy.py:
// không gửi tên, SĐT, địa chỉ, mã BN, BHYT.
export function buildCheckerRecord(patient: PatientRecord, notes: CheckerNotes) {
  const vitalSigns = patient.vitalSigns
  const diagnosisNote = isDuplicateDiagnosis(
    notes.diagnosisSummary,
    patient.diagnoses.primaryCode,
    patient.diagnoses.primaryDescription,
  ) ? '' : notes.diagnosisSummary
  const descriptionParts = [patient.diagnoses.primaryDescription, diagnosisNote].filter(Boolean)
  let moTa = descriptionParts.join(' — ')
  if (!/\d\s*tu[ầa]n/i.test(moTa) && vitalSigns.pregnancyWeeks !== null) {
    moTa = `${moTa}${moTa ? ' — ' : ''}THAI ${vitalSigns.pregnancyWeeks} TUẦN`
  }
  return {
    visit: {
      reason: patient.reason,
      department: patient.department,
      clinic: patient.clinic,
    },
    patient: {
      age: new Date().getFullYear() - patient.birthYear,
      gender: patient.gender,
    },
    vital_signs: {
      mach_lan_phut: measured(vitalSigns.pulse),
      nhip_tho_lan_phut: measured(vitalSigns.respiratoryRate),
      huyet_ap_tam_thu_mmhg: measured(vitalSigns.systolicBloodPressure),
      huyet_ap_tam_truong_mmhg: measured(vitalSigns.diastolicBloodPressure),
      spo2_pct: measured(vitalSigns.spo2),
      duong_huyet_mg_dl: measured(vitalSigns.bloodGlucose),
      nhiet_do_c: measured(vitalSigns.temperature),
      chieu_cao_cm: measured(vitalSigns.height),
      can_nang_kg: measured(vitalSigns.weight),
      bmi: measured(vitalSigns.bmi),
      hba1c_pct: measured(vitalSigns.hba1c),
    },
    clinical_note: {
      dien_bien: notes.clinicalProgress,
      huong_xu_tri: notes.treatmentPlan,
      tu_van: notes.counselingRecord,
    },
    diagnosis: {
      icd10: patient.diagnoses.primaryCode,
      mo_ta: moTa,
    },
  }
}

async function postAi<T>(path: string, record: ReturnType<typeof buildCheckerRecord>, options: Record<string, unknown> = {}): Promise<T> {
  const started = performance.now()
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record, ...options }),
    })
  } catch {
    recordDemoUsage({ endpoint: `/api/v1${path}`, status: 'network_error', status_code: 0, model: null, latency_ms: 0, total_tokens: 0, cost_usd: 0, api_calls: 0, cache_status: 'bypass' })
    throw new Error('Không kết nối được API backend. Kiểm tra kết nối mạng hoặc cấu hình CORS.')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body.detail === 'string' ? body.detail : `Lỗi ${response.status}`
    recordDemoUsage({ endpoint: `/api/v1${path}`, status: 'error', status_code: response.status, model: null, latency_ms: 0, total_tokens: 0, cost_usd: 0, api_calls: 0, cache_status: 'bypass' })
    throw new Error(detail)
  }
  const body = await response.json() as T & { meta?: { status?: string; model?: string; latency_ms?: number; total_tokens?: number; estimated_cost_usd?: number; api_calls?: number; cache_status?: 'hit' | 'miss' | 'bypass' } }
  const apiCalls = body.meta?.api_calls ?? 0
  const cacheStatus = body.meta?.cache_status ?? 'bypass'
  recordDemoUsage({ endpoint: `/api/v1${path}`, status: body.meta?.status ?? 'success', status_code: response.status, model: body.meta?.model ?? null, latency_ms: apiCalls > 0 && cacheStatus !== 'hit' ? body.meta?.latency_ms ?? Math.round(performance.now() - started) : 0, total_tokens: apiCalls > 0 ? body.meta?.total_tokens ?? 0 : 0, cost_usd: apiCalls > 0 ? body.meta?.estimated_cost_usd ?? 0 : 0, api_calls: apiCalls, cache_status: cacheStatus })
  return body
}

export interface CheckClinicalRecordOptions {
  includeCriteria?: string[]
  excludeCriteria?: string[]
  recordId?: string
  recordVersion?: number
}

export async function checkClinicalRecord(record: ReturnType<typeof buildCheckerRecord>, options: CheckClinicalRecordOptions = {}): Promise<AiCheckResponse> {
  const response = await postAi<AiCheckResponse>('/ai/check-record', record, {
    include_criteria: options.includeCriteria,
    exclude_criteria: options.excludeCriteria ?? [],
    record_id: options.recordId,
    record_version: options.recordVersion,
  })
  recordDemoAudit({ action: 'AI_CHECK', entity_type: 'clinical_record', entity_id: options.recordId ?? 'current-record', reason: 'Bác sĩ kiểm tra tính đầy đủ của hồ sơ bằng AI' })
  return response
}

export async function generateCounseling(record: ReturnType<typeof buildCheckerRecord>): Promise<string> {
  const body = await postAi<{ tu_van: string }>('/ai/generate-counseling', record)
  return body.tu_van
}
