import { useEffect, useState, type FormEvent } from 'react'
import { Activity, CircleDollarSign, Clock3, FileClock, LoaderCircle, LogOut, RefreshCw, RotateCcw, ScanSearch, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createAdminUser, getAdminOverview, getAdminRecords, getAdminUsers, getAudit, getUsage, updateAdminUser, type AdminOverview, type AdminUser, type AuditEvent, type UsageEvent } from '../api/adminApi'
import { useAuthStore } from '../store/useAuthStore'
import { getBatchAuditResults, getDemoAudit, getDemoRecords, getDemoRecordStats, getDemoUsage, setDemoRecordDeleted, storeBatchAuditResults, type BatchAuditResult, type DemoManagedRecord } from '../lib/demoAdminActivity'
import { usePatientsStore } from '../store/usePatientsStore'
import { buildCheckerRecord, checkClinicalRecord } from '../lib/aiCheck'
import styles from './AdminDashboard.module.scss'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
const number = new Intl.NumberFormat('vi-VN')

const auditActionLabel = (action: string) => ({
  AI_CHECK: 'Kiểm tra hồ sơ bằng AI',
  BATCH_AI_AUDIT: 'Kiểm tra hồ sơ hàng loạt',
  UPDATE: 'Cập nhật hồ sơ',
  DELETE: 'Xóa mềm hồ sơ',
  RESTORE: 'Phục hồi hồ sơ',
  CREATE: 'Tạo mới',
}[action] ?? action)

const auditTargetLabel = (event: AuditEvent) => {
  if (event.entity_id === 'all-latest' || event.entity_id === 'all-late') return 'Tất cả hồ sơ – phiên bản mới nhất'
  if (event.entity_id === 'demo-record' || event.entity_id === 'current-record') return 'Hồ sơ đang mở'
  if (event.entity_type === 'clinical_record') return `Hồ sơ #${event.entity_id}`
  if (event.entity_type === 'user') return `Tài khoản #${event.entity_id}`
  return event.entity_id
}

