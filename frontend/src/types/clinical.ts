export type PatientStatus = 'waiting' | 'examining' | 'has-results' | 'completed'

export interface VitalSigns {
  pulse: number | null
  respiratoryRate: number | null
  systolicBloodPressure: number | null
  diastolicBloodPressure: number | null
  spo2: number | null
  bloodGlucose: number | null
  temperature: number | null
  height: number | null
  weight: number | null
  waist: number | null
  bmi: number | null
  bsa: number | null
  hba1c: number | null
  pregnancyWeeks: number | null
  breastfeeding: boolean
}

export interface PatientRecord {
  medicalId: string
  queueNumber: string
  fullName: string
  birthYear: number
  ageText: string
  gender: 'Nam' | 'Nữ' | 'Khác'
  insuranceNumber: string
  patientType: string
  discountPercent: number
  insuranceDaysRemaining: number
  medicineDaysRemaining: number
  balanceVnd: number
  phone: string
  address: string
  previousVisitDate: string
  status: PatientStatus
  visitDateTime: string
  reason: string
  department: string
  clinic: string
  vitalSigns: VitalSigns
  clinicalProgress: string
  treatmentPlan: string
  doctor: string
  nurseOne: string
  nurseTwo: string
  diagnoses: {
    primaryCode: string
    primaryDescription: string
    secondary: string
    comorbidity: string
    summary: string
  }
}

export interface StatusSummary {
  key: PatientStatus
  label: string
  count: number
}
