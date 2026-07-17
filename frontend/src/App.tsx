import { useEffect, type ReactNode } from 'react'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity,
  Ban,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CircleHelp,
  ClipboardList,
  ClipboardPlus,
  Database,
  Eraser,
  FileClock,
  FileHeart,
  FileText,
  FlaskConical,
  HeartPulse,
  History,
  House,
  Info,
  ListRestart,
  LogOut,
  Megaphone,
  Menu,
  Pill,
  PanelLeftClose,
  PanelLeftOpen,
  Save,
  Search,
  Settings,
  Stethoscope,
  Syringe,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { mockPatients, statusSummary } from './data/mockPatients'
import LoginPage, { AuthLoadingScreen } from './pages/LoginPage'
import { useAuthStore } from './store/useAuthStore'
import { useClinicalStore } from './store/useClinicalStore'
import type { PatientRecord, PatientStatus } from './types/clinical'
import thapRuaMark from './assets/thap-rua-mark.svg'
import styles from './App.module.scss'

const navigation = [
  { label: 'Tổng quan', icon: House, path: '/tong-quan' },
  { label: 'Hồ sơ bệnh án', icon: FileHeart, path: '/ho-so-benh-an' },
  { label: 'Toa thuốc', icon: Pill, path: '/toa-thuoc' },
  { label: 'Dịch vụ kỹ thuật', icon: FlaskConical, path: '/dich-vu-ky-thuat' },
  { label: 'Lịch hẹn', icon: CalendarDays, path: '/lich-hen' },
  { label: 'Bệnh nhân', icon: Users, path: '/benh-nhan' },
  { label: 'Kho dữ liệu', icon: Database, path: '/kho-du-lieu' },
  { label: 'Báo cáo', icon: BarChart3, path: '/bao-cao' },
  { label: 'Cài đặt', icon: Settings, path: '/cai-dat' },
]

const headerTabs = [
  { label: 'Thông tin khám bệnh', shortcut: 'F6', path: '/ho-so-benh-an' },
  { label: 'Toa thuốc - Vật tư y tế', shortcut: 'F7', path: '/toa-thuoc' },
  { label: 'Dịch vụ kỹ thuật', shortcut: 'F8', path: '/dich-vu-ky-thuat' },
  { label: 'Chuyển viện', shortcut: 'F9', path: '/chuyen-vien' },
  { label: 'Nhập viện', shortcut: 'F10', path: '/nhap-vien' },
]

const queueActions = [
  { label: 'Gọi số thứ tự', icon: Megaphone, tone: undefined },
  { label: 'Gọi tên bệnh nhân', icon: UserRoundCheck, tone: undefined },
  { label: 'Khám (F1)', icon: Stethoscope, tone: undefined },
  { label: 'Kết thúc khám (F2)', icon: ClipboardList, tone: 'danger' },
  { label: 'Hủy khám', icon: Ban, tone: 'warning' },
  { label: 'Thủ thuật', icon: Syringe, tone: undefined },
] as const

const queueFooterActions = [
  { label: 'Biên bản hội chẩn', icon: FileText, tone: undefined },
  { label: 'Lịch sử khám', icon: History, tone: undefined },
  { label: 'In giấy nghỉ ốm/Dưỡng thai', icon: FileClock, tone: undefined },
  { label: 'Xóa bộ nhớ tạm', icon: Eraser, tone: 'danger' },
] as const

function Sidebar() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const logout = useAuthStore((state) => state.logout)
  const isSubmitting = useAuthStore((state) => state.isSubmitting)
  const authUser = useAuthStore((state) => state.user)

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
      <div className={styles.brand}>
        <img className={styles.brandMark} src={thapRuaMark} alt="" aria-hidden="true" />
        <strong className={styles.brandName}>Tháp Rùa</strong>
      </div>
      <nav className={styles.sidebarNav} aria-label="Điều hướng chính">
        {navigation.map(({ label, icon: Icon, path }) => (
          <NavLink
            key={label}
            to={path}
            title={collapsed ? label : undefined}
            className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}
          >
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarDoctor} title={authUser?.email ?? undefined}>
          <span>HM</span>
          <div><strong>BS. Lê Thị Mỹ Hạnh</strong><small>Khoa Sản</small></div>
        </div>
        <button type="button" className={styles.logoutButton} onClick={() => void logout()} disabled={isSubmitting}>
          <LogOut size={18} /><span>{isSubmitting ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
        </button>
      </div>
    </aside>
  )
}

