import type { PatientRecord, VitalSigns } from '../types/clinical'

// Hồ sơ demo không còn bundle JSON vào client; dữ liệu được backend phục vụ
// từ MongoDB qua GET /api/v1/sim-records (xem api/simRecordsApi.ts). File này
// chỉ giữ phần ánh xạ SimRecord -> PatientRecord cho UI.

export interface SimRecord {
  record_id: string
  visit: {
    visit_code: string
    visit_datetime: string
    reason: string
    department: string
    clinic: string
  }
  patient: {
    full_name: string
    age: number
    gender: string
    phone: string
    address: string
  }
  vital_signs: {
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
  clinical_note: {
    dien_bien: string
    huong_xu_tri: string
    tu_van?: string
  }
  diagnosis: {
    icd10: string
    mo_ta: string
  }
  doctor: string
  signed_at: string
}

// Ghi đè hiển thị cho từng hồ sơ (số thứ tự, trạng thái hàng đợi, BHYT...)
// được lưu kèm document trong MongoDB.
export interface PatientUiOverrides extends Partial<Omit<PatientRecord, 'vitalSigns' | 'diagnoses'>> {
  vitalSigns?: Partial<VitalSigns>
  diagnoses?: Partial<PatientRecord['diagnoses']>
}

export interface SimRecordDocument {
  seq?: number
  record: SimRecord
  ui?: PatientUiOverrides
}

function formatVisitDateTime(iso: string): string {
  const [datePart, timePart = ''] = iso.split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`.trim()
}

function parsePregnancyWeeks(description: string): number | null {
  const match = /(\d{1,2})\s*TU[ẦA]N/i.exec(description)
  return match ? Number(match[1]) : null
}

function toPatientRecord(record: SimRecord): PatientRecord {
  const visitYear = Number(record.visit.visit_datetime.slice(0, 4)) || new Date().getFullYear()
  const vitalSigns = record.vital_signs
  const gender = record.patient.gender === 'Nam' ? 'Nam' : record.patient.gender === 'Nữ' ? 'Nữ' : 'Khác'
  return {
    medicalId: record.record_id,
    queueNumber: '',
    fullName: record.patient.full_name,
    birthYear: visitYear - record.patient.age,
    ageText: `${record.patient.age} tuổi`,
    gender,
    insuranceNumber: '',
    patientType: 'Thu phí',
    discountPercent: 0,
    insuranceDaysRemaining: 0,
    medicineDaysRemaining: 0,
    balanceVnd: 0,
    phone: record.patient.phone,
    address: record.patient.address,
    previousVisitDate: '',
    status: 'waiting',
    visitDateTime: formatVisitDateTime(record.visit.visit_datetime),
    reason: record.visit.reason,
    department: record.visit.department,
    clinic: record.visit.clinic,
    vitalSigns: {
      pulse: vitalSigns.mach_lan_phut,
      respiratoryRate: vitalSigns.nhip_tho_lan_phut,
      systolicBloodPressure: vitalSigns.huyet_ap_tam_thu_mmhg,
      diastolicBloodPressure: vitalSigns.huyet_ap_tam_truong_mmhg,
      spo2: null,
      bloodGlucose: vitalSigns.duong_huyet_mg_dl,
      temperature: vitalSigns.nhiet_do_c,
      height: vitalSigns.chieu_cao_cm,
      weight: vitalSigns.can_nang_kg,
      waist: null,
      bmi: vitalSigns.bmi,
      bsa: null,
      hba1c: null,
      pregnancyWeeks: parsePregnancyWeeks(record.diagnosis.mo_ta),
      breastfeeding: false,
    },
    clinicalProgress: record.clinical_note.dien_bien,
    treatmentPlan: record.clinical_note.huong_xu_tri,
    // Biên bản tư vấn luôn bắt đầu trống; bác sĩ tạo bằng nút trong card.
    counselingRecord: '',
    doctor: record.doctor,
    nurseOne: 'NHS. Trương Ngọc Quí',
    nurseTwo: 'Chọn...',
    diagnoses: {
      primaryCode: record.diagnosis.icd10,
      primaryDescription: record.diagnosis.mo_ta,
      secondary: '',
      comorbidity: '',
      summary: `${record.diagnosis.icd10} - ${record.diagnosis.mo_ta}`,
    },
  }
}

export function mapSimDocument(document: SimRecordDocument): PatientRecord {
  const base = toPatientRecord(document.record)
  const { vitalSigns, diagnoses, ...rest } = document.ui ?? {}
  return {
    ...base,
    ...rest,
    vitalSigns: { ...base.vitalSigns, ...vitalSigns },
    diagnoses: { ...base.diagnoses, ...diagnoses },
  }
}
