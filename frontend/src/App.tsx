import { useEffect, useState, type ReactNode } from 'react'
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
  CircleX,
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
  Pencil,
  Pill,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Plus,
  Save,
  ScanLine,
  ShieldCheck,
  Search,
  Settings,
  Stethoscope,
  Syringe,
  Trash2,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { mockPatients, statusSummary } from './data/mockPatients'
import LoginPage, { AuthLoadingScreen } from './pages/LoginPage'
import { useAuthStore } from './store/useAuthStore'
import { useClinicalStore } from './store/useClinicalStore'
import { fetchLabSummaryPdf, requestLabNarrative } from './api/labAnalysisApi'
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

type TechnicalService = {
  id: number
  tim: string
  name: string
  department: string
  note: string
  quantity: number
  unitPrice: string
  total: string
  coverage: string
  object: string
}

const technicalServices: TechnicalService[] = [
  { id: 1, tim: '', name: 'Anti TP (treponema pallidum) miễn dịch tự động', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '115,000', total: '115,000', coverage: '100', object: '2.VP' },
  { id: 2, tim: '', name: 'Điện giải đồ (Na, K, Cl) [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '75,000', total: '75,000', coverage: '100', object: '1.BH' },
  { id: 3, tim: '', name: 'Điện tim thường', department: 'PDDT - Phòng Đo Điện Tim', note: '', quantity: 1, unitPrice: '81,000', total: '81,000', coverage: '100', object: '2.VP' },
  { id: 4, tim: '', name: 'Định lượng Albumin [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '99,000', total: '99,000', coverage: '100', object: '1.BH' },
  { id: 5, tim: '', name: 'Định lượng Creatinin [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '50,000', total: '50,000', coverage: '100', object: '1.BH' },
  { id: 6, tim: '', name: 'Định lượng Glucose [Máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '50,000', total: '50,000', coverage: '100', object: '1.BH' },
  { id: 7, tim: '', name: 'Định lượng Urê máu [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '50,000', total: '50,000', coverage: '100', object: '1.BH' },
  { id: 8, tim: '', name: 'Định lượng máu ABO/Rh (kỹ thuật Gelcard trên máy bán tự động) [2 phương pháp] – [Cho người bệnh]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '173,000', total: '173,000', coverage: '100', object: '2.VP' },
  { id: 9, tim: '', name: 'Đo hoạt độ ALT (GPT) [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '50,000', total: '50,000', coverage: '100', object: '1.BH' },
  { id: 10, tim: '', name: 'Đo hoạt độ AST (GOT) [máu]', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '50,000', total: '50,000', coverage: '100', object: '1.BH' },
  { id: 11, tim: '', name: 'HBsAg(định lượng)-miễn dịch tự động', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '173,000', total: '173,000', coverage: '100', object: '2.VP' },
  { id: 12, tim: '', name: 'HCV Ab miễn dịch tự động', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '197,000', total: '197,000', coverage: '100', object: '2.VP' },
  { id: 13, tim: '', name: 'HIV Ag/Ab miễn dịch tự động', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '173,000', total: '173,000', coverage: '100', object: '2.VP' },
  { id: 14, tim: '', name: 'Siêu âm Doppler tim', department: '2001 - Phòng Siêu Âm', note: '', quantity: 1, unitPrice: '390,000', total: '390,000', coverage: '100', object: '2.VP' },
  { id: 15, tim: '', name: 'Thời gian prothrombin (PT: Prothrombin Time), (Các tên khác: TQ, Tỷ lệ Prothrombin bằng máy tự động)', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '99,000', total: '99,000', coverage: '100', object: '2.VP' },
  { id: 16, tim: '', name: 'Thời gian thromboplastin một phần hoạt hoá (APTT: Activated Partial Thromboplastin Time), (Tên khác: TCK) bằng máy tự động', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '94,000', total: '94,000', coverage: '100', object: '2.VP' },
  { id: 17, tim: '', name: 'Tổng phân tích nước tiểu (bằng máy tự động)', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '60,000', total: '60,000', coverage: '100', object: '1.BH' },
  { id: 18, tim: '', name: 'Tổng phân tích tế bào máu ngoại vi (bằng máy đếm laser)', department: 'XN01 - Phòng Xét Nghiệm', note: '', quantity: 1, unitPrice: '81,000', total: '81,000', coverage: '100', object: '2.VP' },
]
type LabStatus = 'normal' | 'high' | 'low'
type LabScanStatus = 'idle' | 'scanning' | 'formatting' | 'complete'

type LabResultRow = {
  page: number
  name: string
  result: string
  unit: string
  reference: string
}

type LabComparison = LabResultRow & {
  status: LabStatus
  detail: string
  difference: string | null
}

const labReportPages = [1, 2, 3, 4, 5] as const

const labResultRows: LabResultRow[] = [
  { page: 1, name: 'White blood cell', result: '10.48', unit: '10^3/ul', reference: '4 - 9' },
  { page: 1, name: 'Neu%', result: '67.9', unit: '%', reference: '55 - 70' },
  { page: 1, name: 'LYM%', result: '20.4', unit: '%', reference: '20 - 35' },
  { page: 1, name: 'Neutrophil', result: '7.11', unit: '10^3/ul', reference: '2.2 - 6.8' },
  { page: 1, name: 'Monocyte', result: '0.84', unit: '10^3/ul', reference: '0.1 - 0.7' },
  { page: 1, name: 'Hemoglobin', result: '11.7', unit: 'g/dl', reference: '11.0 - 14.7' },
  { page: 1, name: 'Hematocrit', result: '35.4', unit: '%', reference: '35.2 - 46.7' },
  { page: 1, name: 'Platelet count', result: '365', unit: '10^3/ul', reference: '150 - 450' },
  { page: 1, name: 'PDW', result: '9.3', unit: '%', reference: '10 - 20' },
  { page: 2, name: 'Anti TP', result: '0', unit: 'COI', reference: '0 - 1.0' },
  { page: 2, name: 'Anti HIV', result: '0.06', unit: 'COI', reference: '0 - 1' },
  { page: 2, name: 'Anti-HCV', result: '0', unit: 'COI', reference: '0 - 1' },
  { page: 2, name: 'HBsAg định lượng', result: '0', unit: 'IU/mL', reference: '0 - 0.3' },
  { page: 3, name: 'pH nước tiểu', result: '7', unit: '', reference: '5.5 - 8' },
  { page: 3, name: 'Tỷ trọng nước tiểu', result: '1.01', unit: '', reference: '1.001 - 1.03' },
  { page: 3, name: 'Leukocytes nước tiểu', result: '25', unit: 'Leu/ul', reference: 'Neg' },
  { page: 3, name: 'Protein nước tiểu', result: 'neg', unit: 'mg/dl', reference: 'Neg' },
  { page: 4, name: 'PT (Thời gian Prothrombin)', result: '10.9', unit: 'Giây', reference: '10.0 - 15.0' },
  { page: 4, name: 'INR', result: '0.99', unit: '', reference: '0.72 - 1.2' },
  { page: 4, name: 'APTT', result: '25.4', unit: 'Giây', reference: '24 - 39' },
  { page: 5, name: 'Creatinin máu', result: '0.63', unit: 'mg/dl', reference: '0.5 - 0.90' },
  { page: 5, name: 'Urê máu', result: '16.4', unit: 'mg/dl', reference: '10.6 - 48.5' },
  { page: 5, name: 'AST / SGOT', result: '18', unit: 'U/L', reference: '10 - 35' },
  { page: 5, name: 'ALT / SGPT', result: '10.8', unit: 'U/L', reference: '10 - 35' },
  { page: 5, name: 'Albumin máu', result: '36.6', unit: 'g/l', reference: '34 - 48' },
  { page: 5, name: 'Glucose máu', result: '90.7', unit: 'mg/dl', reference: '74 - 109' },
  { page: 5, name: 'Ion Natri', result: '133.8', unit: 'mmol/L', reference: '133 - 147' },
  { page: 5, name: 'Ion Clorua', result: '100.6', unit: 'mmol/L', reference: '94 - 111' },
  { page: 5, name: 'Ion Kali', result: '3.51', unit: 'mmol/L', reference: '3.4 - 4.5' },
  { page: 5, name: 'Calci toàn phần', result: '2.34', unit: 'mmol/L', reference: '2 - 2.6' },
]

function compactNumber(value: number) {
  return value.toFixed(3).replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '')
}

function compareLabResult(row: LabResultRow): LabComparison {
  const unit = row.unit ? ` ${row.unit}` : ''
  const resultValue = Number.parseFloat(row.result.replace(',', '.'))
  const limits = Array.from(row.reference.matchAll(/-?\d+(?:[.,]\d+)?/g), (match) => Number.parseFloat(match[0].replace(',', '.')))

  if (row.reference.toLowerCase() === 'neg') {
    const isNegative = ['neg', 'negative', 'âm tính'].includes(row.result.trim().toLowerCase())
    if (isNegative) {
      return { ...row, status: 'normal', difference: null, detail: `Chỉ số ${row.name} bình thường: kết quả âm tính, phù hợp giá trị tham chiếu.` }
    }
    return { ...row, status: 'high', difference: null, detail: `Chỉ số ${row.name} cao: ${row.result}${unit}` }
  }

  const [lower, upper] = limits
  if (!Number.isFinite(resultValue) || !Number.isFinite(lower) || !Number.isFinite(upper)) {
    return { ...row, status: 'normal', difference: null, detail: `Chỉ số ${row.name} bình thường: ${row.result}${unit}.` }
  }

  if (resultValue > upper) {
    const difference = compactNumber(resultValue - upper)
    return { ...row, status: 'high', difference, detail: `Chỉ số ${row.name} cao: ${row.result}${unit}` }
  }
  if (resultValue < lower) {
    const difference = compactNumber(lower - resultValue)
    return { ...row, status: 'low', difference, detail: `Chỉ số ${row.name} thấp: ${row.result}${unit}` }
  }
  return { ...row, status: 'normal', difference: null, detail: `Chỉ số ${row.name} bình thường: ${row.result}${unit}, nằm trong khoảng tham chiếu ${row.reference}${unit}.` }
}

const labComparisons = labResultRows.map(compareLabResult)
const abnormalLabComparisons = labComparisons.filter((item) => item.status !== 'normal')
const labReferencePositions: Record<string, { top: number; height: number }> = {
  'White blood cell': { top: 34.4, height: 1.58 },
  Neutrophil: { top: 47.87, height: 1.58 },
  Monocyte: { top: 51.24, height: 1.58 },
  PDW: { top: 76.49, height: 1.58 },
  'Leukocytes nước tiểu': { top: 37.76, height: 1.58 },
}

function buildLocalLabNarrative() {
  return abnormalLabComparisons.length
    ? abnormalLabComparisons.map((item) => `- ${item.detail}`).join('\n')
    : 'Không phát hiện chỉ số bất thường.'
}const queueActions = [
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
            key={tab.path}
            to={tab.path}
            className={({ isActive }) => `${styles.headerTab} ${isActive ? styles.headerTabActive : ''}`}
          >
            <span>{tab.label}</span>{tab.shortcut && <kbd>{tab.shortcut}</kbd>}
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

function TechnicalServicesWorkspace() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const toastMessage = useClinicalStore((state) => state.toastMessage)
  const clearToast = useClinicalStore((state) => state.clearToast)
  const notify = useClinicalStore((state) => state.notify)
  const accessToken = useAuthStore((state) => state.accessToken)
  const isDemoMode = useAuthStore((state) => state.isDemoMode)
  const [rows, setRows] = useState(technicalServices)
  const [selectedId, setSelectedId] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [template, setTemplate] = useState('Chọn...')
  const [isEditing, setIsEditing] = useState(false)
  const [labReportOpen, setLabReportOpen] = useState(false)
  const [labPrintOpen, setLabPrintOpen] = useState(false)
  const [labPrintLoading, setLabPrintLoading] = useState(false)
  const [labPrintUrl, setLabPrintUrl] = useState<string | null>(null)
  const [labPrintError, setLabPrintError] = useState<string | null>(null)
  const [labScanStatus, setLabScanStatus] = useState<LabScanStatus>('idle')
  const [labScanPage, setLabScanPage] = useState(0)
  const [labAnalysisText, setLabAnalysisText] = useState('')
  const [highlightedLabName, setHighlightedLabName] = useState<string | null>(null)

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(clearToast, 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage, clearToast])

  useEffect(() => {
    if (labScanStatus !== 'scanning') return

    const pageElement = document.getElementById(`lab-report-page-${labScanPage + 1}`)
    pageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })

    const timeoutId = window.setTimeout(() => {
      if (labScanPage < labReportPages.length - 1) {
        setLabScanPage((page) => page + 1)
        return
      }

      const localNarrative = buildLocalLabNarrative()
      setLabAnalysisText(localNarrative)

      if (!abnormalLabComparisons.length) {
        setLabScanStatus('complete')
        notify('Không phát hiện chỉ số bất thường')
        return
      }

      if (!accessToken) {
        setLabScanStatus('complete')
        notify(`Đã phát hiện ${abnormalLabComparisons.length} chỉ số bất thường`)
        return
      }

      setLabScanStatus('formatting')
      void requestLabNarrative(
        abnormalLabComparisons.map(({ name, result, unit, reference, status, difference }) => ({ name, result, unit, reference, status, difference })),
        accessToken,
      )
        .then((response) => {
          if (response.text.trim()) setLabAnalysisText(response.text.trim())
          notify('Đã hoàn tất đối chiếu và biên tập bản nháp')
        })
        .catch(() => notify('OpenAI chưa sẵn sàng, đang dùng bản đối chiếu cục bộ'))
        .finally(() => setLabScanStatus('complete'))
    }, 1050)

    return () => window.clearTimeout(timeoutId)
  }, [accessToken, labScanPage, labScanStatus, notify])

  const startLabScan = () => {
    setLabAnalysisText('')
    setHighlightedLabName(null)
    setLabScanPage(0)
    setLabScanStatus('scanning')
  }

  const resetLabScan = () => {
    setLabScanStatus('idle')
    setLabScanPage(0)
    setLabAnalysisText('')
    setHighlightedLabName(null)
  }

  const closeLabReport = () => {
    setLabReportOpen(false)
    resetLabScan()
  }

  const closeLabPrint = () => {
    setLabPrintOpen(false)
    if (labPrintUrl) URL.revokeObjectURL(labPrintUrl)
    setLabPrintUrl(null)
    setLabPrintError(null)
  }

  const openLabPrintPreview = async () => {
    setLabPrintOpen(true)
    setLabPrintError(null)
    if (!accessToken && !isDemoMode) {
      setLabPrintError('Vui lòng đăng nhập bằng tài khoản bác sĩ để xem PDF đầy đủ.')
      return
    }
    setLabPrintLoading(true)
    try {
      const pdfBlob = await fetchLabSummaryPdf(accessToken, isDemoMode)
      if (labPrintUrl) URL.revokeObjectURL(labPrintUrl)
      setLabPrintUrl(URL.createObjectURL(pdfBlob))
    } catch {
      setLabPrintError('Không thể tải PDF. Vui lòng kiểm tra backend và thử lại.')
    } finally {
      setLabPrintLoading(false)
    }
  }

  const openLabPdfForPrint = () => {
    if (labPrintUrl) window.open(labPrintUrl, '_blank', 'noopener,noreferrer')
  }

  const showLabReference = (item: LabComparison) => {
    setHighlightedLabName(item.name)
    document.getElementById(`lab-report-page-${item.page}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
  const normalizedSearch = searchTerm.trim().toLocaleLowerCase('vi')
  const visibleRows = rows.filter((row) => {
    const searchable = `${row.id} ${row.name} ${row.department}`.toLocaleLowerCase('vi')
    return !normalizedSearch || searchable.includes(normalizedSearch)
  })

  const updateRow = <K extends keyof TechnicalService>(id: number, key: K, value: TechnicalService[K]) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row))
  }

  const addService = () => {
    const nextId = Math.max(...rows.map((row) => row.id), 0) + 1
    const nextRow: TechnicalService = {
      id: nextId,
      tim: '',
      name: 'Dịch vụ kỹ thuật mới',
      department: 'XN01 - Phòng Xét Nghiệm',
      note: '',
      quantity: 1,
      unitPrice: '0',
      total: '0',
      coverage: '100',
      object: '1.BH',
    }
    setRows((current) => [...current, nextRow])
    setSelectedId(nextId)
    setIsEditing(true)
    notify('Đã thêm dịch vụ kỹ thuật mới')
  }

  const selectedRow = rows.find((row) => row.id === selectedId)
  const selectedName = selectedRow?.name ?? 'dịch vụ đang chọn'
  const labSummaryCounts = {
    high: abnormalLabComparisons.filter((item) => item.status === 'high').length,
    low: abnormalLabComparisons.filter((item) => item.status === 'low').length,
  }
  const labScanBusy = labScanStatus === 'scanning' || labScanStatus === 'formatting'
  const labScanProgress = labScanStatus === 'idle' ? 0 : labScanStatus === 'scanning' ? ((labScanPage + 1) / labReportPages.length) * 88 : labScanStatus === 'formatting' ? 94 : 100

  return (
    <div className={styles.appShell}>
      <Sidebar />
      <main className={`${styles.mainShell} ${collapsed ? styles.mainShellCollapsed : ''}`}>
        <Header />
        <section className={styles.technicalWorkspace} aria-label="Dịch vụ kỹ thuật">
          <div className={styles.technicalPageTitle}>
            <div><Settings size={17} /><strong>Thông tin dịch vụ kỹ thuật</strong></div>
            <label className={styles.technicalSearch}>
              <Search size={15} />
              <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tìm tên dịch vụ..." aria-label="Tìm dịch vụ kỹ thuật" />
            </label>
          </div>

          <div className={styles.technicalTableWrap}>
            <table className={styles.technicalTable}>
              <colgroup>
                <col className={styles.colIndex} /><col className={styles.colTim} /><col className={styles.colName} /><col className={styles.colDepartment} />
                <col className={styles.colNote} /><col className={styles.colQuantity} /><col className={styles.colPrice} /><col className={styles.colTotal} />
                <col className={styles.colCoverage} /><col className={styles.colObject} />
              </colgroup>
              <thead>
                <tr>
                  <th>STT</th><th>TÌM</th><th>TÊN DỊCH VỤ</th><th>PHÒNG THỰC HIỆN</th><th>GHI CHÚ</th><th>SL</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th><th>TL (%)</th><th>ĐT</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const selected = row.id === selectedId
                  return (
                    <tr key={row.id} className={selected ? styles.technicalRowSelected : ''} onClick={() => setSelectedId(row.id)}>
                      <td className={styles.indexCell}>{row.id}</td>
                      <td><input value={row.tim} onChange={(event) => updateRow(row.id, 'tim', event.target.value)} aria-label={`Tìm dòng ${row.id}`} /></td>
                      <td className={styles.serviceNameCell} title={row.name}>{row.name}</td>
                      <td>
                        <select value={row.department} onChange={(event) => updateRow(row.id, 'department', event.target.value)} aria-label={`Phòng thực hiện dòng ${row.id}`}>
                          <option>XN01 - Phòng Xét Nghiệm</option><option>PDDT - Phòng Đo Điện Tim</option><option>2001 - Phòng Siêu Âm</option>
                        </select>
                      </td>
                      <td><input value={row.note} onChange={(event) => updateRow(row.id, 'note', event.target.value)} aria-label={`Ghi chú dòng ${row.id}`} /></td>
                      <td><input className={styles.numberInput} type="number" min="1" value={row.quantity} onChange={(event) => updateRow(row.id, 'quantity', Number(event.target.value) || 1)} aria-label={`Số lượng dòng ${row.id}`} /></td>
                      <td className={styles.moneyCell}>{row.unitPrice}</td>
                      <td className={styles.moneyCell}>{row.total}</td>
                      <td><input className={styles.numberInput} value={row.coverage} onChange={(event) => updateRow(row.id, 'coverage', event.target.value)} aria-label={`Tỷ lệ dòng ${row.id}`} /></td>
                      <td>
                        <select value={row.object} onChange={(event) => updateRow(row.id, 'object', event.target.value)} aria-label={`Đối tượng dòng ${row.id}`}>
                          <option>1.BH</option><option>2.VP</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
                {!visibleRows.length && <tr><td colSpan={10} className={styles.noTechnicalResults}>Không tìm thấy dịch vụ phù hợp.</td></tr>}
              </tbody>
            </table>
          </div>

          <footer className={styles.technicalActionBar}>
            <label className={styles.templateField}>DV mẫu:
              <select value={template} onChange={(event) => setTemplate(event.target.value)} aria-label="Dịch vụ mẫu">
                <option>Chọn...</option><option>Gói xét nghiệm cơ bản</option><option>Gói theo dõi thai kỳ</option>
              </select>
            </label>
            <div className={styles.technicalActions}>
              <button type="button" className={styles.technicalButtonSave} onClick={() => { setIsEditing(false); notify('Đã lưu danh sách dịch vụ') }}><Save size={15} />Lưu</button>
              <button type="button" className={styles.technicalButtonEdit} onClick={() => setIsEditing(true)}><Pencil size={15} />Sửa</button>
              <button type="button" className={styles.technicalButtonCancel} onClick={() => { setRows(technicalServices); setIsEditing(false); notify('Đã hủy thay đổi') }}><CircleX size={15} />Hủy</button>
              <button type="button" className={styles.technicalButtonPrint} onClick={() => void openLabPrintPreview()}><Printer size={15} />In phiếu xét nghiệm tổng hợp</button>


              <button type="button" className={styles.technicalButtonLabReport} onClick={() => setLabReportOpen(true)}><FileText size={15} />Phiếu xét nghiệm tổng hợp</button>
              <button type="button" className={styles.technicalButtonDelete} onClick={() => { setRows((current) => current.filter((row) => row.id !== selectedId)); notify(`Đã xóa ${selectedName}`) }}><Trash2 size={15} />Xóa dịch vụ</button>
            </div>
          </footer>
          {!isEditing && <span className={styles.technicalEditHint}>Chọn “Sửa” để chỉnh sửa số lượng, ghi chú hoặc đối tượng.</span>}
          {labPrintOpen && (
            <div className={styles.labReportBackdrop} onMouseDown={closeLabPrint}>
              <section className={`${styles.labReportModal} ${styles.labPrintModal}`} role="dialog" aria-modal="true" aria-labelledby="lab-print-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className={styles.labReportModalHeader}>
                  <div><Printer size={18} /><div><strong id="lab-print-title">Phiếu xét nghiệm tổng hợp</strong><small>PDF chuẩn A4 · 5 trang</small></div></div>
                  <button type="button" className={styles.labReportClose} onClick={closeLabPrint} aria-label="Đóng phiếu in"><X size={19} /></button>
                </header>
                <div className={styles.labPrintViewer}>
                  {labPrintLoading && <div className={styles.labPrintState}><span className={styles.labPrintSpinner} /><strong>Đang tải PDF...</strong></div>}
                  {!labPrintLoading && labPrintError && <div className={styles.labPrintState}><Info size={28} /><strong>Không thể mở phiếu</strong><p>{labPrintError}</p><button type="button" onClick={() => void openLabPrintPreview()}>Thử lại</button></div>}
                  {!labPrintLoading && labPrintUrl && <iframe src={`${labPrintUrl}#toolbar=1&navpanes=0&view=FitH`} title="PDF phiếu xét nghiệm tổng hợp" />}
                </div>
                <footer className={styles.labReportFooter}>
                  <span>PDF gốc đầy đủ thông tin · Chỉ tài khoản đã đăng nhập được phép xem và in</span>
                  <button type="button" className={styles.technicalButtonPrint} onClick={openLabPdfForPrint} disabled={!labPrintUrl}><Printer size={15} />Mở PDF để in</button>
                </footer>
              </section>
            </div>
          )}          {labReportOpen && (
            <div className={styles.labReportBackdrop} onMouseDown={closeLabReport}>
              <section className={styles.labReportModal} role="dialog" aria-modal="true" aria-labelledby="lab-report-title" onMouseDown={(event) => event.stopPropagation()}>
                <header className={styles.labReportModalHeader}>
                  <div><FileText size={18} /><div><strong id="lab-report-title">Phiếu xét nghiệm tổng hợp</strong><small>Chỉ xử lý vùng kết quả và giá trị tham chiếu</small></div></div>
                  <button type="button" className={styles.labReportClose} onClick={closeLabReport} aria-label="Đóng phiếu xét nghiệm"><X size={19} /></button>
                </header>

                <div className={styles.labAgentLayout}>
                  <section className={styles.labDocumentPane} aria-label="Phiếu xét nghiệm đã che thông tin cá nhân">
                    <div className={styles.labPrivacyNotice}><ShieldCheck size={16} /><span><strong>Đã ẩn thông tin định danh</strong> Họ tên, ngày sinh, mã hồ sơ, địa chỉ, nhân viên y tế và khoa không được đưa vào agent.</span></div>
                    <div className={styles.labPagesViewport}>
                      {labReportPages.map((page, index) => {
                        const pageScanning = labScanStatus === 'scanning' && labScanPage === index
                        const referencedItem = abnormalLabComparisons.find((item) => item.page === page && item.name === highlightedLabName)
                        const referencePosition = referencedItem ? labReferencePositions[referencedItem.name] : undefined
                        return (
                          <article id={`lab-report-page-${page}`} className={`${styles.labReportPage} ${pageScanning ? styles.labReportPageScanning : ''} ${referencedItem ? styles.labReportPageReferenced : ''}`} key={page}>
                            <img src={`/templates/xn1-pages/page-${page}.png`} alt={`Trang ${page} phiếu xét nghiệm đã ẩn thông tin cá nhân`} />
                            {referencedItem && referencePosition && (
                              <span
                                className={styles.labRowHighlight}
                                style={{ top: `${referencePosition.top}%`, height: `${referencePosition.height}%` }}
                                aria-label={`Đang tô sáng hàng ${referencedItem.name}`}
                              />
                            )}
                            <div className={`${styles.labScanBounds} ${pageScanning ? styles.labScanBoundsActive : ''}`} aria-hidden="true">
                              {pageScanning && <span className={styles.labScanLine} />}
                            </div>
                            <span className={styles.labPageBadge}>Trang {page}/5</span>
                          </article>
                        )
                      })}
                    </div>
                  </section>

                  <aside className={styles.labAgentPanel} aria-label="Kết quả đối chiếu tự động">
                    <header className={styles.labAgentHeader}>
                      <div><img className={styles.labAgentBrandMark} src={thapRuaMark} alt="" aria-hidden="true" /><div><strong>Agent đối chiếu xét nghiệm</strong><small>So sánh xác định trước, AI chỉ biên tập câu chữ</small></div></div>
                      <span className={`${styles.labAgentStatus} ${labScanStatus === 'complete' ? styles.labAgentStatusComplete : labScanBusy ? styles.labAgentStatusActive : ''}`}>
                        {labScanStatus === 'idle' && 'Chưa quét'}
                        {labScanStatus === 'scanning' && `Đang quét ${labScanPage + 1}/5`}
                        {labScanStatus === 'formatting' && 'Đang biên tập'}
                        {labScanStatus === 'complete' && 'Hoàn tất'}
                      </span>
                    </header>

                    <div className={styles.labProgressTrack} aria-label={`Tiến độ ${Math.round(labScanProgress)}%`}><span style={{ width: `${labScanProgress}%` }} /></div>

                    {labScanStatus === 'idle' ? (
                      <div className={styles.labAgentEmpty}><ScanLine size={34} /><strong>Sẵn sàng quét 5 trang kết quả</strong><p>Agent chỉ đọc tên xét nghiệm, kết quả, đơn vị và khoảng tham chiếu. Không gửi thông tin định danh.</p></div>
                    ) : (
                      <>
                        {labScanStatus === 'complete' && abnormalLabComparisons.length > 0 && (
                          <section className={styles.labReferenceList} aria-label="Danh sách chỉ số bất thường">
                            <header className={styles.labReferenceHeader}>
                              <div><strong>{abnormalLabComparisons.length} chỉ số bất thường</strong><small>Bấm “Tham chiếu” để tìm nhanh trên phiếu</small></div>
                              <div className={styles.labReferenceCounts}>
                                <span className={styles.labCountHigh}><b>{labSummaryCounts.high}</b> Cao</span>
                                <span className={styles.labCountLow}><b>{labSummaryCounts.low}</b> Thấp</span>
                              </div>
                            </header>
                            <div className={styles.labReferenceRows}>
                              {abnormalLabComparisons.map((item) => (
                                <article className={highlightedLabName === item.name ? styles.labReferenceItemActive : ''} key={item.name}>
                                  <span><b>{item.name}</b><small>{item.result}{item.unit ? ` ${item.unit}` : ''} · {item.status === 'high' ? 'Cao' : 'Thấp'}</small></span>
                                  <button type="button" onClick={() => showLabReference(item)} aria-label={`Tham chiếu hàng ${item.name}`}><Search size={13} />Tham chiếu</button>
                                </article>
                              ))}
                            </div>
                          </section>
                        )}
                        <section className={styles.labNarrativeField} aria-label="Bản nháp nhận xét xét nghiệm">
                          <header className={styles.labNarrativeHeader}>
                            <span><strong>Nội dung bác sĩ duyệt</strong><small>Có thể chỉnh sửa trước khi sao chép</small></span>

                          </header>
                          <textarea aria-label="Nội dung nhận xét xét nghiệm" value={labAnalysisText} onChange={(event) => setLabAnalysisText(event.target.value)} placeholder={labScanBusy ? 'Đang đối chiếu số liệu...' : 'Kết quả sẽ xuất hiện tại đây'} />
                        </section>
                        <p className={styles.labClinicalWarning}>Bản nháp hỗ trợ nhập liệu. Bác sĩ phải kiểm tra và duyệt trước khi đưa vào hồ sơ bệnh án.</p>
                      </>
                    )}
                  </aside>
                </div>

                <footer className={styles.labReportFooter}>
                  <span>
                    {labScanStatus === 'idle' && 'PDF mẫu XN1 - dữ liệu định danh đã được che'}
                    {labScanStatus === 'scanning' && `Đang quét vùng kết quả trang ${labScanPage + 1}/5`}
                    {labScanStatus === 'formatting' && 'Đã đối chiếu số liệu, đang biên tập bản nháp'}
                    {labScanStatus === 'complete' && 'Hoàn tất - bác sĩ có thể chỉnh sửa hoặc sao chép'}
                  </span>
                  <button type="button" className={styles.technicalButtonPrint} onClick={startLabScan} disabled={labScanBusy}><ScanLine size={15} />{labScanStatus === 'complete' ? 'Quét lại xét nghiệm' : 'Quét xét nghiệm tự động'}</button>
                </footer>
              </section>
            </div>
          )}        </section>
      </main>
      {toastMessage && <div className={styles.toast}><Activity size={16} />{toastMessage}</div>}
    </div>
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
      <Route path="/dich-vu-ky-thuat" element={<ProtectedRoute><TechnicalServicesWorkspace /></ProtectedRoute>} />
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












