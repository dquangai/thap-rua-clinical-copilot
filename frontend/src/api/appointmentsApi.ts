import { API_BASE_URL } from './config'

export type AppointmentCandidate = {
  date: string
  weekday: string
  load: number
  capacity: number
  label: 'thua' | 'vua' | 'dong' | 'day'
  recommended: boolean
}

export type SuggestFollowUpResponse = {
  interval_days: number
  interval_source: 'treatment_plan' | 'pregnancy_weeks' | 'default'
  ideal_date: string
  capacity: number
  candidates: AppointmentCandidate[]
}

export type BookFollowUpResponse = {
  appointment: { id: string; medical_id: string; date: string }
  day_load: number
  capacity: number
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Không kết nối được backend. Hãy chạy: npm run dev:backend')
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : `Lỗi ${response.status}`
    throw new Error(detail)
  }
  return response.json()
}

export function suggestFollowUp(input: { treatmentPlan: string; pregnancyWeeks: number | null }) {
  return post<SuggestFollowUpResponse>('/appointments/suggest', {
    treatment_plan: input.treatmentPlan,
    pregnancy_weeks: input.pregnancyWeeks,
  })
}

export function bookFollowUp(input: { medicalId: string; patientName: string; date: string; note?: string }) {
  return post<BookFollowUpResponse>('/appointments', {
    medical_id: input.medicalId,
    patient_name: input.patientName,
    date: input.date,
    note: input.note ?? '',
  })
}
