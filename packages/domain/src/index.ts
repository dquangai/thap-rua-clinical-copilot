/** Core clinical concepts shared by UI, API and AI services. */
export type PatientStatus = 'WAITING' | 'IN_PROGRESS' | 'RESULT_READY' | 'COMPLETED' | 'CANCELLED'

export interface Patient {
  id: string
  medicalRecordNumber: string
  fullName: string
  dateOfBirth: string
  sex: 'FEMALE' | 'MALE' | 'OTHER'
  phone?: string
  address?: string
}

export interface Encounter {
  id: string
  patientId: string
  departmentId: string
  status: PatientStatus
  reason: string
  attendingClinicianId: string
  startedAt?: string
  endedAt?: string
}

export interface ClinicalNote {
  id: string
  encounterId: string
  type: 'PROGRESS' | 'ASSESSMENT' | 'PLAN' | 'DISCHARGE'
  content: string
  authoredBy: string
  authoredAt: string
  source: 'HUMAN' | 'AI_DRAFT'
}

export interface AiSuggestion {
  id: string
  encounterId: string
  kind: 'SUMMARY' | 'ICD10' | 'ORDER_SET' | 'RISK_FLAG' | 'PATIENT_MESSAGE'
  status: 'DRAFT' | 'ACCEPTED' | 'REJECTED'
  content: unknown
  model: string
  createdAt: string
}

export interface SimulatedVisit {
  visit_code: string
  visit_datetime: string
  reason: string
  department: string
  clinic: string
}

export interface SimulatedPatient {
  full_name: string
  age: number
  gender: 'Nữ' | 'Nam' | 'Khác'
  phone: string
  address: string
}

export interface SimulatedVitalSigns {
  mach_lan_phut: number | null
  nhiet_do_c: number | null
  huyet_ap_tam_thu_mmhg: number | null
  huyet_ap_tam_truong_mmhg: number | null
  nhip_tho_lan_phut: number | null
  chieu_cao_cm: number | null
  can_nang_kg: number | null
  bmi: number | null
  duong_huyet_mg_dl: number | null
}

export interface SimulatedClinicalNote {
  dien_bien: string
  huong_xu_tri: string
}

export interface SimulatedDiagnosis {
  icd10: string
  mo_ta: string
}

export interface SimulatedClinicalRecord {
  record_id: string
  visit: SimulatedVisit
  patient: SimulatedPatient
  vital_signs: SimulatedVitalSigns
  clinical_note: SimulatedClinicalNote
  diagnosis: SimulatedDiagnosis
  doctor: string
  signed_at: string
}
