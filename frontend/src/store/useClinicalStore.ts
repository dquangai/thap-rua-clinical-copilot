import { create } from 'zustand'
import type { PatientStatus } from '../types/clinical'

interface ClinicalStore {
  selectedMedicalId: string
  searchTerm: string
  statusFilter: PatientStatus | null
  sidebarCollapsed: boolean
  patientPanelCollapsed: boolean
  toastMessage: string
  selectPatient: (medicalId: string) => void
  setSearchTerm: (value: string) => void
  setStatusFilter: (status: PatientStatus | null) => void
  toggleSidebar: () => void
  togglePatientPanel: () => void
  notify: (message: string) => void
  clearToast: () => void
}

export const useClinicalStore = create<ClinicalStore>((set) => ({
  selectedMedicalId: '2001175594',
  searchTerm: '',
  statusFilter: null,
  sidebarCollapsed: false,
  patientPanelCollapsed: false,
  toastMessage: '',
  selectPatient: (selectedMedicalId) => set({ selectedMedicalId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  togglePatientPanel: () => set((state) => ({ patientPanelCollapsed: !state.patientPanelCollapsed })),
  notify: (toastMessage) => set({ toastMessage }),
  clearToast: () => set({ toastMessage: '' }),
}))

