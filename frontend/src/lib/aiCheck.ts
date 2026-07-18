import type { PatientRecord } from '../types/clinical'
import type { AiCheckResponse } from '../types/aiCheck'

// Cùng chuẩn với authApi: VITE_API_BASE_URL đã bao gồm /api/v1; mặc định đi qua Vite proxy.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

// Mock data dùng 0 cho chỉ số chưa đo; checker cần null để phân biệt thiếu dữ liệu.
const measured = (value: number | null): number | null => (value ? value : null)

export interface CheckerNotes {
  clinicalProgress: string
  treatmentPlan: string
  diagnosisSummary: string
  counselingRecord: string
}

// Chỉ gửi minimum-necessary theo allowlist của backend/ai/clinical_checker/privacy.py:
// không gửi tên, SĐT, địa chỉ, mã BN, BHYT.
export function buildCheckerRecord(patient: PatientRecord, notes: CheckerNotes) {
  const vitalSigns = patient.vitalSigns
  const descriptionParts = [patient.diagnoses.primaryDescription, notes.diagnosisSummary].filter(Boolean)
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

export async function checkClinicalRecord(record: ReturnType<typeof buildCheckerRecord>): Promise<AiCheckResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/ai/check-record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ record }),
    })
  } catch {
    throw new Error('Không kết nối được backend. Hãy chạy: npm run dev:backend')
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body.detail === 'string' ? body.detail : `Lỗi ${response.status}`
    throw new Error(detail)
  }
  return response.json()
}
