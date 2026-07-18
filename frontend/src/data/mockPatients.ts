import type { PatientRecord, StatusSummary } from '../types/clinical'
import { simPatients } from './simPatients'

const mainPatient: PatientRecord = {
  medicalId: '2001175594',
  queueNumber: '53005',
  fullName: 'NGUYỄN THỊ HỒNG NGỌC',
  birthYear: 1993,
  ageText: '33 tuổi',
  gender: 'Nữ',
  insuranceNumber: 'DN4807215005924',
  patientType: 'DN thành lập, hoạt động theo Luật Doanh nghiệp',
  discountPercent: 80,
  insuranceDaysRemaining: 162,
  medicineDaysRemaining: 6,
  balanceVnd: 0,
  phone: '0349779842',
  address: 'Ấp Long Thịnh, Xã Long Thuận, Tỉnh Tây Ninh',
  previousVisitDate: '23/06/2026',
  status: 'examining',
  visitDateTime: '17/07/2026 03:28',
  reason: 'KHÁM THAI',
  department: 'Khoa Sản',
  clinic: 'Phòng khám chuyên khoa Phụ Sản',
  vitalSigns: {
    pulse: 80,
    respiratoryRate: 20,
    systolicBloodPressure: 120,
    diastolicBloodPressure: 80,
    spo2: 0,
    bloodGlucose: 0,
    temperature: 37,
    height: 0,
    weight: 67,
    waist: 0,
    bmi: 0,
    bsa: 0,
    hba1c: 0,
    pregnancyWeeks: 38,
    breastfeeding: false,
  },
  clinicalProgress: `PARA: 1001/ ST 2014 2600 g
Dự sanh ngày: 25/07/2026 theo siêu âm thai # 12 tuần (bn khai)
Tiền căn: Nội - Ngoại khoa: Bình thường
Sản khoa: Bình thường

QUÁ TRÌNH KHÁM THAI:
Tiêm ngừa: vắc 1 mũi
Xét nghiệm:
Sàng lọc bé: NCT`,
  treatmentPlan: `Tái khám lại sau 4 ngày
- Siêu âm thai
- NST
Hoặc tái khám lại khi có dấu hiệu bất thường như: Sốt, đau bụng, ra nước ối, ra huyết âm đạo, thai máy yếu.`,
  counselingRecord: '',
  doctor: 'BS. Nguyễn Thị Hương',
  nurseOne: 'NHS. Trương Ngọc Quí',
  nurseTwo: 'Chọn...',
  diagnoses: {
    primaryCode: 'Z35',
    primaryDescription: 'Theo dõi thai phụ có nguy cơ cao',
    secondary: '',
    comorbidity: '',
    summary: 'Z35 - Thai 38 tuần 6 ngày/ ĐTĐ thai kỳ',
  },
}

export const mockPatients: PatientRecord[] = [
  mainPatient,
  {
    ...mainPatient,
    medicalId: '2001180193',
    queueNumber: '53026',
    fullName: 'TRẦN THỊ BÍCH CHÂU',
    birthYear: 1996,
    ageText: '30 tuổi',
    phone: '0908123456',
    insuranceNumber: 'DN4807215006018',
    status: 'waiting',
  },
  {
    ...mainPatient,
    medicalId: '2001194971',
    queueNumber: '53041',
    fullName: 'BÙI THỊ NGÂN HÀ',
    birthYear: 2005,
    ageText: '21 tuổi',
    phone: '0913234567',
    insuranceNumber: 'HS4807215006144',
    status: 'has-results',
  },
  ...simPatients,
]

const statusLabels: Array<[StatusSummary['key'], string]> = [
  ['waiting', 'Chờ khám'],
  ['examining', 'Đang khám'],
  ['has-results', 'Đã có KQCLS'],
  ['completed', 'Đã khám'],
]

export const statusSummary: StatusSummary[] = statusLabels.map(([key, label]) => ({
  key,
  label,
  count: mockPatients.filter((patient) => patient.status === key).length,
}))
