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

