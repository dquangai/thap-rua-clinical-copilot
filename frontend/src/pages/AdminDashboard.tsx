import { useEffect, useState, type FormEvent } from 'react'
import { Activity, CircleDollarSign, Clock3, FileClock, LogOut, RefreshCw, ShieldCheck, UserPlus, Users } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createAdminUser, getAdminOverview, getAdminUsers, getAudit, getUsage, updateAdminUser, type AdminOverview, type AdminUser, type AuditEvent, type UsageEvent } from '../api/adminApi'
import { useAuthStore } from '../store/useAuthStore'
import styles from './AdminDashboard.module.scss'

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'USD', minimumFractionDigits: 4 })
const number = new Intl.NumberFormat('vi-VN')

export default function AdminDashboard() {
  const token = useAuthStore((s) => s.accessToken)
  const authUser = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usage, setUsage] = useState<UsageEvent[]>([])
  const [audit, setAudit] = useState<AuditEvent[]>([])
  const [tab, setTab] = useState<'usage' | 'users' | 'audit'>('usage')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  const load = async () => {
    setLoading(true); setError('')
    if (!token) {
      setOverview({ users: { total: 3, active: 3 }, records: { total: 0, deleted: 0 }, api: { calls: 0, errors: 0, cost_usd: 0, avg_latency_ms: 0, p50_latency_ms: 0, p95_latency_ms: 0, p99_latency_ms: 0, total_tokens: 0 } })
      setUsers([
        { id: 'demo-admin', full_name: 'Quản trị viên', department_id: null, role: 'SUPER_ADMIN', active: true, created_at: new Date().toISOString(), departments: { name: 'Quản trị hệ thống' } },
        { id: 'demo-doctor-hanh', full_name: 'BS. Lê Thị Mỹ Hạnh', department_id: null, role: 'DOCTOR', active: true, created_at: new Date().toISOString(), departments: { name: 'Khoa Sản' } },
        { id: 'demo-doctor-huong', full_name: 'BS. Nguyễn Thị Hương', department_id: null, role: 'DOCTOR', active: true, created_at: new Date().toISOString(), departments: { name: 'Khoa Sản' } },
      ])
      setUsage([]); setAudit([]); setLoading(false); return
    }
    try {
      const [o, u, metrics, events] = await Promise.all([getAdminOverview(token), getAdminUsers(token), getUsage(token), getAudit(token)])
      setOverview(o); setUsers(u); setUsage(metrics); setAudit(events)
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được dashboard') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  const createUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget)
    if (!token) { setShowCreate(false); setError('Chế độ demo không lưu tài khoản. Hãy cấu hình Supabase để quản lý người dùng thật.'); return }
    try {
      await createAdminUser(token, { email: form.get('email'), full_name: form.get('full_name'), password: form.get('password'), role: form.get('role') })
      setShowCreate(false); await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Không tạo được tài khoản') }
  }

  const cards = overview ? [
    { label: 'Tài khoản hoạt động', value: `${overview.users.active}/${overview.users.total}`, icon: Users },
    { label: 'API calls', value: number.format(overview.api.calls), icon: Activity },
    { label: 'Latency P95', value: `${number.format(overview.api.p95_latency_ms)} ms`, icon: Clock3 },
    { label: 'Chi phí AI', value: money.format(overview.api.cost_usd), icon: CircleDollarSign },
    { label: 'Hồ sơ đã xóa mềm', value: number.format(overview.records.deleted), icon: FileClock },
  ] : []

  return <div className={styles.page}>
    <header><div><span className={styles.adminIdentity}>QT · {authUser?.email}</span><h1><ShieldCheck/> Trung tâm quản trị</h1><p>Tài khoản, hiệu năng AI và nhật ký hồ sơ bệnh án</p></div><div className={styles.headerActions}><button onClick={() => void load()} disabled={loading}><RefreshCw size={16}/> Làm mới</button><button onClick={async () => { await logout(); navigate('/dang-nhap', { replace: true }) }}><LogOut size={16}/> Đăng xuất</button></div></header>
    {error && <div className={styles.error}>{error}</div>}
    <section className={styles.cards}>{cards.map(({ label, value, icon: Icon }) => <article key={label}><span><Icon size={19}/></span><div><small>{label}</small><strong>{value}</strong></div></article>)}</section>
    <nav className={styles.tabs}><button className={tab === 'usage' ? styles.active : ''} onClick={() => setTab('usage')}>API & AI</button><button className={tab === 'users' ? styles.active : ''} onClick={() => setTab('users')}>Tài khoản bác sĩ</button><button className={tab === 'audit' ? styles.active : ''} onClick={() => setTab('audit')}>Nhật ký hồ sơ</button></nav>
    <main className={styles.panel}>
      {loading ? <div className={styles.empty}>Đang tải dữ liệu quản trị…</div> : tab === 'usage' ? <table><thead><tr><th>Thời gian</th><th>Endpoint</th><th>Model</th><th>Trạng thái</th><th>Latency</th><th>Tokens</th><th>Chi phí</th></tr></thead><tbody>{usage.map(x => <tr key={x.id}><td>{new Date(x.occurred_at).toLocaleString('vi-VN')}</td><td><code>{x.endpoint}</code></td><td>{x.model ?? '—'}</td><td><b className={x.status_code >= 400 ? styles.bad : styles.good}>{x.status}</b></td><td>{number.format(x.latency_ms)} ms</td><td>{number.format(x.total_tokens)}</td><td>{money.format(x.cost_usd)}</td></tr>)}</tbody></table> : tab === 'users' ? <><div className={styles.panelHead}><div><h2>Nhân sự y tế</h2><p>Khóa tài khoản thay vì xóa để giữ nguyên lịch sử thao tác.</p></div><button className={styles.primary} onClick={() => setShowCreate(true)}><UserPlus size={16}/> Tạo tài khoản</button></div><table><thead><tr><th>Họ tên</th><th>Khoa</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map(u => <tr key={u.id}><td><strong>{u.full_name || 'Chưa cập nhật'}</strong></td><td>{u.departments?.name ?? '—'}</td><td>{u.role}</td><td><b className={u.active ? styles.good : styles.bad}>{u.active ? 'Hoạt động' : 'Đã khóa'}</b></td><td><button onClick={async () => { await updateAdminUser(token, u.id, { active: !u.active }); await load() }}>{u.active ? 'Khóa' : 'Mở khóa'}</button></td></tr>)}</tbody></table></> : <table><thead><tr><th>Thời gian</th><th>Hành động</th><th>Đối tượng</th><th>Lý do</th></tr></thead><tbody>{audit.map(x => <tr key={x.id}><td>{new Date(x.occurred_at).toLocaleString('vi-VN')}</td><td><b>{x.action}</b></td><td>{x.entity_type} · {x.entity_id.slice(0, 8)}</td><td>{x.reason}</td></tr>)}</tbody></table>}
    </main>
    {showCreate && <div className={styles.overlay}><form onSubmit={createUser}><h2>Tạo tài khoản mới</h2><label>Họ và tên<input name="full_name" required/></label><label>Email<input name="email" type="email" required/></label><label>Mật khẩu tạm thời<input name="password" type="password" minLength={8} required/></label><label>Vai trò<select name="role"><option value="DOCTOR">Bác sĩ</option><option value="ADMIN">Quản trị viên</option></select></label><div><button type="button" onClick={() => setShowCreate(false)}>Hủy</button><button className={styles.primary}>Tạo tài khoản</button></div></form></div>}
  </div>
}
