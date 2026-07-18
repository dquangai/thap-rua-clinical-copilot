import type { PatientRecord, PatientStatus } from '../types/clinical'
import raw1 from '../../../data/sim_kham1.json'
import raw2 from '../../../data/sim_kham2.json'
import raw3 from '../../../data/sim_kham3.json'
import raw4 from '../../../data/sim_kham4.json'
import raw5 from '../../../data/sim_kham5.json'
import raw6 from '../../../data/sim_kham6.json'

interface SimRecord {
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

const simRecords = [raw1, raw2, raw3, raw4, raw5, raw6] as unknown as SimRecord[]

// Trạng thái hàng đợi minh họa cho từng ca; dữ liệu JSON không có trường này.
const simStatuses: PatientStatus[] = ['waiting', 'waiting', 'waiting', 'has-results', 'examining', 'completed']

function formatVisitDateTime(iso: string): string {
  const [datePart, timePart = ''] = iso.split('T')
  const [year, month, day] = datePart.split('-')
  return `${day}/${month}/${year} ${timePart.slice(0, 5)}`.trim()
}

function parsePregnancyWeeks(description: string): number | null {
  const match = /(\d{1,2})\s*TU[ẦA]N/i.exec(description)
  return match ? Number(match[1]) : null
}

function toPatientRecord(record: SimRecord, index: number): PatientRecord {
  const visitYear = Number(record.visit.visit_datetime.slice(0, 4)) || new Date().getFullYear()
  const vitalSigns = record.vital_signs
  const gender = record.patient.gender === 'Nam' ? 'Nam' : record.patient.gender === 'Nữ' ? 'Nữ' : 'Khác'
  return {
    medicalId: record.record_id,
    queueNumber: String(53100 + index + 1),
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
    status: simStatuses[index] ?? 'waiting',
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

export const simPatients: PatientRecord[] = simRecords.map(toPatientRecord)