export default function AdminDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usage, setUsage] = useState<UsageEvent[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [records, setRecords] = useState<DemoManagedRecord[]>([])
  const [tab, setTab] = useState<string>('batch')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchProgress, setBatchProgress] = useState(0)
  const [batchResults, setBatchResults] = useState<BatchAuditResult[]>(() => getBatchAuditResults())
  const patients = usePatientsStore((s) => s.patients)
  const loadPatients = usePatientsStore((s) => s.load)
  useEffect(() => { if (!patients.length) void loadPatients() }, [patients.length, loadPatients])

  const demoRecordFallback = patients.map((patient) => ({ id: patient.medicalId, patient: patient.fullName, doctor: patient.doctor, deleted: false }))

  const load = async () => {
    setLoading(true); setError('')
    if (!token) {
      const demoUsage = getDemoUsage()
      const paidUsage = demoUsage.filter((item) => item.api_calls > 0 && item.cache_status !== 'hit')
      const latencies = paidUsage.map((item) => Number(item.latency_ms)).sort((a, b) => a - b)
      const percentile = (ratio: number) => latencies.length ? latencies[Math.min(Math.ceil(latencies.length * ratio) - 1, latencies.length - 1)] : 0
      setOverview({ users: { total: 3, active: 3 }, records: getDemoRecordStats(demoRecordFallback), api: { calls: paidUsage.reduce((sum, item) => sum + item.api_calls, 0), errors: demoUsage.filter((item) => item.status_code >= 400 || item.status_code === 0).length, cost_usd: paidUsage.reduce((sum, item) => sum + Number(item.cost_usd), 0), avg_latency_ms: latencies.length ? latencies.reduce((sum, item) => sum + item, 0) / latencies.length : 0, p50_latency_ms: percentile(.5), p95_latency_ms: percentile(.95), p99_latency_ms: percentile(.99), total_tokens: paidUsage.reduce((sum, item) => sum + Number(item.total_tokens), 0) } })
      setUsers([
        { id: 'demo-admin', full_name: 'Quản trị viên', department_id: null, role: 'SUPER_ADMIN', active: true, created_at: new Date().toISOString(), departments: { name: 'Quản trị hệ thống' } },
        { id: 'demo-doctor-hanh', full_name: 'BS. Lê Thị Mỹ Hạnh', department_id: null, role: 'DOCTOR', active: true, created_at: new Date().toISOString(), departments: { name: 'Khoa Sản' } },
        { id: 'demo-doctor-huong', full_name: 'BS. Nguyễn Thị Hương', department_id: null, role: 'DOCTOR', active: true, created_at: new Date().toISOString(), departments: { name: 'Khoa Sản' } },
      ])
      setUsage(demoUsage); setAudit(getDemoAudit()); setRecords(getDemoRecords(demoRecordFallback)); setLoading(false); return
    }
    try {
      const [o, u, metrics, events, clinicalRecords] = await Promise.all([getAdminOverview(token), getAdminUsers(token), getUsage(token), getAudit(token), getAdminRecords(token)])
      setOverview(o); setUsers(u); setUsage(metrics); setAudit(events); setRecords(clinicalRecords.map((record) => ({ id: record.patient?.medical_record_number ?? record.id, patient: record.patient?.full_name ?? 'Không xác định', doctor: record.doctor?.full_name ?? 'Chưa phân công', deleted: Boolean(record.deleted_at), deletionReason: record.deletion_reason ?? undefined })))
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được dashboard') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [patients.length])
  useEffect(() => {
    if (token) return
    const refresh = () => void load()
    window.addEventListener('thap-rua:demo-admin-activity', refresh)
    return () => window.removeEventListener('thap-rua:demo-admin-activity', refresh)
  }, [token])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    if (!token) { setShowCreate(false); setError('Chế độ demo không lưu tài khoản. Hãy cấu hình Supabase để quản lý người dùng thật.'); return }
    try {
      await createAdminUser(token, { email: form.get('email'), full_name: form.get('full_name'), password: form.get('password'), role: form.get('role') })
      setShowCreate(false); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tạo được tài khoản') }
  }

  const runBatchAudit = async () => {
    if (!patients.length) { setError('Chưa tải được danh sách hồ sơ bệnh nhân từ backend.'); return }
    if (!window.confirm(`Kiểm tra ${patients.length} hồ sơ mới nhất? Hồ sơ chưa có cache sẽ phát sinh API call và chi phí AI.`)) return
    setBatchRunning(true); setBatchProgress(0); setError('')
    const results: BatchAuditResult[] = []
    for (const patient of patients) {
      try {
        const record = buildCheckerRecord(patient, { clinicalProgress: patient.clinicalProgress, treatmentPlan: patient.treatmentPlan, diagnosisSummary: patient.diagnoses.summary, counselingRecord: patient.counselingRecord })
        const response = await checkClinicalRecord(record, { recordId: patient.medicalId, recordVersion: 1 })
        results.push({ recordId: patient.medicalId, patientName: patient.fullName, doctor: patient.doctor, checkedAt: new Date().toISOString(), cacheStatus: response.meta.cache_status === 'hit' ? 'hit' : 'miss', conclusion: response.result.ket_luan, issueCount: response.result.khong_dat.length })
      } catch (cause) {
        results.push({ recordId: patient.medicalId, patientName: patient.fullName, doctor: patient.doctor, checkedAt: new Date().toISOString(), cacheStatus: 'miss', conclusion: 'ERROR', issueCount: 0, message: cause instanceof Error ? cause.message : 'Không kiểm tra được hồ sơ' })
      }
      setBatchProgress(results.length)
    }
    setBatchResults(results); storeBatchAuditResults(results); setBatchRunning(false); await load()
  }

  const cards = overview ? [
    { label: 'Tài khoản hoạt động', value: `${overview.users.active}/${overview.users.total}`, icon: Users },
    { label: 'LLM API calls tính phí', value: number.format(overview.api.calls), icon: Activity },
    { label: 'Latency P95', value: `${number.format(overview.api.p95_latency_ms)} ms`, icon: Clock3 },
    { label: 'Chi phí AI', value: money.format(overview.api.cost_usd), icon: CircleDollarSign },
    { label: 'Hồ sơ đã xóa mềm', value: number.format(overview.records.deleted), icon: FileClock },
  ] : []

  return <div className={styles.page}>
    <header><div><span className={styles.adminIdentity}>QT · {authUser?.email}</span><h1><ShieldCheck/> Trung tâm quản trị</h1><p>Tài khoản, hiệu năng AI và nhật ký hồ sơ bệnh án</p></div><div className={styles.headerActions}><button onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Làm mới</button><button onClick={async () => { await logout(); navigate('/dang-nhap', { replace: true }) }}><LogOut size={16}/> Đăng xuất</button></div></header>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.cards}>{cards.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>
    <nav className={styles.tabs}><button className={tab === 'batch' ? styles.active : ''} onClick={() => setTab('batch')}>Kiểm tra hồ sơ</button><button className={tab === 'usage' ? styles.active : ''} onClick={() => setTab('usage')}>Sử dụng AI & API</button><button className={tab === 'users' ? styles.active : ''} onClick={() => setTab('users')}>Quản lý tài khoản</button><button className={tab === 'records' ? styles.active : ''} onClick={() => setTab('records')}>Quản lý hồ sơ</button><button className={tab === 'audit' ? styles.active : ''} onClick={() => setTab('audit')}>Nhật ký hồ sơ</button></nav>
    {tab === 'batch' && <>
      <section className={styles.batchPanel}><div><span className={styles.batchIcon}><ScanSearch size={21}/></span><div><h2>Kiểm tra toàn bộ hồ sơ</h2><p>Đối chiếu phiên bản mới nhất của mọi hồ sơ. Cache hợp lệ được dùng lại; chỉ hồ sơ chưa có cache mới gọi AI.</p></div></div><button className={styles.primary} onClick={() => void runBatchAudit()} disabled={batchRunning}>{batchRunning ? <><LoaderCircle size={16}/>Đang kiểm tra {batchProgress}/{patients.length}</> : <><ScanSearch size={16}/>Kiểm tra tất cả</>}</button></section>
      {batchResults.length > 0 && <section className={styles.batchSummary}><strong>Kết quả gần nhất</strong><span>{batchResults.filter((item) => item.cacheStatus === 'hit').length} từ cache</span><span>{batchResults.filter((item) => item.cacheStatus === 'miss' && item.conclusion !== 'ERROR').length} gọi mới</span><span className={styles.bad}>{batchResults.filter((item) => item.conclusion === 'KHONG_DAT').length} hồ sơ có sai sót</span><span>{batchResults.filter((item) => item.conclusion === 'ERROR').length} lỗi</span></section>}
      {batchResults.length > 0 && <section className={styles.batchResults}><table><thead><tr><th>Mã hồ sơ</th><th>Bệnh nhân</th><th>Bác sĩ</th><th>Nguồn kết quả</th><th>Kết luận mới nhất</th><th>Số sai sót</th><th>Thời gian</th></tr></thead><tbody>{batchResults.map((item) => <tr key={item.recordId}><td><strong>{item.recordId}</strong></td><td>{item.patientName}</td><td>{item.doctor}</td><td><b className={item.cacheStatus === 'hit' ? styles.good : ''}>{item.cacheStatus === 'hit' ? 'Cache mới nhất' : 'Gọi AI mới'}</b></td><td><b className={item.conclusion === 'DAT' ? styles.good : styles.bad}>{item.conclusion}</b>{item.message && <small>{item.message}</small>}</td><td>{item.issueCount}</td><td>{new Date(item.checkedAt).toLocaleString('vi-VN')}</td></tr>)}</tbody></table></section>}
    </>}
    {tab !== 'batch' && <main className={styles.panel}>
      {loading ? <div className={styles.empty}>Đang tải dữ liệu quản trị…</div> : tab === 'batch' ? <div className={styles.empty}>Kết quả kiểm tra mới nhất được hiển thị ở phía trên.</div> : tab === 'usage' ? <table><thead><tr><th>Thời gian</th><th>Endpoint</th><th>Model</th><th>Trạng thái</th><th>Latency</th><th>Tokens</th><th>Chi phí</th></tr></thead><tbody>{usage.map(x => <tr key={x.id}><td>{new Date(x.occurred_at).toLocaleString('vi-VN')}</td><td><code>{x.endpoint}</code></td><td>{x.model ?? '—'}</td><td><b className={x.status_code >= 400 || x.status_code === 0 ? styles.bad : styles.good}>{x.status}</b></td><td>{number.format(x.latency_ms)} ms</td><td>{number.format(x.total_tokens)}</td><td>{money.format(x.cost_usd)}</td></tr>)}</tbody></table> : tab === 'users' ? <><div className={styles.panelHead}><div><h2>Nhân sự y tế</h2><p>Khóa tài khoản thay vì xóa để giữ nguyên lịch sử thao tác.</p></div><button className={styles.primary} onClick={() => setShowCreate(true)}><UserPlus size={16}/> Tạo tài khoản</button></div><table><thead><tr><th>Họ tên</th><th>Khoa</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><strong>{u.full_name || 'Chưa cập nhật'}</strong></td><td>{u.departments?.name ?? '—'}</td><td>{u.role}</td><td><b className={u.active ? styles.good : styles.bad}>{u.active ? 'Hoạt động' : 'Đã khóa'}</b></td><td><button disabled={!token} onClick={async () => { await updateAdminUser(token, u.id, { active: !u.active }); await load() }}>{u.active ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table></> : tab === 'records' ? <table><thead><tr><th>Mã hồ sơ</th><th>Bệnh nhân</th><th>Bác sĩ phụ trách</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{records.map(record => <tr key={record.id}><td><strong>{record.id}</strong></td><td>{record.patient}</td><td>{record.doctor}</td><td><b className={record.deleted ? styles.bad : styles.good}>{record.deleted ? 'Đã xóa mềm' : 'Đang hoạt động'}</b></td><td><button onClick={() => { const reason = record.deleted ? 'Quản trị viên phục hồi hồ sơ demo' : 'Quản trị viên xóa mềm hồ sơ demo'; setDemoRecordDeleted(record.id, !record.deleted, reason) }}>{record.deleted ? <><RotateCcw size={14}/>Phục hồi</> : <><Trash2 size={14}/>Xóa mềm</>}</button></td></tr>)}</tbody></table> : <table><thead><tr><th>Thời gian</th><th>Hoạt động</th><th>Phạm vi</th><th>Diễn giải</th></tr></thead><tbody>{audit.map(x => <tr key={x.id}><td>{new Date(x.occurred_at).toLocaleString('vi-VN')}</td><td><b>{auditActionLabel(x.action)}</b></td><td>{auditTargetLabel(x)}</td><td>{x.reason}</td></tr>)}</tbody></table>}
    </main>}
    {showCreate && <div className={styles.overlay}><form onSubmit={createUser}><h2>Tạo tài khoản mới</h2><label>Họ và tên<input name="full_name" required/></label><label>Email<input name="email" type="email" required/></label><label>Mật khẩu tạm thời<input name="password" type="password" minLength={8} required/></label><label>Vai trò<select name="role"><option value="DOCTOR">Bác sĩ</option><option value="ADMIN">Quản trị viên</option></select></label><div><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className={styles.primary}>Tạo tài khoản</button></div></form></div>}
  </div>
}
