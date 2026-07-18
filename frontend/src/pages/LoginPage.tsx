import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  HeartPulse,
  LockKeyhole,
  Mail,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react'
import thapRuaMark from '../assets/thap-rua-mark.svg'
import { DEMO_ACCOUNTS, DEMO_DOCTOR_EMAIL, useAuthStore } from '../store/useAuthStore'
import styles from './LoginPage.module.scss'

type LoginLocationState = {
  from?: {
    pathname?: string
    search?: string
  }
}

export function AuthLoadingScreen() {
  return (
    <main className={styles.loadingScreen} aria-label="Đang kiểm tra phiên đăng nhập">
      <img src={thapRuaMark} alt="" aria-hidden="true" />
      <span className={styles.spinner} />
      <p>Đang kiểm tra phiên đăng nhập...</p>
    </main>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((state) => state.login)
  const enterDemoMode = useAuthStore((state) => state.enterDemoMode)
  const isSubmitting = useAuthStore((state) => state.isSubmitting)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => clearError, [clearError])

  const navigateAfterLogin = (isAdmin: boolean) => {
    const state = location.state as LoginLocationState | null
    const requestedPath = state?.from?.pathname
    const destination = isAdmin
      ? '/admin'
      : `${requestedPath && requestedPath !== '/admin' ? requestedPath : '/ho-so-benh-an'}${state?.from?.search ?? ''}`
    navigate(destination, { replace: true })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const demoAccount = DEMO_ACCOUNTS.find((account) => account.email === email.trim() && account.password === password)
    if (demoAccount) {
      enterDemoMode(demoAccount.email)
      navigateAfterLogin(demoAccount.role === 'SUPER_ADMIN')
      return
    }

    try {
      await login(email, password)
      const role = useAuthStore.getState().user?.role
      navigateAfterLogin(role === 'ADMIN' || role === 'SUPER_ADMIN')
    } catch {
      // The auth store exposes the API error to the form.
    }
  }

  const handleDemoMode = () => {
    enterDemoMode(DEMO_DOCTOR_EMAIL)
    navigateAfterLogin(false)
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.introPanel} aria-label="Giới thiệu hệ thống">
        <div className={styles.introBrand}>
          <img src={thapRuaMark} alt="" aria-hidden="true" />
          <span>Tháp Rùa</span>
        </div>
        <div className={styles.introContent}>
          <span className={styles.eyebrow}><HeartPulse size={17} /> Hệ thống quản lý bệnh viện</span>
          <h1>Hồ sơ lâm sàng<br />liền mạch, an toàn.</h1>
          <p>Không gian làm việc tập trung giúp bác sĩ truy cập thông tin người bệnh và xử lý lượt khám nhanh chóng.</p>
          <div className={styles.trustItems}>
            <span><ShieldCheck size={18} /> Xác thực qua hệ thống bệnh viện</span>
            <span><BadgeCheck size={18} /> Dữ liệu được kiểm soát truy cập</span>
          </div>
        </div>
        <small>Tháp Rùa Clinical Copilot</small>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.loginCard}>
          <header>
            <span className={styles.welcomeLabel}>Chào mừng trở lại</span>
            <h2>Đăng nhập hệ thống</h2>
            <p>Sử dụng tài khoản do quản trị viên bệnh viện cấp.</p>
          </header>

          <form onSubmit={handleSubmit} noValidate>
            <label className={styles.formField}>
              <span>Email</span>
              <div className={styles.inputControl}>
                <Mail size={18} />
                <input
                  type="email"
                  name="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
                    if (error) clearError()
                  }}
                  placeholder="bacsi@benhvien.vn"
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </label>

            <label className={styles.formField}>
              <span>Mật khẩu</span>
              <div className={styles.inputControl}>
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    if (error) clearError()
                  }}
                  placeholder="Nhập mật khẩu"
                  autoComplete="current-password"
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {error && <div className={styles.errorMessage} role="alert">{error}</div>}

            <div className={styles.loginActions}>
              <button className={styles.submitButton} type="submit" disabled={isSubmitting || !email || password.length < 8}>
                {isSubmitting ? <><span className={styles.buttonSpinner} /> Đang đăng nhập...</> : <>Đăng nhập <ArrowRight size={18} /></>}
              </button>
              <button className={styles.demoButton} type="button" onClick={handleDemoMode} disabled={isSubmitting}>
                <PlayCircle size={18} /> Chế độ demo
              </button>
            </div>
          </form>

          <footer>
            <ShieldCheck size={15} /> Phiên đăng nhập được bảo vệ và tự động làm mới.
          </footer>
        </div>
      </section>
    </main>
  )
}