function Header() {
  const toggleSidebar = useClinicalStore((state) => state.toggleSidebar)

  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} onClick={toggleSidebar} aria-label="Thu gọn sidebar">
        <Menu size={22} />
      </button>
      <nav className={styles.headerTabs} aria-label="Chức năng khám bệnh">
        {headerTabs.map((tab) => (
          <NavLink
            key={tab.shortcut}
            to={tab.path}
            className={({ isActive }) => `${styles.headerTab} ${isActive ? styles.headerTabActive : ''}`}
          >
            <span>{tab.label}</span><kbd>{tab.shortcut}</kbd>
          </NavLink>
        ))}
      </nav>
      <div className={styles.headerUtilities}>
        <button type="button" className={styles.iconButton} aria-label="Thông báo"><Bell size={19} /></button>
        <button type="button" className={styles.iconButton} aria-label="Trợ giúp"><CircleHelp size={19} /></button>
        <div className={styles.headerDoctor}>
          <span className={styles.avatar}>HM</span>
          <div><strong>BS. Lê Thị Mỹ Hạnh</strong><small>Khoa Sản</small></div>
          <ChevronDown size={15} />
        </div>
      </div>
    </header>
  )
}

function PatientQueue() {
  const selectedMedicalId = useClinicalStore((state) => state.selectedMedicalId)
  const searchTerm = useClinicalStore((state) => state.searchTerm)
  const statusFilter = useClinicalStore((state) => state.statusFilter)
  const selectPatient = useClinicalStore((state) => state.selectPatient)
  const setSearchTerm = useClinicalStore((state) => state.setSearchTerm)
  const setStatusFilter = useClinicalStore((state) => state.setStatusFilter)
  const notify = useClinicalStore((state) => state.notify)
  const patientPanelCollapsed = useClinicalStore((state) => state.patientPanelCollapsed)
  const togglePatientPanel = useClinicalStore((state) => state.togglePatientPanel)
  const selectedPatient = mockPatients.find((patient) => patient.medicalId === selectedMedicalId) ?? mockPatients[0]
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi')
  const filteredPatients = mockPatients.filter((patient) => {
    const searchable = `${patient.medicalId} ${patient.fullName} ${patient.queueNumber}`.toLocaleLowerCase('vi')
    return (!normalizedSearch || searchable.includes(normalizedSearch)) && (!statusFilter || patient.status === statusFilter)
  })
  const toggleStatus = (status: PatientStatus) => setStatusFilter(statusFilter === status ? null : status)

  return (
    <aside className={`${styles.patientPanel} ${patientPanelCollapsed ? styles.patientPanelCollapsed : ''}`}>
      <button
        type="button"
        className={styles.patientPanelToggle}
        onClick={togglePatientPanel}
        aria-label={patientPanelCollapsed ? 'Mở danh sách bệnh nhân' : 'Thu gọn danh sách bệnh nhân'}
        title={patientPanelCollapsed ? 'Mở danh sách bệnh nhân' : 'Thu gọn danh sách bệnh nhân'}
      >
        {patientPanelCollapsed ? <ChevronsRight size={14} strokeWidth={2.5} /> : <ChevronsLeft size={14} strokeWidth={2.5} />}
      </button>
      {patientPanelCollapsed && <div className={styles.collapsedPanelLabel}><Users size={19} /><span>Danh sách bệnh nhân</span></div>}
      <div className={styles.patientPanelContent}>
      <div className={styles.queueTop}>
        <div className={styles.dateFields}>
          <label><span>Từ ngày</span><span className={styles.dateInput}>17/07/2026 <CalendarDays size={14} /></span></label>
          <label><span>Đến ngày</span><span className={styles.dateInput}>17/07/2026 <CalendarDays size={14} /></span></label>
        </div>
        <button type="button" className={styles.patientListButton} onClick={() => notify('Đã tải danh sách bệnh nhân')}>
          <ClipboardList size={20} /><span>Danh sách<br />bệnh nhân (F5)</span>
        </button>
      </div>

      <div className={styles.statusGrid}>
        {statusSummary.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.statusCard} ${statusFilter === item.key ? styles.statusCardActive : ''}`}
            onClick={() => toggleStatus(item.key)}
          >
            <span className={`${styles.statusDot} ${styles[item.key]}`} />
            <span>{item.label}</span><strong>{item.count}</strong>
          </button>
        ))}
      </div>

      <div className={styles.selectedPatient}>
        <small>Bệnh nhân:</small>
        <h2>{selectedPatient.fullName}</h2>
        <p>Mã BN: <strong>{selectedPatient.medicalId}</strong></p>
      </div>

      <div className={styles.queueActions}>
        {queueActions.map(({ label, icon: Icon, tone }) => (
          <button key={label} type="button" className={`${styles.queueAction} ${tone ? styles[tone] : ''}`} onClick={() => notify(label)}>
            <Icon size={14} /><span>{label}</span>
          </button>
        ))}
      </div>

      <label className={styles.patientSearch}>
        <Search size={16} />
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm kiếm bệnh nhân..." />
      </label>

      <div className={styles.patientTableWrap}>
        <table className={styles.patientTable}>
          <thead><tr><th>Mã BN</th><th>STT</th><th>Tên bệnh nhân</th><th>NS</th></tr></thead>
          <tbody>
            {filteredPatients.map((patient) => (
              <tr key={patient.medicalId} className={patient.medicalId === selectedMedicalId ? styles.selectedRow : ''} onClick={() => selectPatient(patient.medicalId)}>
                <td>{patient.medicalId}</td><td>{patient.queueNumber}</td><td>{patient.fullName}</td><td>{patient.birthYear}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredPatients.length && <p className={styles.emptyState}>Không tìm thấy bệnh nhân phù hợp.</p>}
      </div>

      <div className={styles.queueFooter}>
        {queueFooterActions.map(({ label, icon: Icon, tone }) => (
          <button key={label} type="button" className={`${styles.footerAction} ${tone ? styles[tone] : ''}`} onClick={() => notify(label)}>
            <Icon size={14} /><span>{label}</span>
          </button>
        ))}
      </div>
      </div>
    </aside>
  )
}

type FieldProps = {
  label: string
  value: string | number | null
  unit?: string
  className?: string
  required?: boolean
}

function Field({ label, value, unit, className = '', required = false }: FieldProps) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span>{label}{required && <b>*</b>}</span>
      <div className={styles.inputShell}>
        <input value={value ?? ''} readOnly aria-label={label} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  )
}

function SectionTitle({ icon: Icon, title, trailing }: { icon: typeof Info; title: string; trailing?: React.ReactNode }) {
  return (
    <header className={styles.sectionTitle}>
      <div><Icon size={17} /><h2>{title}</h2></div>
      {trailing}
    </header>
  )
}

function ClinicalRecord({ patient }: { patient: PatientRecord }) {
  const notify = useClinicalStore((state) => state.notify)
  const vitalSigns = patient.vitalSigns

  return (
    <section className={styles.recordPanel}>
      <section className={styles.recordSection}>
        <SectionTitle icon={Users} title="Thông tin bệnh nhân" />
        <div className={`${styles.sectionContent} ${styles.patientInfoGrid}`}>
          <Field label="Mã y tế" value={patient.medicalId} />
          <Field label="Họ và tên" value={patient.fullName} className={styles.span2} />
          <Field label="Năm sinh" value={patient.birthYear} />
          <Field label="Tuổi/tháng" value={patient.ageText} />
          <Field label="Giới tính" value={patient.gender} />
          <Field label="Ngày khám trước" value={patient.previousVisitDate} />
          <Field label="Số BHYT" value={patient.insuranceNumber} />
          <Field label="Đối tượng" value={patient.patientType} className={styles.span2} />
          <Field label="TL giảm (%)" value={patient.discountPercent} />
          <Field label="Ngày BH còn lại" value={patient.insuranceDaysRemaining} />
          <Field label="Ngày còn thuốc" value={patient.medicineDaysRemaining} />
          <Field label="Số dư (VNĐ)" value={patient.balanceVnd} className={styles.balanceField} />
          <Field label="Số điện thoại" value={patient.phone} />
          <Field label="Địa chỉ" value={patient.address} className={styles.span4} />
        </div>
      </section>

      <section className={`${styles.recordSection} ${styles.examSection}`}>
        <SectionTitle
          icon={Stethoscope}
          title="Thông tin khám bệnh"
          trailing={<div className={styles.examTime}><span>Ngày giờ khám bệnh</span><strong>{patient.visitDateTime}</strong></div>}
        />
        <div className={`${styles.sectionContent} ${styles.examCardsGrid}`}>
          <div className={styles.leftCardColumn}>
          <article className={`${styles.clinicalCard} ${styles.progressCard}`}>
            <header className={styles.cardHeader}><FileText size={16} /><h3>Diễn biến bệnh</h3></header>
            <div className={styles.noteBody}>
              <div className={styles.noteTools}>
                <button type="button" onClick={() => notify('Hồ sơ khám')}><FileHeart size={14} />Hồ sơ khám</button>
                <button type="button" onClick={() => notify('Đã load mẫu')}><ListRestart size={14} />Load mẫu</button>
                <button type="button" onClick={() => notify('Đã load lịch sử')}><History size={14} />Load lịch sử</button>
              </div>
              <textarea key={`${patient.medicalId}-progress`} defaultValue={patient.clinicalProgress} aria-label="Diễn biến bệnh" />
            </div>
          </article>

          <article className={`${styles.clinicalCard} ${styles.planCard}`}>
            <header className={styles.cardHeader}><ClipboardList size={16} /><h3>Hướng xử trí</h3></header>
            <div className={styles.noteBody}>
              <div className={styles.noteTools}>
                <button type="button" onClick={() => notify('Đã tạo mẫu')}><ClipboardPlus size={14} />Tạo mẫu</button>
                <button type="button" onClick={() => notify('Đã load mẫu')}><ListRestart size={14} />Load mẫu</button>
              </div>
              <textarea key={`${patient.medicalId}-plan`} defaultValue={patient.treatmentPlan} aria-label="Hướng xử trí" />
            </div>
          </article>

          </div>

          <div className={styles.rightCardColumn}>
          <article className={`${styles.clinicalCard} ${styles.reasonCard}`}>
            <header className={styles.cardHeader}><Stethoscope size={16} /><h3>Lý do khám</h3></header>
            <div className={styles.cardBody}>
              <Field label="Lý do khám" value={patient.reason} />
            </div>
          </article>

          <article className={`${styles.clinicalCard} ${styles.clinicalDetailsCard}`}>
            <header className={styles.cardHeader}><Activity size={16} /><h3>Dấu hiệu sinh tồn</h3></header>
            <div className={`${styles.cardBody} ${styles.clinicalDetailsBody}`}>
              <div className={styles.vitalsGrid}>
                <Field label="Mạch" value={vitalSigns.pulse} unit="lần/phút" />
                <Field label="Nhịp thở" value={vitalSigns.respiratoryRate} unit="lần/phút" />
                <Field label="Huyết áp" value={vitalSigns.systolicBloodPressure !== null && vitalSigns.diastolicBloodPressure !== null ? `${vitalSigns.systolicBloodPressure} / ${vitalSigns.diastolicBloodPressure}` : ''} unit="mmHg" />
                <Field label="SpO₂" value={vitalSigns.spo2} unit="%" />
                <Field label="Đường huyết" value={vitalSigns.bloodGlucose} unit="mg/dL" />
                <Field label="Nhiệt độ" value={vitalSigns.temperature} unit="°C" />
                <Field label="Chiều cao" value={vitalSigns.height} unit="cm" />
                <Field label="Cân nặng" value={vitalSigns.weight} unit="kg" required />
                <Field label="Vòng eo" value={vitalSigns.waist} unit="cm" />
                <Field label="BMI" value={vitalSigns.bmi} />
                <Field label="BSA" value={vitalSigns.bsa} />
                <Field label="HbA1c" value={vitalSigns.hba1c} unit="%" />
              </div>

              <div className={styles.treatmentPane}>
                <div className={styles.treatmentSubheading}><UserRoundCheck size={15} /><span>Thông tin điều trị</span></div>
                <div className={styles.checkRow}>
                  <label>
                    <input type="checkbox" checked={vitalSigns.pregnancyWeeks !== null} readOnly />
                    <span>Mang thai/nghi ngờ thai</span>
                    <select value={vitalSigns.pregnancyWeeks ?? ''} onChange={() => undefined} aria-label="Số tuần thai">
                      <option value="">Tuần</option><option value="38">38 tuần</option>
                    </select>
                  </label>
                  <label><input type="checkbox" checked={vitalSigns.breastfeeding} readOnly /><span>Cho con bú</span></label>
                </div>

                <div className={styles.treatmentFields}>
                  <label className={styles.field}>
                    <span>Bác sĩ điều trị<b>*</b></span>
                    <select value={patient.doctor} onChange={() => undefined}><option>{patient.doctor}</option></select>
                  </label>
                  <label className={styles.field}>
                    <span>Điều dưỡng 1</span>
                    <select value={patient.nurseOne} onChange={() => undefined}><option>{patient.nurseOne}</option></select>
                  </label>
                  <label className={styles.field}>
                    <span>Điều dưỡng 2</span>
                    <select value={patient.nurseTwo} onChange={() => undefined}><option>{patient.nurseTwo}</option></select>
                  </label>
                </div>
              </div>
            </div>
          </article>

          </div>

          <article className={`${styles.clinicalCard} ${styles.diagnosisCard}`}>
            <header className={styles.cardHeader}><ClipboardPlus size={16} /><h3>Chẩn đoán</h3></header>
            <div className={styles.diagnosisArea}>
              <div className={styles.diagnosisRow}>
                <label>ICD bệnh chính<b>*</b></label>
                <input value={patient.diagnoses.primaryCode} readOnly aria-label="Mã ICD bệnh chính" />
                <input value={patient.diagnoses.primaryDescription} readOnly aria-label="Mô tả ICD bệnh chính" />
              </div>
              <div className={styles.diagnosisRow}>
                <label>ICD bệnh khác</label><input value="" readOnly aria-label="Mã ICD bệnh khác" /><input value={patient.diagnoses.secondary} readOnly aria-label="Mô tả ICD bệnh khác" />
              </div>
              <div className={styles.diagnosisRow}>
                <label>Bệnh kèm theo</label><input value="" readOnly aria-label="Mã bệnh kèm theo" /><input value={patient.diagnoses.comorbidity} readOnly aria-label="Mô tả bệnh kèm theo" />
              </div>
              <label className={styles.diagnosisNote}>
                <span>Ghi chú chẩn đoán</span>
                <textarea className={styles.diagnosisSummary} defaultValue={patient.diagnoses.summary} aria-label="Nội dung chẩn đoán" />
              </label>
            </div>
          </article>
        </div>      </section>

      <footer className={styles.actionBar}>
        <button type="button" onClick={() => notify('Đang mở tiền sử dị ứng')}><HeartPulse size={16} />Tiền sử dị ứng</button>
        <button type="button" onClick={() => notify('Đang mở thông tin khám')}><Info size={16} />Xem thông tin khám</button>
        <button type="button" className={styles.saveButton} onClick={() => notify('Đã lưu hồ sơ khám')}><Save size={16} />Lưu</button>
        <button type="button" className={styles.cancelButton} onClick={() => notify('Đã hủy thay đổi')}><X size={16} />Hủy</button>
      </footer>
    </section>
  )
}

function HisWorkspace() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const patientPanelCollapsed = useClinicalStore((state) => state.patientPanelCollapsed)
  const selectedMedicalId = useClinicalStore((state) => state.selectedMedicalId)
  const toastMessage = useClinicalStore((state) => state.toastMessage)
  const clearToast = useClinicalStore((state) => state.clearToast)
  const patient = mockPatients.find((item) => item.medicalId === selectedMedicalId) ?? mockPatients[0]

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(clearToast, 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage, clearToast])

  return (
    <div className={styles.appShell}>
      <Sidebar />
      <main className={`${styles.mainShell} ${collapsed ? styles.mainShellCollapsed : ''}`}>
        <Header />
        <div className={`${styles.workspace} ${patientPanelCollapsed ? styles.workspacePatientCollapsed : ''} `}>
          <PatientQueue />
          <ClinicalRecord patient={patient} />
        </div>
      </main>
      {toastMessage && <div className={styles.toast}><Activity size={16} />{toastMessage}</div>}
    </div>
  )
}

export default function App() {
  const status = useAuthStore((state) => state.status)
  const expiresAt = useAuthStore((state) => state.expiresAt)
  const initialize = useAuthStore((state) => state.initialize)
  const refreshSession = useAuthStore((state) => state.refreshSession)

  useEffect(() => {
    void initialize()
  }, [initialize])

  useEffect(() => {
    if (status !== 'authenticated' || !expiresAt) return
    const refreshAt = expiresAt * 1000 - 60_000
    const timeoutId = window.setTimeout(() => void refreshSession(), Math.max(1_000, refreshAt - Date.now()))
    return () => window.clearTimeout(timeoutId)
  }, [expiresAt, refreshSession, status])

  if (status === 'checking') return <AuthLoadingScreen />

  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dang-nhap" replace />} />
      <Route path="*" element={<ProtectedRoute><HisWorkspace /></ProtectedRoute>} />
    </Routes>
  )
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const status = useAuthStore((state) => state.status)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/dang-nhap" replace state={{ from: location }} />
  }

  return children
}












