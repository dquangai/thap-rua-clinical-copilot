import { create } from 'zustand'
import type { PatientRecord, StatusSummary } from '../types/clinical'
import { fetchSimRecords } from '../api/simRecordsApi'
import { mapSimDocument } from '../data/simPatients'

interface PatientsState {
  patients: PatientRecord[]
  loading: boolean
  loaded: boolean
  error: string | null
  load: () => Promise<void>
}

export const usePatientsStore = create<PatientsState>((set, get) => ({
  patients: [],
  loading: false,
  loaded: false,
  error: null,
  load: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const documents = await fetchSimRecords()
      set({ patients: documents.map(mapSimDocument), loaded: true, loading: false })
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Không tải được danh sách bệnh nhân',
        loading: false,
      })
    }
  },
}))

const statusLabels: Array<[StatusSummary['key'], string]> = [
  ['waiting', 'Chờ khám'],
  ['examining', 'Đang khám'],
  ['has-results', 'Đã có KQCLS'],
  ['completed', 'Đã khám'],
]

export function buildStatusSummary(patients: PatientRecord[]): StatusSummary[] {
  return statusLabels.map(([key, label]) => ({
    key,
    label,
    count: patients.filter((patient) => patient.status === key).length,
  }))
}
