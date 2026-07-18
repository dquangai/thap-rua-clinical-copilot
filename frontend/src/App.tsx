import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import {
  Activity,
  Ban,
  BarChart3,
  Bell,
  CalendarDays,
  CircleCheck,
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
  LoaderCircle,
  LogOut,
  Megaphone,
  Menu,
  Pill,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  TriangleAlert,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { mockPatients, statusSummary } from './data/mockPatients'
import { buildCheckerRecord, checkClinicalRecord, generateCounseling } from './lib/aiCheck'
import LoginPage, { AuthLoadingScreen } from './pages/LoginPage'
import { useAuthStore } from './store/useAuthStore'
import { useClinicalStore } from './store/useClinicalStore'
import type { AiCheckResponse } from './types/aiCheck'
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

const aiScanRuleLabels = [
  'Kiểm tra tiền sử sản khoa và phụ khoa',
  'Đối chiếu dấu hiệu bất thường thai kỳ',
  'Kiểm tra mạch, huyết áp và nhịp thở',
  'Đối chiếu chiều cao, cân nặng và BMI',
  'Kiểm tra khám toàn thân và khám bụng',
  'Đối chiếu xét nghiệm theo tuổi thai',
  'Kiểm tra chẩn đoán và phân loại nguy cơ',
  'Đối chiếu hướng xử trí và vi chất',
  'Kiểm tra tư vấn và dấu hiệu cần khám ngay',
  'Đối chiếu lịch hẹn tái khám thai',
]

const normalizedDiagnosis = (value: string) => value
  .toLocaleUpperCase('vi-VN')
  .replace(/[–—-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const hasSupplementaryDiagnosis = (code: string, description: string, note: string) => {
  const normalizedNote = normalizedDiagnosis(note)
  return Boolean(normalizedNote)
    && normalizedNote !== normalizedDiagnosis(description)
    && normalizedNote !== normalizedDiagnosis(`${code} ${description}`)
}

type RemediationSection = 'history' | 'physical-exam' | 'investigations' | 'progress' | 'circulation' | 'temperature' | 'respiration' | 'anthropometrics' | 'diagnosis' | 'plan' | 'counseling'
type RemediationMode = 'structured' | 'replace-line' | 'append'
type RemediationConfig = {
  section: RemediationSection
  field?: keyof AiDocumentNotes
  mode: RemediationMode
  keywords?: string[]
  editLabel?: string
}

const remediationRegistry: Record<string, RemediationConfig> = {
  'R01.2': { section: 'history', field: 'clinicalProgress', mode: 'replace-line', keywords: ['PARA'], editLabel: 'Cập nhật tiền sử sản khoa' },
  'R01.3': { section: 'history', field: 'clinicalProgress', mode: 'replace-line', keywords: ['TIEN CAN'], editLabel: 'Cập nhật tiền sử nội – ngoại khoa' },
  'R02.1': { section: 'circulation', mode: 'structured', editLabel: 'Nhập mạch và huyết áp' },
  'R02.2': { section: 'temperature', mode: 'structured', editLabel: 'Nhập nhiệt độ' },
  'R02.3': { section: 'respiration', mode: 'structured', editLabel: 'Nhập nhịp thở' },
  'R02.4': { section: 'anthropometrics', mode: 'structured', editLabel: 'Nhập chiều cao và cân nặng' },
  'R03.4': { section: 'investigations', field: 'clinicalProgress', mode: 'replace-line', keywords: ['XET NGHIEM'], editLabel: 'Cập nhật kết quả công thức máu' },
  'R03.10': { section: 'investigations', field: 'clinicalProgress', mode: 'replace-line', keywords: ['SANG LOC BE'], editLabel: 'Cập nhật sàng lọc lệch bội' },
  'R03.11': { section: 'investigations', field: 'clinicalProgress', mode: 'replace-line', keywords: ['TSG'], editLabel: 'Cập nhật sàng lọc tiền sản giật' },
  'R06.2': { section: 'plan', field: 'treatmentPlan', mode: 'replace-line', keywords: ['SAT', 'ACID FOLIC', 'CANXI'], editLabel: 'Điều chỉnh liều vi chất trực tiếp' },
  'R06.7': { section: 'plan', field: 'treatmentPlan', mode: 'replace-line', keywords: ['TAI KHAM', 'HEN KHAM'], editLabel: 'Điều chỉnh lịch tái khám' },
  R07: { section: 'plan', field: 'treatmentPlan', mode: 'replace-line', keywords: ['TAI KHAM', 'HEN KHAM'], editLabel: 'Điều chỉnh ngày hẹn theo tuổi thai' },
}

const plainClinicalText = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

const defaultRemediation = (itemId: string): RemediationConfig => {
  if (itemId.startsWith('R01')) return { section: 'history', field: 'clinicalProgress', mode: 'append' }
  if (['R02.5', 'R02.6'].includes(itemId)) return { section: 'physical-exam', field: 'clinicalProgress', mode: 'append' }
  if (itemId.startsWith('R03')) return { section: 'investigations', field: 'clinicalProgress', mode: 'append' }
  if (itemId.startsWith('R04') || itemId.startsWith('R05')) return { section: 'progress', field: 'clinicalProgress', mode: 'append' }
  if (itemId === 'R06.1') return { section: 'diagnosis', field: 'diagnosisSummary', mode: 'append' }
  if (itemId.startsWith('R06') || itemId.startsWith('R08')) return { section: 'counseling', field: 'counselingRecord', mode: 'append' }
  return { section: 'plan', field: 'treatmentPlan', mode: 'append' }
}

const remediationFor = (itemId: string) => remediationRegistry[itemId] ?? defaultRemediation(itemId)

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

type AiCheckState = {
  open: boolean
  loading: boolean
  error: string
  data: AiCheckResponse | null
}

type AiDocumentNotes = {
  clinicalProgress: string
  treatmentPlan: string
  diagnosisSummary: string
  counselingRecord: string
}

function AiCheckModal({ state, patient, notes, onEditNotes, onAppendNotes, onEditVitals, onClose }: {
  state: AiCheckState
  patient: PatientRecord
  notes: AiDocumentNotes
  onEditNotes: (field: keyof AiDocumentNotes, value: string) => void
  onAppendNotes: (field: keyof AiDocumentNotes, value: string) => void
  onEditVitals: (field: 'pulse' | 'respiratoryRate' | 'systolicBloodPressure' | 'diastolicBloodPressure' | 'temperature' | 'height' | 'weight', value: number | null) => void
  onClose: () => void
}) {
  const { loading, error, data } = state
  const result = data?.result
  const catalog = data?.criteria_catalog ?? {}
  const failures = result?.khong_dat ?? []
  const passed = result?.ket_luan === 'DAT'
  const criticalSet = new Set(result?.vi_pham_critical ?? [])
  const [activeFailure, setActiveFailure] = useState<string | null>(null)
  const [scanRuleIndex, setScanRuleIndex] = useState(0)
  useEffect(() => {
    if (!loading) return
    const timer = window.setInterval(() => setScanRuleIndex((index) => (index + 1) % aiScanRuleLabels.length), 720)
    return () => window.clearInterval(timer)
  }, [loading])

  const failureGroup = (itemId: string) => remediationFor(itemId).section
  const groupFailures = (group: string) => failures.filter((failure) => failureGroup(failure.item_id) === group)
  const lineProps = (group: string) => {
    const related = groupFailures(group)
    return related.length === 0 ? {} : {
      className: `${styles.aiInlineFinding} ${activeFailure && related.some(({ item_id }) => item_id === activeFailure) ? styles.aiFindingActive : ''}`,
      onMouseEnter: () => setActiveFailure(related[0].item_id),
      onMouseLeave: () => setActiveFailure(null),
    }
  }
  const editableProps = (group: string, field: keyof AiDocumentNotes) => groupFailures(group).length === 0 ? {} : {
    ...lineProps(group),
    contentEditable: true,
    suppressContentEditableWarning: true,
    role: 'textbox',
    title: 'Nhấn để chỉnh sửa trực tiếp',
    onBlur: (event: React.FocusEvent<HTMLElement>) => onEditNotes(field, event.currentTarget.textContent ?? ''),
  }
  const renderPreciseFindings = (groups: string[], field: keyof AiDocumentNotes, excludedIds: string[] = []) => groups
    .flatMap((group) => groupFailures(group))
    .filter((failure) => {
      const config = remediationFor(failure.item_id)
      return !excludedIds.includes(failure.item_id) && (config.mode === 'append'
        || (config.mode === 'replace-line' && !matchedLineRuleIds(field).includes(failure.item_id)))
    })
    .map((failure) => (
    <div
      key={failure.item_id}
      className={`${styles.aiFindingEditor} ${activeFailure === failure.item_id ? styles.aiFindingActive : ''}`}
      onMouseEnter={() => setActiveFailure(failure.item_id)}
      onMouseLeave={() => setActiveFailure(null)}
    >
      <div className={styles.aiFindingReminder}>
        <TriangleAlert size={10} />
        <span><b>{failure.item_id}</b> {failure.ly_do || catalog[failure.item_id] || 'Thiếu thông tin theo tiêu chí'}</span>
      </div>
      <label className={styles.aiFindingInput}>
        <span>Nội dung bác sĩ bổ sung</span>
        <textarea
          rows={2}
          placeholder="Nhập thông tin cần bổ sung vào hồ sơ…"
          onFocus={() => setActiveFailure(failure.item_id)}
          onBlur={(event) => {
            const value = event.currentTarget.value.trim()
            if (value) {
              onAppendNotes(field, value)
              event.currentTarget.value = ''
              event.currentTarget.placeholder = 'Đã thêm vào hồ sơ'
            }
            setActiveFailure(null)
          }}
        />
      </label>
    </div>
  ))
  const matchedLineRuleIds = (field: keyof AiDocumentNotes) => failures.filter((failure) => {
    const config = remediationFor(failure.item_id)
    return config.mode === 'replace-line' && config.field === field && config.keywords?.some((keyword) =>
      notes[field].split('\n').some((line) => plainClinicalText(line).includes(keyword)))
  }).map((failure) => failure.item_id)
  const renderEditableLines = (field: keyof AiDocumentNotes) => {
    const lines = notes[field].split('\n')
    const claimed = new Set<string>()
    return lines.map((line, index) => {
      const normalizedLine = plainClinicalText(line)
      const failure = failures.find((candidate) => {
        const config = remediationFor(candidate.item_id)
        return !claimed.has(candidate.item_id) && config.mode === 'replace-line' && config.field === field
          && config.keywords?.some((keyword) => normalizedLine.includes(keyword))
      })
      if (!failure) return <p key={`${index}-${line}`}>{line || 'Chưa ghi nhận thông tin.'}</p>
      claimed.add(failure.item_id)
      const config = remediationFor(failure.item_id)
      return (
        <div
          key={`${index}-${failure.item_id}`}
          className={`${styles.aiDirectCorrection} ${activeFailure === failure.item_id ? styles.aiFindingActive : ''}`}
          onMouseEnter={() => setActiveFailure(failure.item_id)}
          onMouseLeave={() => setActiveFailure(null)}
        >
          <span><TriangleAlert size={9} />{config.editLabel ?? 'Thông tin hiện tại chưa đạt — nhấn vào dòng dưới để sửa'}</span>
          <p
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            onFocus={() => setActiveFailure(failure.item_id)}
            onBlur={(event) => {
              const updated = [...lines]
              updated[index] = event.currentTarget.textContent?.trim() ?? ''
              onEditNotes(field, updated.join('\n'))
              setActiveFailure(null)
            }}
          >{line}</p>
        </div>
      )
    })
  }

  const renderPaper = (scanning = false) => (
    <div className={`${styles.aiPaper} ${scanning ? styles.aiPaperScanning : ''}`}>
      {scanning && <div className={styles.aiScanBeam} aria-hidden="true" />}
      <div className={styles.aiPaperBrand}><img src={thapRuaMark} alt="" /><div><strong>BỆNH VIỆN THÁP RÙA</strong><span>PHIẾU KHÁM BỆNH</span></div></div>
      <div className={styles.aiPaperTitle}><strong>HỒ SƠ KHÁM BỆNH</strong><span>Ngày khám: {patient.visitDateTime}</span></div>
      <div className={styles.aiPaperGrid}>
        <p><span>Họ và tên</span><b className={scanning ? styles.aiPiiRedacted : ''}>{patient.fullName}</b></p>
        <p><span>Năm sinh</span><b>{patient.birthYear}</b></p>
        <p><span>Giới tính</span><b>{patient.gender}</b></p>
        <p><span>Mã y tế</span><b className={scanning ? styles.aiPiiRedacted : ''}>{patient.medicalId}</b></p>
        <p className={styles.aiPaperWide}><span>Địa chỉ</span><b className={scanning ? styles.aiPiiRedacted : ''}>{patient.address}</b></p>
      </div>
      <section className={styles.aiPaperSection}><h4>Lý do khám</h4><p>{patient.reason || 'Chưa ghi nhận'}</p></section>
      <section className={styles.aiPaperSection}>
        <h4>Diễn biến bệnh và khám thai</h4>
        {renderEditableLines('clinicalProgress')}
        {!scanning && <div className={styles.aiPreciseFindingList}>{renderPreciseFindings(['history', 'physical-exam', 'investigations', 'progress'], 'clinicalProgress')}</div>}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Dấu hiệu sinh tồn và khám toàn thân</h4>
        {!scanning && groupFailures('circulation').length > 0 ? (
          <div {...lineProps('circulation')} className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor} ${activeFailure && groupFailures('circulation').some(({ item_id }) => item_id === activeFailure) ? styles.aiFindingActive : ''}`}>
            <label>Mạch <input type="number" value={patient.vitalSigns.pulse ?? ''} onChange={(event) => onEditVitals('pulse', event.target.value ? Number(event.target.value) : null)} /> lần/phút</label>
            <label>Huyết áp <input type="number" value={patient.vitalSigns.systolicBloodPressure ?? ''} onChange={(event) => onEditVitals('systolicBloodPressure', event.target.value ? Number(event.target.value) : null)} /> / <input type="number" value={patient.vitalSigns.diastolicBloodPressure ?? ''} onChange={(event) => onEditVitals('diastolicBloodPressure', event.target.value ? Number(event.target.value) : null)} /> mmHg</label>
          </div>
        ) : <p>Mạch: {patient.vitalSigns.pulse ?? '—'} lần/phút · Huyết áp: {patient.vitalSigns.systolicBloodPressure ?? '—'}/{patient.vitalSigns.diastolicBloodPressure ?? '—'} mmHg</p>}
        {!scanning && groupFailures('respiration').length > 0 ? (
          <div {...lineProps('respiration')} className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor} ${activeFailure === 'R02.3' ? styles.aiFindingActive : ''}`}><label>Nhịp thở <input type="number" value={patient.vitalSigns.respiratoryRate ?? ''} onChange={(event) => onEditVitals('respiratoryRate', event.target.value ? Number(event.target.value) : null)} /> lần/phút</label></div>
        ) : <p>Nhịp thở: {patient.vitalSigns.respiratoryRate ?? '—'} lần/phút</p>}
        {!scanning && groupFailures('temperature').length > 0 ? (
          <div {...lineProps('temperature')} className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor} ${activeFailure === 'R02.2' ? styles.aiFindingActive : ''}`}><label>Nhiệt độ <input type="number" step="0.1" value={patient.vitalSigns.temperature ?? ''} onChange={(event) => onEditVitals('temperature', event.target.value ? Number(event.target.value) : null)} /> °C</label></div>
        ) : patient.vitalSigns.temperature ? <p>Nhiệt độ: {patient.vitalSigns.temperature} °C</p> : null}
        {!scanning && groupFailures('anthropometrics').length > 0 ? (
          <div {...lineProps('anthropometrics')} className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor} ${activeFailure && groupFailures('anthropometrics').some(({ item_id }) => item_id === activeFailure) ? styles.aiFindingActive : ''}`}>
            <label>Chiều cao <input type="number" value={patient.vitalSigns.height ?? ''} onChange={(event) => onEditVitals('height', event.target.value ? Number(event.target.value) : null)} /> cm</label>
            <label>Cân nặng <input type="number" value={patient.vitalSigns.weight ?? ''} onChange={(event) => onEditVitals('weight', event.target.value ? Number(event.target.value) : null)} /> kg</label>
            <span>BMI: {patient.vitalSigns.bmi ?? '—'}</span>
          </div>
        ) : <p>Chiều cao: {patient.vitalSigns.height ?? '—'} cm · Cân nặng: {patient.vitalSigns.weight ?? '—'} kg · BMI: {patient.vitalSigns.bmi ?? '—'}</p>}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Chẩn đoán</h4>
        <p><b>{patient.diagnoses.primaryCode}</b> — {patient.diagnoses.primaryDescription}</p>
        {hasSupplementaryDiagnosis(patient.diagnoses.primaryCode, patient.diagnoses.primaryDescription, notes.diagnosisSummary) && (
          <p {...(!scanning ? editableProps('diagnosis', 'diagnosisSummary') : {})}>{notes.diagnosisSummary}</p>
        )}
        {!scanning && <div className={styles.aiPreciseFindingList}>{renderPreciseFindings(['diagnosis'], 'diagnosisSummary')}</div>}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Hướng xử trí</h4>
        {renderEditableLines('treatmentPlan')}
        {!scanning && <div className={styles.aiPreciseFindingList}>{renderPreciseFindings(['plan'], 'treatmentPlan')}</div>}
      </section>
      <section className={styles.aiPaperSection}><h4>Tư vấn và dặn dò</h4><p>{notes.counselingRecord || 'Chưa ghi nhận nội dung tư vấn.'}</p>{!scanning && <div className={styles.aiPreciseFindingList}>{renderPreciseFindings(['counseling'], 'counselingRecord')}</div>}</section>
      <div className={styles.aiPaperSign}><span>Bác sĩ điều trị</span><strong className={scanning ? styles.aiPiiRedacted : ''}>{patient.doctor}</strong></div>
    </div>
  )

  return (
    <div className={styles.aiModalOverlay} role="dialog" aria-modal="true" aria-label="Kết quả kiểm tra hồ sơ bằng AI">
      <div className={`${styles.aiModal} ${styles.aiModalWorkspace}`}>
        <header className={styles.aiModalHead}>
          <div><ShieldCheck size={17} /><h2>Kiểm tra tuân thủ hồ sơ (AI)</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng kết quả kiểm tra"><X size={16} /></button>
        </header>
        <div className={styles.aiModalBody}>
          {loading && (
            <div className={styles.aiScanningLayout}>
              <div className={styles.aiPaperViewport}>{renderPaper(true)}</div>
              <div className={styles.aiScanStatus}>
                <div className={styles.aiScanPulse}><ShieldCheck size={22} /></div>
                <strong>AI đang đối chiếu hồ sơ</strong>
                <p>Đang rà soát nội dung bệnh án theo bộ tiêu chí áp dụng…</p>
                <div className={styles.aiScanSteps}>
                  <span className={styles.isDone}>Ẩn danh dữ liệu</span>
                  <span className={styles.isActive}>Đối chiếu quy tắc</span>
                  <div className={styles.aiRuleStream} aria-live="polite">
                    {[2, 1, 0].map((offset) => {
                      const index = (scanRuleIndex - offset + aiScanRuleLabels.length) % aiScanRuleLabels.length
                      return <small key={`${scanRuleIndex}-${offset}`} className={offset === 0 ? styles.aiRuleCurrent : ''}>
                        <ShieldCheck size={10} />{aiScanRuleLabels[index]}
                      </small>
                    })}
                  </div>
                  <span>Tổng hợp kết quả</span>
                </div>
              </div>
            </div>
          )}
          {!loading && error && (
            <div className={styles.aiError}><TriangleAlert size={16} /><p>{error}</p></div>
          )}
          {!loading && result && (
            <div className={styles.aiResultLayout}>
              <div className={styles.aiPaperViewport}>{renderPaper(false)}</div>
              <aside className={styles.aiResultPanel}>
                <div className={`${styles.aiVerdict} ${passed ? styles.aiVerdictPass : styles.aiVerdictFail}`}>
                  {passed ? <CircleCheck size={22} /> : <TriangleAlert size={22} />}
                  <div><strong>{passed ? 'HỒ SƠ ĐẠT' : 'HỒ SƠ CHƯA ĐẠT'}</strong><span>{passed ? 'Không phát hiện tiêu chí vi phạm' : `${failures.length} tiêu chí cần bổ sung`}</span></div>
                </div>
                {failures.length > 0 && <ul className={styles.aiExceptionList}>
                  {failures.map((failure) => (
                    <li
                      key={failure.item_id}
                      className={activeFailure && failureGroup(activeFailure) === failureGroup(failure.item_id) ? styles.aiExceptionActive : ''}
                      onMouseEnter={() => setActiveFailure(failure.item_id)}
                      onMouseLeave={() => setActiveFailure(null)}
                    >
                      <div className={styles.aiExceptionHead}>
                        <span className={styles.aiRuleCode}>{failure.item_id}</span>
                        {criticalSet.has(failure.item_id) && (
                          <span className={`${styles.aiBadge} ${styles.aiBadgeFail}`}>Nghiêm trọng</span>
                        )}
                      </div>
                      <strong className={styles.aiCriterion}>{catalog[failure.item_id] || 'Tiêu chí chưa có tên trong danh mục'}</strong>
                      {failure.ly_do && <p className={styles.aiNote}>{failure.ly_do}</p>}
                      <p className={styles.aiFixHint}>
                        <span>Gợi ý sửa</span>
                        {remediationFor(failure.item_id).editLabel ?? (remediationFor(failure.item_id).mode === 'append'
                          ? 'Bổ sung thông tin vào vùng nhập liệu được đánh dấu bên trái'
                          : 'Cập nhật giá trị tại vùng được đánh dấu bên trái')}
                      </p>
                    </li>
                  ))}
                </ul>}
              {result.khuyen_nghi && (
                <div className={styles.aiRecommendation}>
                  <strong>Khuyến nghị</strong>
                  <p>{result.khuyen_nghi}</p>
                </div>
              )}
              </aside>
            </div>
          )}
        </div>
        <footer className={styles.aiDisclaimer}>
          Công cụ hỗ trợ kiểm tra, không thay thế đánh giá của nhân viên y tế.
        </footer>
      </div>
    </div>
  )
}

