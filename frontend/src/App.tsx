import { useEffect, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
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
  CircleX,
  ClipboardList,
  ClipboardPlus,
  Database,
  Eraser,
  Eye,
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
  Minimize2,
  Pencil,
  Pill,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Save,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  Trash2,
  TriangleAlert,
  UserRoundCheck,
  Users,
  X,
} from 'lucide-react'
import { mockPatients, statusSummary } from './data/mockPatients'
import { medications, type Medication } from './data/medications'
import { buildCheckerRecord, checkClinicalRecord, generateCounseling } from './lib/aiCheck'
import LoginPage, { AuthLoadingScreen } from './pages/LoginPage'
import AdminDashboard from './pages/AdminDashboard'
import { useAuthStore } from './store/useAuthStore'
import { useClinicalStore } from './store/useClinicalStore'
import { fetchLabSummaryPdf, requestLabNarrative } from './api/labAnalysisApi'
import { bookFollowUp, fetchAppointmentSchedule, suggestFollowUp, type ScheduleResponse, type SuggestFollowUpResponse } from './api/appointmentsApi'
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
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authUser?.role ?? '')
  const displayName = authUser?.fullName ?? (isAdmin ? 'Quản trị viên' : 'Bác sĩ')
  const displayUnit = authUser?.department ?? (isAdmin ? 'Quản trị hệ thống' : 'Khoa lâm sàng')
  const initials = isAdmin ? 'QT' : displayName.split(' ').slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN')

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
        {['ADMIN', 'SUPER_ADMIN'].includes(authUser?.role ?? '') && (
          <NavLink to="/admin" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.navLinkActive : ''}`}>
            <ShieldCheck size={18} /><span>Quản trị hệ thống</span>
          </NavLink>
        )}
      </nav>
      <div className={styles.sidebarFooter}>
        <div className={styles.sidebarDoctor} title={authUser?.email ?? undefined}>
          <span>{initials}</span>
          <div><strong>{displayName}</strong><small>{displayUnit}</small></div>
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
  const authUser = useAuthStore((state) => state.user)
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(authUser?.role ?? '')
  const displayName = authUser?.fullName ?? (isAdmin ? 'Quản trị viên' : 'Bác sĩ')
  const displayUnit = authUser?.department ?? (isAdmin ? 'Quản trị hệ thống' : 'Khoa lâm sàng')
  const initials = isAdmin ? 'QT' : displayName.split(' ').slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi-VN')
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
          <span className={styles.avatar}>{initials}</span>
          <div><strong>{displayName}</strong><small>{displayUnit}</small></div>
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
  type?: 'text' | 'number'
  min?: number
  max?: number
  step?: number | 'any'
  onChange?: (value: string) => void
}

function Field({ label, value, unit, className = '', required = false, type = 'text', min, max, step, onChange }: FieldProps) {
  return (
    <label className={`${styles.field} ${className}`}>
      <span>{label}{required && <b>*</b>}</span>
      <div className={`${styles.inputShell} ${onChange ? styles.editableInputShell : ''}`}>
        <input
          type={type}
          min={min}
          max={max}
          step={step}
          value={value ?? ''}
          readOnly={!onChange}
          onChange={onChange ? (event) => onChange(event.target.value) : undefined}
          aria-label={label}
        />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  )
}

function BloodPressureField({ systolic, diastolic, onChange }: {
  systolic: number | null
  diastolic: number | null
  onChange: (field: 'systolicBloodPressure' | 'diastolicBloodPressure', value: string) => void
}) {
  return (
    <label className={styles.field}>
      <span>Huyết áp</span>
      <div className={`${styles.inputShell} ${styles.editableInputShell} ${styles.bloodPressureShell}`}>
        <input type="number" min={0} max={300} value={systolic ?? ''} onChange={(event) => onChange('systolicBloodPressure', event.target.value)} aria-label="Huyết áp tâm thu" />
        <i aria-hidden="true">/</i>
        <input type="number" min={0} max={200} value={diastolic ?? ''} onChange={(event) => onChange('diastolicBloodPressure', event.target.value)} aria-label="Huyết áp tâm trương" />
        <em>mmHg</em>
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

type CriterionApproval = {
  snapshot: string
  runId: string
  approvedAt: number
}


function criterionSnapshot(itemId: string, patient: PatientRecord, notes: AiDocumentNotes) {
  const config = remediationFor(itemId)
  if (config.mode !== 'structured') return JSON.stringify({ field: config.field, value: config.field ? notes[config.field] : '' })
  const vitalSigns = patient.vitalSigns
  if (config.section === 'circulation') {
    return JSON.stringify({
      pulse: vitalSigns.pulse,
      systolicBloodPressure: vitalSigns.systolicBloodPressure,
      diastolicBloodPressure: vitalSigns.diastolicBloodPressure,
    })
  }
  if (config.section === 'temperature') return JSON.stringify({ temperature: vitalSigns.temperature })
  if (config.section === 'respiration') return JSON.stringify({ respiratoryRate: vitalSigns.respiratoryRate })
  if (config.section === 'anthropometrics') return JSON.stringify({ height: vitalSigns.height, weight: vitalSigns.weight, bmi: vitalSigns.bmi })
  return JSON.stringify({ section: config.section })
}

function AiCheckModal({ state, patient, notes, onEditNotes, onEditVitals, onApproveCriterion, onMinimize, onClose }: {
  state: AiCheckState
  patient: PatientRecord
  notes: AiDocumentNotes
  onEditNotes: (field: keyof AiDocumentNotes, value: string) => void
  onEditVitals: (field: 'pulse' | 'respiratoryRate' | 'systolicBloodPressure' | 'diastolicBloodPressure' | 'temperature' | 'height' | 'weight', value: number | null) => void
  onClose: () => void
  onApproveCriterion: (itemId: string) => void
  onMinimize: () => void
}) {
  const { loading, error, data } = state
  const result = data?.result
  const catalog = data?.criteria_catalog ?? {}
  const failures = result?.khong_dat ?? []
  const passed = result?.ket_luan === 'DAT'
  const criticalSet = new Set(result?.vi_pham_critical ?? [])
  const [scanRuleIndex, setScanRuleIndex] = useState(0)
  useEffect(() => {
    if (!loading) return
    const timer = window.setInterval(() => setScanRuleIndex((index) => (index + 1) % aiScanRuleLabels.length), 720)
    return () => window.clearInterval(timer)
  }, [loading])

  const previewSourceRef = useRef<HTMLDivElement>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const failureGroup = (itemId: string) => remediationFor(itemId).section
  const groupFailures = (group: string) => failures.filter((failure) => failureGroup(failure.item_id) === group)

  const printClinicalPreview = () => {
    const paper = previewSourceRef.current?.querySelector(`.${styles.aiPaper}`)
    if (!paper) return
    const printWindow = window.open('', '_blank', 'width=980,height=760')
    if (!printWindow) return
    printWindow.opener = null
    const stylesheetMarkup = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML)
      .join('\n')
    printWindow.document.open()
    printWindow.document.write(`<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Hồ sơ khám bệnh</title>${stylesheetMarkup}<style>@page{size:A4 portrait;margin:12mm}body{margin:0;background:#fff}.${styles.aiPaper}{width:100%;min-height:0;margin:0;padding:0;box-shadow:none;overflow:visible}</style></head><body>${paper.outerHTML}</body></html>`)
    printWindow.document.close()
    printWindow.setTimeout(() => {
      printWindow.focus()
      printWindow.print()
    }, 300)
  }

  const renderDirectEditable = (field: keyof AiDocumentNotes, scanning: boolean, editable: boolean) => {
    const value = notes[field]
    if (scanning || !editable) return <p>{value || 'Chưa ghi nhận thông tin.'}</p>
    return (
      <div
        className={styles.aiDirectField}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        tabIndex={0}
        title="Nhấn để chỉnh sửa trực tiếp trên hồ sơ"
        data-placeholder="Nhấn để bổ sung nội dung trực tiếp…"
        onBlur={(event) => onEditNotes(field, event.currentTarget.innerText.trim())}
      >{value}</div>
    )
  }

  const renderPaper = (scanning = false, editable = true) => (
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
        {renderDirectEditable('clinicalProgress', scanning, editable)}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Dấu hiệu sinh tồn và khám toàn thân</h4>
        {!scanning && groupFailures('circulation').length > 0 ? (
          <div className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor}`}>
            <label>Mạch <input type="number" value={patient.vitalSigns.pulse ?? ''} onChange={(event) => onEditVitals('pulse', event.target.value ? Number(event.target.value) : null)} /> lần/phút</label>
            <label>Huyết áp <input type="number" value={patient.vitalSigns.systolicBloodPressure ?? ''} onChange={(event) => onEditVitals('systolicBloodPressure', event.target.value ? Number(event.target.value) : null)} /> / <input type="number" value={patient.vitalSigns.diastolicBloodPressure ?? ''} onChange={(event) => onEditVitals('diastolicBloodPressure', event.target.value ? Number(event.target.value) : null)} /> mmHg</label>
          </div>
        ) : <p>Mạch: {patient.vitalSigns.pulse ?? '—'} lần/phút · Huyết áp: {patient.vitalSigns.systolicBloodPressure ?? '—'}/{patient.vitalSigns.diastolicBloodPressure ?? '—'} mmHg</p>}
        {!scanning && groupFailures('respiration').length > 0 ? (
          <div className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor}`}><label>Nhịp thở <input type="number" value={patient.vitalSigns.respiratoryRate ?? ''} onChange={(event) => onEditVitals('respiratoryRate', event.target.value ? Number(event.target.value) : null)} /> lần/phút</label></div>
        ) : <p>Nhịp thở: {patient.vitalSigns.respiratoryRate ?? '—'} lần/phút</p>}
        {!scanning && groupFailures('temperature').length > 0 ? (
          <div className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor}`}><label>Nhiệt độ <input type="number" step="0.1" value={patient.vitalSigns.temperature ?? ''} onChange={(event) => onEditVitals('temperature', event.target.value ? Number(event.target.value) : null)} /> °C</label></div>
        ) : patient.vitalSigns.temperature ? <p>Nhiệt độ: {patient.vitalSigns.temperature} °C</p> : null}
        {!scanning && groupFailures('anthropometrics').length > 0 ? (
          <div className={`${styles.aiInlineFinding} ${styles.aiVitalsEditor}`}>
            <label>Chiều cao <input type="number" value={patient.vitalSigns.height ?? ''} onChange={(event) => onEditVitals('height', event.target.value ? Number(event.target.value) : null)} /> cm</label>
            <label>Cân nặng <input type="number" value={patient.vitalSigns.weight ?? ''} onChange={(event) => onEditVitals('weight', event.target.value ? Number(event.target.value) : null)} /> kg</label>
            <span>BMI: {patient.vitalSigns.bmi ?? '—'}</span>
          </div>
        ) : <p>Chiều cao: {patient.vitalSigns.height ?? '—'} cm · Cân nặng: {patient.vitalSigns.weight ?? '—'} kg · BMI: {patient.vitalSigns.bmi ?? '—'}</p>}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Chẩn đoán</h4>
        <p><b>{patient.diagnoses.primaryCode}</b> — {patient.diagnoses.primaryDescription}</p>
        {(hasSupplementaryDiagnosis(patient.diagnoses.primaryCode, patient.diagnoses.primaryDescription, notes.diagnosisSummary) || (!scanning && groupFailures('diagnosis').length > 0))
          && renderDirectEditable('diagnosisSummary', scanning, editable)}
      </section>
      <section className={styles.aiPaperSection}>
        <h4>Hướng xử trí</h4>
        {renderDirectEditable('treatmentPlan', scanning, editable)}
      </section>
      <section className={styles.aiPaperSection}><h4>Tư vấn và dặn dò</h4>{renderDirectEditable('counselingRecord', scanning, editable)}</section>
      <div className={styles.aiPaperSign}><span>Bác sĩ điều trị</span><strong className={scanning ? styles.aiPiiRedacted : ''}>{patient.doctor}</strong></div>
    </div>
  )

  return (
    <div className={styles.aiModalOverlay} role="dialog" aria-modal="true" aria-label="Kết quả kiểm tra hồ sơ bằng AI">
      <div className={`${styles.aiModal} ${styles.aiModalWorkspace}`}>
        <header className={styles.aiModalHead}>
          <div><ShieldCheck size={17} /><h2>Kiểm tra tuân thủ hồ sơ (AI)</h2></div>
          <div className={styles.aiModalHeadActions}>
            <button type="button" onClick={onMinimize} aria-label="Thu nhỏ trợ lý AI"><Minimize2 size={16} /></button>
            <button type="button" onClick={onClose} aria-label="Đóng kết quả kiểm tra"><X size={16} /></button>
          </div>
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
                  <div>
                    <strong>{passed ? 'HỒ SƠ ĐẠT' : 'HỒ SƠ CHƯA ĐẠT'}</strong>
                    <span>{passed ? 'Không còn tiêu chí cần bổ sung' : `${failures.length} tiêu chí cần bổ sung`}</span>
                  </div>
                </div>
                {failures.length === 0 && (
                  <div className={styles.aiCompletionCard}>
                    <span><CircleCheck size={24} /></span>
                    <strong>Hồ sơ đã hoàn thiện</strong>
                    <p>Tất cả tiêu chí vi phạm đã được bác sĩ kiểm tra và xác nhận.</p>
                    <div>
                      <button type="button" onClick={() => setPreviewOpen(true)}><Eye size={14} />Xem trước hồ sơ chuẩn</button>
                      <button type="button" onClick={printClinicalPreview}><Printer size={14} />In / Lưu PDF</button>
                    </div>
                  </div>
                )}
                {failures.length > 0 && <ul className={styles.aiExceptionList}>
                  {failures.map((failure) => (
                    <li key={failure.item_id}>

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
                          ? 'Sửa trực tiếp nội dung được đánh dấu trên hồ sơ bên trái'
                          : 'Cập nhật giá trị tại vùng được đánh dấu bên trái')}
                      </p>
                      <div className={styles.aiCriterionActions}>
                        <button type="button" onClick={() => onApproveCriterion(failure.item_id)}>
                          <CircleCheck size={13} />Approve
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>}
              </aside>
            </div>
          )}
        </div>
        {failures.length === 0 && <div className={styles.aiPrintSource} ref={previewSourceRef}>{renderPaper(false, false)}</div>}
        {previewOpen && (
          <div className={styles.aiPreviewOverlay} role="dialog" aria-modal="true" aria-label="Xem trước hồ sơ chuẩn">
            <section className={styles.aiPreviewModal}>
              <header>
                <div><FileText size={17} /><strong>Xem trước hồ sơ chuẩn</strong></div>
                <div>
                  <button type="button" onClick={printClinicalPreview}><Printer size={15} />In / Lưu PDF</button>
                  <button type="button" onClick={() => setPreviewOpen(false)} aria-label="Đóng xem trước"><X size={16} /></button>
                </div>
              </header>
              <div className={styles.aiPreviewBody}>{renderPaper(false, false)}</div>
            </section>
          </div>
        )}
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

type AppointmentState = {
  open: boolean
  loading: boolean
  error: string
  data: SuggestFollowUpResponse | null
  selected: string
  booking: boolean
  bookedDate: string
}

const APPOINTMENT_LOAD_LABELS: Record<string, string> = {
  thua: 'Còn thưa',
  vua: 'Vừa phải',
  dong: 'Khá đông',
  day: 'Đã đầy',
}

const APPOINTMENT_SOURCE_LABELS: Record<string, string> = {
  ai: 'AI phân tích theo hồ sơ',
  treatment_plan: 'theo hướng xử trí',
  pregnancy_weeks: 'theo tuổi thai',
  default: 'theo lịch khám định kỳ',
}

const formatAppointmentDate = (iso: string) => {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

function AppointmentModal({
  patient,
  state,
  onSelect,
  onConfirm,
  onClose,
}: {
  patient: PatientRecord
  state: AppointmentState
  onSelect: (date: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  const { loading, error, data, selected, booking, bookedDate } = state
  return createPortal(
    <div className={styles.aiModalOverlay} role="dialog" aria-modal="true" aria-label="Đặt lịch tái khám">
      <div className={`${styles.aiModal} ${styles.apptModal}`}>
        <header className={styles.aiModalHead}>
          <div><CalendarDays size={17} /><h2>Đặt lịch tái khám</h2></div>
          <button type="button" onClick={onClose} aria-label="Đóng đặt lịch tái khám"><X size={16} /></button>
        </header>
        <div className={styles.apptBody}>
          {loading && (
            <div className={styles.aiLoading}>
              <LoaderCircle size={22} className={styles.aiSpinner} />
              <p>AI đang phân tích hồ sơ (đã ẩn thông tin định danh) để đề xuất lịch tái khám...</p>
            </div>
          )}
          {!loading && error && <div className={styles.aiError}><TriangleAlert size={16} /><p>{error}</p></div>}
          {!loading && !error && bookedDate && (
            <div className={styles.apptSuccess}>
              <CircleCheck size={22} />
              <div>
                <strong>Đã hẹn tái khám ngày {formatAppointmentDate(bookedDate)}</strong>
                <p>Bệnh nhân {patient.fullName} ({patient.medicalId}). Lịch đã được ghi nhận vào tải của ngày hẹn.</p>
              </div>
            </div>
          )}
          {!loading && !error && !bookedDate && data && (
            <>
              <p className={styles.apptIntro}>
                Hẹn sau <strong>{data.interval_days} ngày</strong> ({APPOINTMENT_SOURCE_LABELS[data.interval_source]}),
                ngày lý tưởng <strong>{formatAppointmentDate(data.ideal_date)}</strong>.
              </p>
              {data.reason && <p className={styles.apptReason}>{data.reason}</p>}
              <p className={styles.apptIntro}>
                Các ngày dưới đây đã cân bằng theo tải phòng khám — bác sĩ chọn và xác nhận:
              </p>
              <div className={styles.apptList}>
                {data.candidates.map((candidate) => {
                  const full = candidate.label === 'day'
                  const isSelected = candidate.date === selected
                  return (
                    <button
                      key={candidate.date}
                      type="button"
                      disabled={full}
                      onClick={() => onSelect(candidate.date)}
                      className={`${styles.apptRow} ${isSelected ? styles.apptRowSelected : ''}`}
                    >
                      <span className={styles.apptDay}>
                        <strong>{candidate.weekday}</strong> {formatAppointmentDate(candidate.date)}
                        {candidate.recommended && <em className={styles.apptRecommended}>Đề xuất</em>}
                      </span>
                      <span className={styles.apptLoad}>
                        <span className={styles.apptBar}>
                          <span
                            className={`${styles.apptBarFill} ${styles[`apptTone_${candidate.label}`]}`}
                            style={{ width: `${Math.min(100, Math.round((candidate.load / candidate.capacity) * 100))}%` }}
                          />
                        </span>
                        {candidate.load}/{candidate.capacity} · {APPOINTMENT_LOAD_LABELS[candidate.label]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
        <footer className={styles.apptFooter}>
          {!bookedDate && data && !loading && !error && (
            <button type="button" className={styles.apptConfirm} disabled={!selected || booking} onClick={onConfirm}>
              {booking ? <LoaderCircle size={15} className={styles.aiSpinner} /> : <CircleCheck size={15} />}
              {selected ? `Xác nhận hẹn ngày ${formatAppointmentDate(selected)}` : 'Chọn một ngày hẹn'}
            </button>
          )}
          <span className={styles.aiDisclaimer}>Hệ thống chỉ đề xuất ngày; bác sĩ quyết định và có thể chọn ngày khác.</span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}

function ClinicalRecord({ patient }: { patient: PatientRecord }) {
  const notify = useClinicalStore((state) => state.notify)
  const [vitalEdits, setVitalEdits] = useState(() => ({ ...patient.vitalSigns }))
  const [personnelEdits, setPersonnelEdits] = useState(() => ({
    doctor: patient.doctor,
    nurseOne: patient.nurseOne,
    nurseTwo: patient.nurseTwo,
  }))
  useEffect(() => {
    setVitalEdits({ ...patient.vitalSigns })
    setPersonnelEdits({ doctor: patient.doctor, nurseOne: patient.nurseOne, nurseTwo: patient.nurseTwo })
  }, [patient])
  const vitalSigns = { ...vitalEdits }
  const editablePatient = { ...patient, ...personnelEdits, vitalSigns }

  const updateNumericVital = (field: Exclude<keyof PatientRecord['vitalSigns'], 'breastfeeding'>, rawValue: string) => {
    setVitalEdits((current) => {
      const parsed = rawValue === '' ? null : Number(rawValue)
      const next = { ...current, [field]: parsed !== null && Number.isFinite(parsed) ? parsed : null }

      if (field === 'height' || field === 'weight') {
        next.bmi = next.height && next.weight ? Number((next.weight / ((next.height / 100) ** 2)).toFixed(1)) : null
        next.bsa = next.height && next.weight ? Number(Math.sqrt((next.height * next.weight) / 3600).toFixed(2)) : null
      }

      return next
    })
  }

  const resetClinicalEdits = () => {
    setVitalEdits({ ...patient.vitalSigns })
    setPersonnelEdits({ doctor: patient.doctor, nurseOne: patient.nurseOne, nurseTwo: patient.nurseTwo })
    notify('Đã hủy thay đổi')
  }
  const progressRef = useRef<HTMLTextAreaElement>(null)
  const planRef = useRef<HTMLTextAreaElement>(null)
  const diagnosisSummaryRef = useRef<HTMLTextAreaElement>(null)
  const [counselingText, setCounselingText] = useState(patient.counselingRecord)
  const [counselingLoading, setCounselingLoading] = useState(false)
  const [counselingOpen, setCounselingOpen] = useState(false)
  const [appointment, setAppointment] = useState<AppointmentState>({ open: false, loading: false, error: '', data: null, selected: '', booking: false, bookedDate: '' })
  const patientIdRef = useRef(patient.medicalId)
  const [aiCheck, setAiCheck] = useState<AiCheckState>({ open: false, loading: false, error: '', data: null })
  const [aiCheckMinimized, setAiCheckMinimized] = useState(false)
  const [approvedCriteriaByPatient, setApprovedCriteriaByPatient] = useState<Record<string, Record<string, CriterionApproval>>>({})
  const aiBubbleRef = useRef<HTMLButtonElement>(null)
  const aiBubbleDragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number; startX: number; startY: number; moved: boolean } | null>(null)
  const aiBubbleSuppressClickRef = useRef(false)
  const [aiBubblePosition, setAiBubblePosition] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    patientIdRef.current = patient.medicalId
    setCounselingText(patient.counselingRecord)
    setCounselingLoading(false)
    setCounselingOpen(false)
    setAppointment({ open: false, loading: false, error: '', data: null, selected: '', booking: false, bookedDate: '' })
    setAiCheck({ open: false, loading: false, error: '', data: null })
    setAiCheckMinimized(false)
  }, [patient.medicalId, patient.counselingRecord])

  useEffect(() => {
    const keepBubbleInViewport = () => {
      const bubble = aiBubbleRef.current
      if (!bubble) return
      setAiBubblePosition((position) => position ? {
        x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - bubble.offsetWidth - 8)),
        y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - bubble.offsetHeight - 8)),
      } : null)
    }
    window.addEventListener('resize', keepBubbleInViewport)
    return () => window.removeEventListener('resize', keepBubbleInViewport)
  }, [])

  useEffect(() => {
    if (!aiCheckMinimized) return
    const frame = window.requestAnimationFrame(() => {
      const bubble = aiBubbleRef.current
      if (!bubble) return
      setAiBubblePosition((position) => position ? {
        x: Math.min(Math.max(8, position.x), Math.max(8, window.innerWidth - bubble.offsetWidth - 8)),
        y: Math.min(Math.max(8, position.y), Math.max(8, window.innerHeight - bubble.offsetHeight - 8)),
      } : null)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [aiCheckMinimized])

  const startAiBubbleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const rect = event.currentTarget.getBoundingClientRect()
    event.currentTarget.setPointerCapture(event.pointerId)
    aiBubbleSuppressClickRef.current = false
    aiBubbleDragRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    }
    setAiBubblePosition({ x: rect.left, y: rect.top })
  }

  const moveAiBubble = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = aiBubbleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) return
    drag.moved = true
    const maxX = Math.max(8, window.innerWidth - event.currentTarget.offsetWidth - 8)
    const maxY = Math.max(8, window.innerHeight - event.currentTarget.offsetHeight - 8)
    setAiBubblePosition({
      x: Math.min(Math.max(8, event.clientX - drag.offsetX), maxX),
      y: Math.min(Math.max(8, event.clientY - drag.offsetY), maxY),
    })
  }

  const finishAiBubbleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = aiBubbleDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    aiBubbleSuppressClickRef.current = drag.moved
    aiBubbleDragRef.current = null
  }

  const cancelAiBubbleDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (aiBubbleDragRef.current?.pointerId !== event.pointerId) return
    aiBubbleDragRef.current = null
    aiBubbleSuppressClickRef.current = false
  }

  const openAiCheckFromBubble = () => {
    if (aiBubbleSuppressClickRef.current) {
      aiBubbleSuppressClickRef.current = false
      return
    }
    setAiCheckMinimized(false)
  }

  const readAiNotes = (): AiDocumentNotes => ({
    clinicalProgress: progressRef.current?.value ?? patient.clinicalProgress,
    treatmentPlan: planRef.current?.value ?? patient.treatmentPlan,
    diagnosisSummary: diagnosisSummaryRef.current?.value ?? patient.diagnoses.summary,
    counselingRecord: counselingText,
  })

  const currentNotes = readAiNotes()

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

  const handleOpenAppointment = async () => {
    const forPatient = patient.medicalId
    setAppointment({ open: true, loading: true, error: '', data: null, selected: '', booking: false, bookedDate: '' })
    try {
      const record = buildCheckerRecord(patient, {
        clinicalProgress: progressRef.current?.value ?? patient.clinicalProgress,
        treatmentPlan: planRef.current?.value ?? patient.treatmentPlan,
        diagnosisSummary: diagnosisSummaryRef.current?.value ?? patient.diagnoses.summary,
        counselingRecord: counselingText,
      })
      const data = await suggestFollowUp({ record })
      if (patientIdRef.current !== forPatient) return
      const recommended = data.candidates.find((candidate) => candidate.recommended)
      setAppointment((state) => ({ ...state, loading: false, data, selected: recommended?.date ?? '' }))
    } catch (error) {
      if (patientIdRef.current !== forPatient) return
      const message = error instanceof Error ? error.message : 'Lỗi không xác định khi tính lịch tái khám'
      setAppointment((state) => ({ ...state, loading: false, error: message }))
    }
  }

  const handleConfirmAppointment = async () => {
    if (!appointment.selected) return
    const forPatient = patient.medicalId
    setAppointment((state) => ({ ...state, booking: true }))
    try {
      const result = await bookFollowUp({
        medicalId: patient.medicalId,
        patientName: patient.fullName,
        date: appointment.selected,
      })
      if (patientIdRef.current !== forPatient) return
      setAppointment((state) => ({ ...state, booking: false, bookedDate: result.appointment.date }))
      notify(`Đã hẹn tái khám ngày ${formatAppointmentDate(result.appointment.date)}`)
    } catch (error) {
      if (patientIdRef.current !== forPatient) return
      const message = error instanceof Error ? error.message : 'Không đặt được lịch hẹn'
      setAppointment((state) => ({ ...state, booking: false, error: message }))
    }
  }

  const runAiCheck = async () => {
    const forPatient = patient.medicalId
    const notes = readAiNotes()
    const approvals = approvedCriteriaByPatient[forPatient] ?? {}
    const validApprovedIds = Object.entries(approvals)
      .filter(([itemId, approval]) => approval.snapshot === criterionSnapshot(itemId, editablePatient, notes))
      .map(([itemId]) => itemId)
    const staleIds = Object.keys(approvals).filter((itemId) => !validApprovedIds.includes(itemId))
    if (staleIds.length > 0) {
      setApprovedCriteriaByPatient((current) => {
        const nextForPatient = { ...(current[forPatient] ?? {}) }
        staleIds.forEach((itemId) => delete nextForPatient[itemId])
        return { ...current, [forPatient]: nextForPatient }
      })
    }

    setAiCheckMinimized(false)
    setAiCheck({ open: true, loading: true, error: '', data: null })
    try {
      const record = buildCheckerRecord(editablePatient, notes)
      const data = await checkClinicalRecord(record, { excludeCriteria: validApprovedIds })
      if (patientIdRef.current !== forPatient) return
      setAiCheck((state) => ({ ...state, loading: false, data }))
    } catch (error) {
      if (patientIdRef.current !== forPatient) return
      const message = error instanceof Error ? error.message : 'Lỗi không xác định khi kiểm tra hồ sơ'
      setAiCheck((state) => ({ ...state, loading: false, error: message }))
    }
  }

  const approveCriterion = (itemId: string) => {
    const forPatient = patient.medicalId
    const notes = readAiNotes()
    setApprovedCriteriaByPatient((current) => ({
      ...current,
      [forPatient]: {
        ...(current[forPatient] ?? {}),
        [itemId]: {
          snapshot: criterionSnapshot(itemId, editablePatient, notes),
          runId: aiCheck.data?.run_id ?? 'manual',
          approvedAt: Date.now(),
        },
      },
    }))
    setAiCheck((current) => {
      if (!current.data) return current
      const remaining = current.data.result.khong_dat.filter((item) => item.item_id !== itemId)
      return {
        ...current,
        data: {
          ...current.data,
          result: {
            ...current.data.result,
            ket_luan: remaining.length === 0 ? 'DAT' : 'KHONG_DAT',
            khong_dat: remaining,
            vi_pham_critical: current.data.result.vi_pham_critical.filter((id) => id !== itemId),
            khuyen_nghi: remaining.length === 0 ? '' : current.data.result.khuyen_nghi,
          },
        },
      }
    })
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
                <button type="button" onClick={handleOpenAppointment}><CalendarDays size={14} />Hẹn tái khám</button>
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
            {appointment.open && (
              <AppointmentModal
                patient={patient}
                state={appointment}
                onSelect={(date) => setAppointment((state) => ({ ...state, selected: date }))}
                onConfirm={handleConfirmAppointment}
                onClose={() => setAppointment((state) => ({ ...state, open: false }))}
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
                <Field label="Mạch" value={vitalSigns.pulse} unit="lần/phút" type="number" min={0} max={300} onChange={(value) => updateNumericVital('pulse', value)} />
                <Field label="Nhịp thở" value={vitalSigns.respiratoryRate} unit="lần/phút" type="number" min={0} max={100} onChange={(value) => updateNumericVital('respiratoryRate', value)} />
                <BloodPressureField systolic={vitalSigns.systolicBloodPressure} diastolic={vitalSigns.diastolicBloodPressure} onChange={updateNumericVital} />
                <Field label="SpO₂" value={vitalSigns.spo2} unit="%" type="number" min={0} max={100} step={0.1} onChange={(value) => updateNumericVital('spo2', value)} />
                <Field label="Đường huyết" value={vitalSigns.bloodGlucose} unit="mg/dL" type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('bloodGlucose', value)} />
                <Field label="Nhiệt độ" value={vitalSigns.temperature} unit="°C" type="number" min={25} max={50} step={0.1} onChange={(value) => updateNumericVital('temperature', value)} />
                <Field label="Chiều cao" value={vitalSigns.height} unit="cm" type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('height', value)} />
                <Field label="Cân nặng" value={vitalSigns.weight} unit="kg" required type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('weight', value)} />
                <Field label="Vòng eo" value={vitalSigns.waist} unit="cm" type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('waist', value)} />
                <Field label="BMI" value={vitalSigns.bmi} type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('bmi', value)} />
                <Field label="BSA" value={vitalSigns.bsa} type="number" min={0} step={0.01} onChange={(value) => updateNumericVital('bsa', value)} />
                <Field label="HbA1c" value={vitalSigns.hba1c} unit="%" type="number" min={0} step={0.1} onChange={(value) => updateNumericVital('hba1c', value)} />
              </div>

              <div className={styles.treatmentPane}>
                <div className={styles.treatmentSubheading}><UserRoundCheck size={15} /><span>Thông tin điều trị</span></div>
                <div className={styles.checkRow}>
                  <label>
                    <input
                      type="checkbox"
                      checked={vitalSigns.pregnancyWeeks !== null}
                      onChange={(event) => setVitalEdits((current) => ({ ...current, pregnancyWeeks: event.target.checked ? (current.pregnancyWeeks ?? 1) : null }))}
                    />
                    <span>Mang thai/nghi ngờ thai</span>
                    <select
                      value={vitalSigns.pregnancyWeeks ?? ''}
                      disabled={vitalSigns.pregnancyWeeks === null}
                      onChange={(event) => updateNumericVital('pregnancyWeeks', event.target.value)}
                      aria-label="Số tuần thai"
                    >
                      <option value="">Tuần</option>
                      {Array.from({ length: 42 }, (_, index) => index + 1).map((week) => <option key={week} value={week}>{week} tuần</option>)}
                    </select>
                  </label>
                  <label><input type="checkbox" checked={vitalSigns.breastfeeding} onChange={(event) => setVitalEdits((current) => ({ ...current, breastfeeding: event.target.checked }))} /><span>Cho con bú</span></label>
                </div>

                <div className={styles.treatmentFields}>
                  <label className={styles.field}>
                    <span>Bác sĩ điều trị<b>*</b></span>
                    <input value={personnelEdits.doctor} onChange={(event) => setPersonnelEdits((current) => ({ ...current, doctor: event.target.value }))} aria-label="Bác sĩ điều trị" />
                  </label>
                  <label className={styles.field}>
                    <span>Điều dưỡng 1</span>
                    <input value={personnelEdits.nurseOne} onChange={(event) => setPersonnelEdits((current) => ({ ...current, nurseOne: event.target.value }))} aria-label="Điều dưỡng 1" />
                  </label>
                  <label className={styles.field}>
                    <span>Điều dưỡng 2</span>
                    <input value={personnelEdits.nurseTwo === 'Chọn...' ? '' : personnelEdits.nurseTwo} placeholder="Chọn hoặc nhập tên" onChange={(event) => setPersonnelEdits((current) => ({ ...current, nurseTwo: event.target.value }))} aria-label="Điều dưỡng 2" />
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
        <button type="button" className={styles.cancelButton} onClick={resetClinicalEdits}><X size={16} />Hủy</button>
      </footer>
      {aiCheck.open && !aiCheckMinimized && <AiCheckModal
        state={aiCheck}
        patient={editablePatient}
        notes={currentNotes}
        onEditNotes={(field, value) => {
          // Biên bản tư vấn quản lý bằng state (modal + AI generate), các ô còn lại là textarea uncontrolled.
          if (field === 'counselingRecord') {
            setCounselingText(value)
            return
          }
          const refs = { clinicalProgress: progressRef, treatmentPlan: planRef, diagnosisSummary: diagnosisSummaryRef }
          if (refs[field].current) refs[field].current.value = value
        }}
        onEditVitals={(field, value) => setVitalEdits((current) => {
          const next = { ...current, [field]: value }
          const bmi = next.height && next.weight ? Number((next.weight / ((next.height / 100) ** 2)).toFixed(1)) : null
          return { ...next, bmi }
        })}
        onApproveCriterion={approveCriterion}
        onMinimize={() => setAiCheckMinimized(true)}
        onClose={() => { setAiCheck((state) => ({ ...state, open: false })); setAiCheckMinimized(false) }}
      />}
      {aiCheck.open && aiCheckMinimized && createPortal(
        <button
          ref={aiBubbleRef}
          type="button"
          className={styles.aiFloatingBubble}
          style={aiBubblePosition ? { left: aiBubblePosition.x, top: aiBubblePosition.y, right: 'auto', bottom: 'auto' } : undefined}
          onPointerDown={startAiBubbleDrag}
          onPointerMove={moveAiBubble}
          onPointerUp={finishAiBubbleDrag}
          onPointerCancel={cancelAiBubbleDrag}
          onClick={openAiCheckFromBubble}
          aria-label="Trợ lý Tháp Rùa. Kéo để di chuyển, bấm để mở kiểm tra hồ sơ"
          title="Kéo để di chuyển · Bấm để mở"
        >
          <span className={styles.aiBubbleMark}><img src={thapRuaMark} alt="" aria-hidden="true" /></span>
          {aiCheck.loading && <LoaderCircle size={15} className={`${styles.aiSpinner} ${styles.aiBubbleLoader}`} />}
          {aiCheck.data && (
            <em className={aiCheck.data.result.khong_dat.length === 0 ? styles.aiBubbleComplete : ''}>
              {aiCheck.data.result.khong_dat.length === 0 ? <CircleCheck size={13} /> : aiCheck.data.result.khong_dat.length}
            </em>
          )}
        </button>,
        document.body,
      )}
    </section>
  )
}
function TechnicalServicesWorkspace() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const toastMessage = useClinicalStore((state) => state.toastMessage)
  const clearToast = useClinicalStore((state) => state.clearToast)
  const notify = useClinicalStore((state) => state.notify)
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

      setLabScanStatus('formatting')
      void requestLabNarrative(
        abnormalLabComparisons.map(({ name, result, unit, reference, status, difference }) => ({ name, result, unit, reference, status, difference })),
      )
        .then((response) => {
          if (response.text.trim()) setLabAnalysisText(response.text.trim())
          notify('Đã hoàn tất đối chiếu và biên tập bản nháp')
        })
        .catch(() => notify('OpenAI chưa sẵn sàng, đang dùng bản đối chiếu cục bộ'))
        .finally(() => setLabScanStatus('complete'))
    }, 1050)

    return () => window.clearTimeout(timeoutId)
  }, [labScanPage, labScanStatus, notify])

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
    setLabPrintLoading(true)
    try {
      const pdfBlob = await fetchLabSummaryPdf()
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
                  <span>PDF gốc đầy đủ thông tin · Dùng nội bộ cho công tác khám chữa bệnh</span>
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
type PrescriptionRow = {
  id: string
  name: string
  strength: string
  unit: string
  quantity: number
  instruction: string
}

const plainUpper = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLocaleUpperCase('vi-VN')

function PrescriptionPrintModal({
  patient,
  rows,
  advice,
  onClose,
}: {
  patient: PatientRecord
  rows: PrescriptionRow[]
  advice: string
  onClose: () => void
}) {
  const today = new Date()
  return createPortal(
    <div className={`${styles.aiModalOverlay} ${styles.counselingOverlay}`} role="dialog" aria-modal="true" aria-label="Đơn thuốc">
      <div className={`${styles.aiModal} ${styles.counselingModal}`}>
        <header className={`${styles.aiModalHead} ${styles.screenOnly}`}>
          <div><Pill size={17} /><h2>Đơn thuốc</h2></div>
          <div className={styles.counselingActions}>
            <button type="button" onClick={() => window.print()}><Printer size={14} />In / Xuất PDF</button>
            <button type="button" className={styles.counselingCloseButton} onClick={onClose} aria-label="Đóng đơn thuốc"><X size={16} /></button>
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
            <h1 className={styles.docTitle}>ĐƠN THUỐC</h1>
            <div className={styles.docInfo}>
              <p>Họ và tên bệnh nhân: <strong>{patient.fullName}</strong></p>
              <p>Năm sinh: {patient.birthYear} ({patient.ageText}) — Giới tính: {patient.gender}</p>
              <p>Mã bệnh nhân: {patient.medicalId} — Địa chỉ: {patient.address}</p>
              <p>Chẩn đoán: <strong>{patient.diagnoses.primaryCode}</strong> — {patient.diagnoses.primaryDescription}</p>
            </div>
            <table className={styles.rxDocTable}>
              <thead>
                <tr><th>STT</th><th>Tên thuốc, hàm lượng</th><th>ĐVT</th><th>SL</th><th>Cách dùng</th></tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td>{index + 1}</td>
                    <td>{row.name}{row.strength ? ` ${row.strength}` : ''}</td>
                    <td>{row.unit}</td>
                    <td>{row.quantity}</td>
                    <td>{row.instruction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {advice && <p className={styles.rxAdvice}><strong>Lời dặn:</strong> {advice}</p>}
            <p className={styles.docDate}>
              Ngày {today.getDate()} tháng {today.getMonth() + 1} năm {today.getFullYear()}
            </p>
            <div className={`${styles.docSignatures} ${styles.rxSignature}`}>
              <div>
                <strong>BÁC SĨ KÊ ĐƠN</strong>
                <span>(Ký, ghi rõ họ tên)</span>
                <em>{patient.doctor}</em>
              </div>
            </div>
            <p className={styles.rxFooterNote}>Khám lại xin mang theo đơn này.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function PrescriptionWorkspace() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const patientPanelCollapsed = useClinicalStore((state) => state.patientPanelCollapsed)
  const selectedMedicalId = useClinicalStore((state) => state.selectedMedicalId)
  const toastMessage = useClinicalStore((state) => state.toastMessage)
  const clearToast = useClinicalStore((state) => state.clearToast)
  const notify = useClinicalStore((state) => state.notify)
  const patient = mockPatients.find((item) => item.medicalId === selectedMedicalId) ?? mockPatients[0]

  const [rowsByPatient, setRowsByPatient] = useState<Record<string, PrescriptionRow[]>>({})
  const [adviceByPatient, setAdviceByPatient] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [printOpen, setPrintOpen] = useState(false)

  const rows = rowsByPatient[patient.medicalId] ?? []
  const advice = adviceByPatient[patient.medicalId] ?? ''
  const setRows = (next: PrescriptionRow[]) =>
    setRowsByPatient((current) => ({ ...current, [patient.medicalId]: next }))

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(clearToast, 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage, clearToast])

  useEffect(() => {
    setSearch('')
    setPrintOpen(false)
  }, [patient.medicalId])

  const addMedication = (medication: Medication) => {
    if (rows.some((row) => row.id === medication.id)) {
      notify(`${medication.name} đã có trong toa`)
      return
    }
    setRows([
      ...rows,
      {
        id: medication.id,
        name: medication.name,
        strength: medication.strength,
        unit: medication.unit,
        quantity: medication.defaultQuantity,
        instruction: medication.instruction,
      },
    ])
    setSearch('')
    notify(`Đã thêm ${medication.name} vào toa`)
  }

  const importFromPlan = () => {
    const plan = plainUpper(patient.treatmentPlan)
    const found = medications.filter(
      (medication) =>
        medication.matchers.some((matcher) => plan.includes(matcher)) &&
        !rows.some((row) => row.id === medication.id),
    )
    if (found.length === 0) {
      notify('Không tìm thấy thuốc mới trong hướng xử trí')
      return
    }
    setRows([
      ...rows,
      ...found.map((medication) => ({
        id: medication.id,
        name: medication.name,
        strength: medication.strength,
        unit: medication.unit,
        quantity: medication.defaultQuantity,
        instruction: medication.instruction,
      })),
    ])
    notify(`Đã thêm ${found.length} thuốc từ hướng xử trí`)
  }

  const updateRow = (id: string, patch: Partial<PrescriptionRow>) =>
    setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))

  const suggestions = search.trim()
    ? medications.filter((medication) =>
        plainUpper(`${medication.name} ${medication.strength}`).includes(plainUpper(search.trim())),
      )
    : []

  return (
    <div className={styles.appShell}>
      <Sidebar />
      <main className={`${styles.mainShell} ${collapsed ? styles.mainShellCollapsed : ''}`}>
        <Header />
        <div className={`${styles.workspace} ${patientPanelCollapsed ? styles.workspacePatientCollapsed : ''} `}>
          <PatientQueue />
          <section className={styles.rxPanel}>
            <header className={styles.rxHeader}>
              <div>
                <h2><Pill size={17} /> Toa thuốc</h2>
                <p>
                  <strong>{patient.fullName}</strong> · {patient.medicalId} · {patient.ageText} ·{' '}
                  {patient.diagnoses.primaryCode} — {patient.diagnoses.primaryDescription}
                </p>
              </div>
              <div className={styles.rxActions}>
                <button type="button" onClick={importFromPlan}><ClipboardPlus size={14} />Lấy từ hướng xử trí</button>
                <button type="button" disabled={rows.length === 0} onClick={() => setRows([])}><Eraser size={14} />Xóa toa</button>
                <button type="button" disabled={rows.length === 0} onClick={() => setPrintOpen(true)}><Printer size={14} />In toa</button>
                <button
                  type="button"
                  className={styles.rxSave}
                  disabled={rows.length === 0}
                  onClick={() => notify(`Đã lưu toa thuốc (${rows.length} thuốc)`)}
                >
                  <Save size={14} />Lưu toa
                </button>
              </div>
            </header>

            <div className={styles.rxSearchWrap}>
              <Search size={15} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tìm thuốc trong danh mục (VD: sắt, canxi, aspirin...)"
                aria-label="Tìm thuốc"
              />
              {suggestions.length > 0 && (
                <div className={styles.rxSuggest}>
                  {suggestions.map((medication) => (
                    <button key={medication.id} type="button" onClick={() => addMedication(medication)}>
                      <strong>{medication.name} {medication.strength}</strong>
                      <span>{medication.unit} · {medication.instruction}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {rows.length === 0 ? (
              <div className={styles.rxEmpty}>
                <Pill size={22} />
                <p>Toa thuốc đang trống. Tìm thuốc ở ô trên hoặc bấm "Lấy từ hướng xử trí" để nhặt các thuốc bác sĩ đã ghi trong hồ sơ.</p>
              </div>
            ) : (
              <div className={styles.rxTableWrap}>
                <table className={styles.rxTable}>
                  <thead>
                    <tr><th>STT</th><th>Tên thuốc, hàm lượng</th><th>ĐVT</th><th>Số lượng</th><th>Cách dùng</th><th aria-label="Xóa" /></tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.id}>
                        <td>{index + 1}</td>
                        <td>{row.name}{row.strength ? ` ${row.strength}` : ''}</td>
                        <td>{row.unit}</td>
                        <td>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={row.quantity}
                            onChange={(event) => updateRow(row.id, { quantity: Math.max(1, Number(event.target.value) || 1) })}
                            aria-label={`Số lượng ${row.name}`}
                          />
                        </td>
                        <td>
                          <input
                            value={row.instruction}
                            onChange={(event) => updateRow(row.id, { instruction: event.target.value })}
                            aria-label={`Cách dùng ${row.name}`}
                          />
                        </td>
                        <td>
                          <button type="button" onClick={() => setRows(rows.filter((item) => item.id !== row.id))} aria-label={`Xóa ${row.name}`}>
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <label className={styles.rxAdviceField}>
                  <span>Lời dặn</span>
                  <input
                    value={advice}
                    onChange={(event) =>
                      setAdviceByPatient((current) => ({ ...current, [patient.medicalId]: event.target.value }))
                    }
                    placeholder="VD: Tái khám theo hẹn; khám ngay khi đau bụng, ra huyết, thai máy yếu."
                  />
                </label>
              </div>
            )}
          </section>
        </div>
      </main>
      {printOpen && (
        <PrescriptionPrintModal patient={patient} rows={rows} advice={advice} onClose={() => setPrintOpen(false)} />
      )}
      {toastMessage && <div className={styles.toast}><Activity size={16} />{toastMessage}</div>}
    </div>
  )
}

const SCHEDULE_RANGE_OPTIONS = [7, 14, 30] as const

function AppointmentsWorkspace() {
  const collapsed = useClinicalStore((state) => state.sidebarCollapsed)
  const toastMessage = useClinicalStore((state) => state.toastMessage)
  const clearToast = useClinicalStore((state) => state.clearToast)
  const [rangeDays, setRangeDays] = useState<number>(14)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [schedule, setSchedule] = useState<ScheduleResponse | null>(null)

  const loadSchedule = async (days: number) => {
    setLoading(true)
    setError('')
    try {
      setSchedule(await fetchAppointmentSchedule(days))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tải được lịch hẹn')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadSchedule(rangeDays)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeDays])

  useEffect(() => {
    if (!toastMessage) return
    const timeoutId = window.setTimeout(clearToast, 2200)
    return () => window.clearTimeout(timeoutId)
  }, [toastMessage, clearToast])

  const busiest = schedule?.days.reduce(
    (max, day) => (day.load > (max?.load ?? 0) ? day : max),
    null as ScheduleResponse['days'][number] | null,
  )

  return (
    <div className={styles.appShell}>
      <Sidebar />
      <main className={`${styles.mainShell} ${collapsed ? styles.mainShellCollapsed : ''}`}>
        <Header />
        <div className={styles.scheduleWorkspace}>
          <header className={styles.scheduleHeader}>
            <div>
              <h2><CalendarDays size={18} /> Lịch hẹn tái khám</h2>
              <p>
                {schedule
                  ? `${schedule.total} lịch hẹn trong ${rangeDays} ngày tới · sức chứa ${schedule.capacity} lượt/ngày` +
                    (busiest && busiest.load > 0 ? ` · đông nhất: ${busiest.weekday} ${formatAppointmentDate(busiest.date)} (${busiest.load})` : '')
                  : 'Đang tải...'}
              </p>
            </div>
            <div className={styles.scheduleControls}>
              {SCHEDULE_RANGE_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={option === rangeDays ? styles.scheduleRangeActive : ''}
                  onClick={() => setRangeDays(option)}
                >
                  {option} ngày
                </button>
              ))}
              <button type="button" onClick={() => void loadSchedule(rangeDays)} aria-label="Tải lại lịch hẹn">
                <ListRestart size={15} />
              </button>
            </div>
          </header>

          {loading && (
            <div className={styles.aiLoading}>
              <LoaderCircle size={22} className={styles.aiSpinner} />
              <p>Đang tải lịch hẹn...</p>
            </div>
          )}
          {!loading && error && <div className={styles.aiError}><TriangleAlert size={16} /><p>{error}</p></div>}
          {!loading && !error && schedule && (
            <div className={styles.scheduleGrid}>
              {schedule.days.map((day) => (
                <section
                  key={day.date}
                  className={`${styles.scheduleDay} ${day.is_sunday ? styles.scheduleDayOff : ''} ${day.is_today ? styles.scheduleDayToday : ''}`}
                >
                  <header>
                    <span className={styles.scheduleDayName}>
                      <strong>{day.weekday}</strong> {formatAppointmentDate(day.date)}
                      {day.is_today && <em className={styles.scheduleTodayChip}>Hôm nay</em>}
                    </span>
                    {!day.is_sunday && (
                      <span className={`${styles.scheduleLoadChip} ${styles[`apptTone_${day.label}`]}`}>
                        {day.load}/{day.capacity} · {APPOINTMENT_LOAD_LABELS[day.label]}
                      </span>
                    )}
                  </header>
                  {day.is_sunday ? (
                    <p className={styles.scheduleEmpty}>Nghỉ Chủ nhật</p>
                  ) : day.appointments.length === 0 ? (
                    <p className={styles.scheduleEmpty}>Chưa có lịch hẹn</p>
                  ) : (
                    <ul className={styles.scheduleList}>
                      {day.appointments.map((item) => (
                        <li key={item.id}>
                          <strong>{item.patient_name || 'Bệnh nhân'}</strong>
                          <span>{item.medical_id}{item.note ? ` · ${item.note}` : ''}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
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
      <Route path="/" element={<Navigate to="/ho-so-benh-an" replace />} />
      <Route path="/dich-vu-ky-thuat" element={<ProtectedRoute><TechnicalServicesWorkspace /></ProtectedRoute>} />
      <Route path="/lich-hen" element={<ProtectedRoute><AppointmentsWorkspace /></ProtectedRoute>} />
      <Route path="/toa-thuoc" element={<ProtectedRoute><PrescriptionWorkspace /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="*" element={<ProtectedRoute><HisWorkspace /></ProtectedRoute>} />
    </Routes>
  )
}

function ProtectedRoute({ children, adminOnly = false }: { children: ReactNode; adminOnly?: boolean }) {
  const status = useAuthStore((state) => state.status)
  const user = useAuthStore((state) => state.user)
  const location = useLocation()

  if (status !== 'authenticated') {
    return <Navigate to="/dang-nhap" replace state={{ from: location }} />
  }
  if (adminOnly && !['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '')) return <Navigate to="/ho-so-benh-an" replace />

  return children
}