function CounselingModal({
  patient,
  content,
  loading,
  onChange,
  onRegenerate,
  onClose,
}: {
  patient: PatientRecord
  content: string
  loading: boolean
  onChange: (value: string) => void
  onRegenerate: () => void
  onClose: () => void
}) {
  const today = new Date()
  return createPortal(
    <div className={`${styles.aiModalOverlay} ${styles.counselingOverlay}`} role="dialog" aria-modal="true" aria-label="Biên bản tư vấn">
      <div className={`${styles.aiModal} ${styles.counselingModal}`}>
        <header className={`${styles.aiModalHead} ${styles.screenOnly}`}>
          <div><FileText size={17} /><h2>Biên bản tư vấn</h2></div>
          <div className={styles.counselingActions}>
            <button type="button" onClick={onRegenerate} disabled={loading}>
              {loading ? <LoaderCircle size={14} className={styles.aiSpinner} /> : <Sparkles size={14} />}
              Tạo lại (AI)
            </button>
            <button type="button" onClick={() => window.print()} disabled={loading || !content}>
              <Printer size={14} />In / Xuất PDF
            </button>
            <button type="button" className={styles.counselingCloseButton} onClick={onClose} aria-label="Đóng biên bản tư vấn"><X size={16} /></button>
          </div>
        </header>
        <div className={styles.counselingBody}>
          <div className={styles.counselingDoc}>
            <header className={styles.docHead}>
              <div>
                <strong>PHÒNG KHÁM THÁP RÙA</strong>
                <span>{patient.department}</span>
              </div>
              <div className={styles.docMotto}>
                <strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong>
                <span>Độc lập - Tự do - Hạnh phúc</span>
              </div>
            </header>
            <h1 className={styles.docTitle}>BIÊN BẢN TƯ VẤN</h1>
            <div className={styles.docInfo}>
              <p>Họ và tên bệnh nhân: <strong>{patient.fullName}</strong></p>
              <p>Năm sinh: {patient.birthYear} ({patient.ageText}) — Giới tính: {patient.gender}</p>
              <p>Mã bệnh nhân: {patient.medicalId} — Số điện thoại: {patient.phone}</p>
              <p>Địa chỉ: {patient.address}</p>
              <p>Chẩn đoán: <strong>{patient.diagnoses.primaryCode}</strong> — {patient.diagnoses.primaryDescription}</p>
            </div>
            <h2 className={styles.docSection}>NỘI DUNG TƯ VẤN</h2>
            {loading ? (
              <div className={styles.aiLoading}>
                <LoaderCircle size={22} className={styles.aiSpinner} />
                <p>AI đang soạn nội dung tư vấn từ hồ sơ (đã ẩn thông tin định danh)...</p>
              </div>
            ) : (
              <>
                <textarea
                  className={`${styles.docContentInput} ${styles.screenOnly}`}
                  value={content}
                  onChange={(event) => onChange(event.target.value)}
                  placeholder="Chưa có nội dung tư vấn. Bấm 'Tạo lại (AI)' để AI soạn từ hồ sơ, hoặc gõ trực tiếp."
                  aria-label="Nội dung tư vấn"
                />
                <div className={styles.docContentPrint}>{content}</div>
              </>
            )}
            <p className={styles.docDate}>
              Ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
            </p>
            <div className={styles.docSignatures}>
              <div>
                <strong>BÁC SĨ TƯ VẤN</strong>
                <span>(Ký, ghi rõ họ tên)</span>
                <em>{patient.doctor}</em>
              </div>
              <div>
                <strong>BỆNH NHÂN</strong>
                <span>(Ký, ghi rõ họ tên)</span>
                <em>{patient.fullName}</em>
              </div>
            </div>
          </div>
        </div>
        <footer className={`${styles.counselingFooter} ${styles.screenOnly}`}>
          <button type="button" onClick={onClose}><Save size={15} />Lưu và đóng</button>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function ClinicalRecord({ patient }: { patient: PatientRecord }) {
  const notify = useClinicalStore((state) => state.notify)
  const [vitalEdits, setVitalEdits] = useState({
    pulse: patient.vitalSigns.pulse,
    respiratoryRate: patient.vitalSigns.respiratoryRate,
    systolicBloodPressure: patient.vitalSigns.systolicBloodPressure,
    diastolicBloodPressure: patient.vitalSigns.diastolicBloodPressure,
    temperature: patient.vitalSigns.temperature,
    height: patient.vitalSigns.height,
    weight: patient.vitalSigns.weight,
    bmi: patient.vitalSigns.bmi,
  })
  useEffect(() => setVitalEdits({
    pulse: patient.vitalSigns.pulse,
    respiratoryRate: patient.vitalSigns.respiratoryRate,
    systolicBloodPressure: patient.vitalSigns.systolicBloodPressure,
    diastolicBloodPressure: patient.vitalSigns.diastolicBloodPressure,
    temperature: patient.vitalSigns.temperature,
    height: patient.vitalSigns.height,
    weight: patient.vitalSigns.weight,
    bmi: patient.vitalSigns.bmi,
  }), [patient.medicalId, patient.vitalSigns.height, patient.vitalSigns.weight, patient.vitalSigns.bmi])
  const vitalSigns = { ...patient.vitalSigns, ...vitalEdits }
  const editablePatient = { ...patient, vitalSigns }
  const progressRef = useRef<HTMLTextAreaElement>(null)
  const planRef = useRef<HTMLTextAreaElement>(null)
  const diagnosisSummaryRef = useRef<HTMLTextAreaElement>(null)
  const [counselingText, setCounselingText] = useState(patient.counselingRecord)
  const [counselingLoading, setCounselingLoading] = useState(false)
  const [counselingOpen, setCounselingOpen] = useState(false)
  const patientIdRef = useRef(patient.medicalId)
  const [aiCheck, setAiCheck] = useState<AiCheckState>({ open: false, loading: false, error: '', data: null })

  useEffect(() => {
    patientIdRef.current = patient.medicalId
    setCounselingText(patient.counselingRecord)
    setCounselingLoading(false)
    setCounselingOpen(false)
  }, [patient.medicalId, patient.counselingRecord])

  const handleGenerateCounseling = async () => {
    const forPatient = patient.medicalId
    setCounselingOpen(true)
    setCounselingLoading(true)
    try {
      const record = buildCheckerRecord(patient, {
        clinicalProgress: progressRef.current?.value ?? patient.clinicalProgress,
        treatmentPlan: planRef.current?.value ?? patient.treatmentPlan,
        diagnosisSummary: diagnosisSummaryRef.current?.value ?? patient.diagnoses.summary,
        counselingRecord: '',
      })
      const generated = await generateCounseling(record)
      // Bỏ kết quả về trễ nếu bác sĩ đã chuyển sang bệnh nhân khác.
      if (patientIdRef.current !== forPatient) return
      setCounselingText(generated)
      notify('AI đã tạo nội dung tư vấn theo hồ sơ')
    } catch (error) {
      if (patientIdRef.current === forPatient) {
        notify(error instanceof Error ? error.message : 'Lỗi không xác định khi tạo nội dung tư vấn')
      }
    } finally {
      if (patientIdRef.current === forPatient) setCounselingLoading(false)
    }
  }

  const runAiCheck = async () => {
    setAiCheck({ open: true, loading: true, error: '', data: null })
    try {
      const record = buildCheckerRecord(editablePatient, {
        clinicalProgress: progressRef.current?.value ?? patient.clinicalProgress,
        treatmentPlan: planRef.current?.value ?? patient.treatmentPlan,
        diagnosisSummary: diagnosisSummaryRef.current?.value ?? patient.diagnoses.summary,
        counselingRecord: counselingText,
      })
      const data = await checkClinicalRecord(record)
      setAiCheck((state) => ({ ...state, loading: false, data }))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định khi kiểm tra hồ sơ'
      setAiCheck((state) => ({ ...state, loading: false, error: message }))
    }
  }

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
              <textarea key={`${patient.medicalId}-progress`} ref={progressRef} defaultValue={patient.clinicalProgress} aria-label="Diễn biến bệnh" />
            </div>
          </article>

          <article className={`${styles.clinicalCard} ${styles.planCard}`}>
            <header className={styles.cardHeader}><ClipboardList size={16} /><h3>Hướng xử trí</h3></header>
            <div className={styles.noteBody}>
              <div className={styles.noteTools}>
                <button type="button" onClick={() => notify('Đã tạo mẫu')}><ClipboardPlus size={14} />Tạo mẫu</button>
                <button type="button" onClick={() => notify('Đã load mẫu')}><ListRestart size={14} />Load mẫu</button>
              </div>
              <textarea key={`${patient.medicalId}-plan`} ref={planRef} defaultValue={patient.treatmentPlan} aria-label="Hướng xử trí" />
            </div>
          </article>

          <article className={`${styles.clinicalCard} ${styles.planCard}`}>
            <header className={styles.cardHeader}><FileText size={16} /><h3>Biên bản tư vấn</h3></header>
            {counselingText ? (
              <div className={styles.noteBody}>
                <div className={styles.noteTools}>
                  <button type="button" onClick={() => setCounselingOpen(true)}><FileText size={14} />Mở biên bản</button>
                  <button type="button" onClick={() => setCounselingText('')} disabled={counselingLoading}><Eraser size={14} />Xóa</button>
                </div>
                <textarea
                  value={counselingText}
                  onChange={(event) => setCounselingText(event.target.value)}
                  aria-label="Biên bản tư vấn"
                />
              </div>
            ) : (
              <div className={styles.counselingEmpty}>
                <p>Chưa có biên bản tư vấn. Bắt buộc với bệnh nhân có bệnh lý/nguy cơ.</p>
                <button type="button" onClick={handleGenerateCounseling} disabled={counselingLoading}>
                  {counselingLoading ? <LoaderCircle size={15} className={styles.aiSpinner} /> : <Sparkles size={15} />}
                  {counselingLoading ? 'AI đang soạn nội dung...' : 'Tạo biên bản tư vấn'}
                </button>
              </div>
            )}
            {counselingOpen && (
              <CounselingModal
                patient={patient}
                content={counselingText}
                loading={counselingLoading}
                onChange={setCounselingText}
                onRegenerate={handleGenerateCounseling}
                onClose={() => setCounselingOpen(false)}
              />
            )}
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
                <textarea key={`${patient.medicalId}-diagnosis`} ref={diagnosisSummaryRef} className={styles.diagnosisSummary} defaultValue={patient.diagnoses.summary} aria-label="Nội dung chẩn đoán" />
              </label>
            </div>
          </article>
        </div>      </section>

      <footer className={styles.actionBar}>
        <button type="button" onClick={() => notify('Đang mở tiền sử dị ứng')}><HeartPulse size={16} />Tiền sử dị ứng</button>
        <button type="button" onClick={() => notify('Đang mở thông tin khám')}><Info size={16} />Xem thông tin khám</button>
        <button type="button" className={styles.aiCheckButton} onClick={runAiCheck} disabled={aiCheck.loading}>
          {aiCheck.loading ? <LoaderCircle size={16} className={styles.aiSpinner} /> : <ShieldCheck size={16} />}
          Kiểm tra hồ sơ (AI)
        </button>
        <button type="button" className={styles.saveButton} onClick={() => notify('Đã lưu hồ sơ khám')}><Save size={16} />Lưu</button>
        <button type="button" className={styles.cancelButton} onClick={() => notify('Đã hủy thay đổi')}><X size={16} />Hủy</button>
      </footer>
      {aiCheck.open && <AiCheckModal
        state={aiCheck}
        patient={editablePatient}
        notes={{
          clinicalProgress: progressRef.current?.value ?? patient.clinicalProgress,
          treatmentPlan: planRef.current?.value ?? patient.treatmentPlan,
          diagnosisSummary: diagnosisSummaryRef.current?.value ?? patient.diagnoses.summary,
          counselingRecord: counselingText,
        }}
        onEditNotes={(field, value) => {
          // Biên bản tư vấn quản lý bằng state (modal + AI generate), các ô còn lại là textarea uncontrolled.
          if (field === 'counselingRecord') {
            setCounselingText(value)
            return
          }
          const refs = { clinicalProgress: progressRef, treatmentPlan: planRef, diagnosisSummary: diagnosisSummaryRef }
          if (refs[field].current) refs[field].current.value = value
        }}
        onAppendNotes={(field, value) => {
          if (field === 'counselingRecord') {
            setCounselingText((current) => `${current}${current ? '\n' : ''}${value}`)
            return
          }
          const refs = { clinicalProgress: progressRef, treatmentPlan: planRef, diagnosisSummary: diagnosisSummaryRef }
          const target = refs[field].current
          if (target) target.value = `${target.value}${target.value ? '\n' : ''}${value}`
        }}
        onEditVitals={(field, value) => setVitalEdits((current) => {
          const next = { ...current, [field]: value }
          const bmi = next.height && next.weight ? Number((next.weight / ((next.height / 100) ** 2)).toFixed(1)) : null
          return { ...next, bmi }
        })}
        onClose={() => setAiCheck((state) => ({ ...state, open: false }))}
      />}
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
