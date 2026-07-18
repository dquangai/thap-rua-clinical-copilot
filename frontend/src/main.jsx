import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { simulatedClinicalRecord } from './data/clinicalRecord.js'

const navItems = [
  ['home', 'Tổng quan'],
  ['calendar', 'Lịch hẹn'],
  ['record', 'Hồ sơ bệnh án'],
  ['users', 'Bệnh nhân'],
  ['database', 'Kho dữ liệu'],
  ['chart', 'Báo cáo'],
  ['settings', 'Cấu hình'],
]

const tabs = ['Bệnh án', 'Toa thuốc', 'Cận lâm sàng', 'AI Copilot']

function Icon({ name }) {
  const icons = {
    home: ['M3 11.5 12 4l9 7.5', 'M5 10.5V20h5v-6h4v6h5v-9.5'],
    calendar: ['M7 3v4M17 3v4M4 8h16', 'M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 12h4M8 16h8'],
    record: ['M7 3h7l4 4v14H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M14 3v5h5', 'M9 12h7M9 16h7'],
    users: ['M16 20v-1.5c0-1.9-1.8-3.5-4-3.5s-4 1.6-4 3.5V20', 'M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M20 20v-1.2c0-1.4-1.1-2.7-2.7-3.2', 'M17 5.2a2.6 2.6 0 0 1 0 5'],
    database: ['M12 3 4 7l8 4 8-4-8-4z', 'M4 12l8 4 8-4', 'M4 17l8 4 8-4'],
    chart: ['M5 20V10', 'M12 20V5', 'M19 20v-7'],
    settings: ['M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9-.2l-.8.5a1.7 1.7 0 0 0-.8 1.6V22h-4v-.2a1.7 1.7 0 0 0-.8-1.6l-.8-.5a1.7 1.7 0 0 0-1.9.2l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15v-1a1.7 1.7 0 0 0-1-1.5l-.2-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9.2l.8-.5A1.7 1.7 0 0 0 9.1 7V6h4v1a1.7 1.7 0 0 0 .8 1.5l.8.5a1.7 1.7 0 0 0 1.9-.2l.2-.1 2 3.4-.2.1a1.7 1.7 0 0 0-1 1.5v1z'],
  }

  return (
    <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
      {(icons[name] ?? icons.home).map((path) => <path key={path} d={path} />)}
    </svg>
  )
}

const formatDateTime = (value) => {
  const date = new Date(value)
  const pad = (part) => String(part).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const isMissing = (value) => value === null || value === undefined || value === ''
const showValue = (value, fallback = 'Chưa đo') => isMissing(value) ? fallback : value

function NavItem({ icon, label, active }) {
  return (
    <button className={`nav-item ${active ? 'active' : ''}`} title={label}>
      <Icon name={icon} />
      <small>{label}</small>
    </button>
  )
}

function Field({ label, hint, value, unit, wide = false, compact = false, missingFallback = 'Chưa đo' }) {
  const missing = isMissing(value)
  return (
    <label className={`field ${wide ? 'wide' : ''} ${compact ? 'compact' : ''}`}>
      <span>{label}{hint && <em>{hint}</em>}</span>
      <div className={`field-control ${missing ? 'is-missing' : ''}`}>
        <strong>{showValue(value, missingFallback)}</strong>
        {unit && <b>{unit}</b>}
      </div>
    </label>
  )
}

function Section({ title, hint, children, className = '' }) {
  return (
    <section className={`section ${className}`}>
      <header>
        <h2>{title}</h2>
        {hint && <span>{hint}</span>}
      </header>
      <div className="section-body">{children}</div>
    </section>
  )
}

function TextBox({ title, hint, children, count }) {
  return (
    <article className="text-box">
      <header>
        <h3>{title}{hint && <span>{hint}</span>}</h3>
      </header>
      <div className="textarea-like">{children}</div>
      {count && <footer>{count}</footer>}
    </article>
  )
}

function AiPanel({ noteLines, diagnosis }) {
  return (
    <aside className="ai-panel">
      <header>
        <div>
          <span className="spark">✦</span>
          <h3>Gợi ý AI</h3>
          <i>ⓘ</i>
        </div>
        <button onClick={() => undefined}>✣ Tạo gợi ý AI</button>
      </header>
      <p>Gợi ý dựa trên diễn biến bệnh và chẩn đoán:</p>
      <ul>
        <li>Tiếp tục bổ sung vi chất theo hướng xử trí.</li>
        <li>Tư vấn dinh dưỡng: tăng rau xanh, trái cây, uống đủ nước.</li>
        <li>Theo dõi dấu hiệu bất thường: ra máu, đau bụng, sốt.</li>
        <li>Hẹn tái khám đúng lịch để theo dõi sự phát triển thai.</li>
      </ul>
      <small>{diagnosis} · {noteLines.length} ghi nhận lâm sàng chính</small>
    </aside>
  )
}

function TabPlaceholder({ tab, patientName }) {
  return (
    <div className="tab-placeholder">
      <div>▤</div>
      <h2>{tab}</h2>
      <p>Module này sẽ dùng cùng hồ sơ của {patientName} khi nhóm mở rộng nghiệp vụ.</p>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState('Bệnh án')
  const [toast, setToast] = useState('')
  const record = simulatedClinicalRecord

  const noteLines = useMemo(() => {
    const wanted = ['PARA:', 'Dự sanh ngày:', 'Độ mờ da gáy:', 'CRL:', 'Tỉnh, niêm hồng', 'Bụng mềm', 'Âm đạo hiện không ra huyết']
    return record.clinical_note.dien_bien
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => wanted.some((keyword) => line.includes(keyword)))
  }, [record.clinical_note.dien_bien])

  const planLines = useMemo(() => [
    'SẮT 30MG 1V/NGÀY',
    'ACID FOLIC 800MCG 1V/NGÀY',
    'CANXI 1000MG/NGÀY',
    'TÁI KHÁM SAU 04 TUẦN',
  ], [])

  const vitals = [
    ['Mạch', 'lần/phút', record.vital_signs.mach_lan_phut],
    ['Huyết áp', 'mmHg', record.vital_signs.huyet_ap_tam_thu_mmhg && record.vital_signs.huyet_ap_tam_truong_mmhg ? `${record.vital_signs.huyet_ap_tam_thu_mmhg}/${record.vital_signs.huyet_ap_tam_truong_mmhg}` : null],
    ['Nhiệt độ', '°C', record.vital_signs.nhiet_do_c],
    ['Nhịp thở', 'lần/phút', record.vital_signs.nhip_tho_lan_phut],
    ['SpO₂', '%', null],
  ]

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2200)
  }

  return (
    <div className="hospital-app">
      <aside className="side-rail">

        <nav>
          {navItems.map(([icon, label], index) => (
            <NavItem key={label} icon={icon} label={label} active={index === 2} />
          ))}
        </nav>
        <button className="collapse-button"><span>‹</span> Thu gọn</button>
      </aside>

      <main className="workspace">
        <header className="app-header">
          <div>
            <p>HỆ THỐNG QUẢN LÝ BỆNH VIỆN</p>
            <h1>Hồ sơ bệnh án</h1>
          </div>
          <div className="header-actions">
            <span className="status-pill">● Hệ thống hoạt động</span>
            <button className="round-button" title="Thông báo">♢<sup>3</sup></button>
            <button className="round-button" title="Trợ giúp">?</button>
            <div className="doctor-card">
              <span>HM</span>
              <div>
                <strong>{record.doctor.replace('BSCKI. ', 'BS. ')}</strong>
                <small>{record.visit.department}</small>
              </div>
              <i>⌄</i>
            </div>
          </div>
        </header>

        <div className="tabbar">
          {tabs.map((tab) => (
            <button key={tab} className={tab === activeTab ? 'active' : ''} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        <div className="record-layout">
          <aside className="visit-column">
            <div className="search-row">
              <label>
                <span>⌕</span>
                <input placeholder="Tìm kiếm lượt khám..." />
              </label>
              <button title="Bộ lọc">☰</button>
            </div>

            <section className="visit-list">
              <h2>Danh sách lượt khám</h2>
              <article className="visit-card active">
                <div>
                  <strong>▣ {formatDateTime(record.visit.visit_datetime)}</strong>
                  <span>Hoàn tất</span>
                </div>
                <p>{record.visit.visit_code}</p>
                <small>{record.visit.reason}</small>
                <small>{record.visit.clinic}</small>
              </article>
            </section>

            <section className="summary-card">
              <dl>
                <div><dt>Mã hồ sơ</dt><dd>{record.record_id}</dd></div>
                <div><dt>Lượt khám hiện tại</dt><dd>{record.visit.visit_code}</dd></div>
                <div><dt>Thời gian</dt><dd>{formatDateTime(record.visit.visit_datetime)}</dd></div>
                <div><dt>Lý do khám</dt><dd>{record.visit.reason}</dd></div>
                <div><dt>Khoa</dt><dd>{record.visit.department}</dd></div>
                <div><dt>Phòng khám</dt><dd>{record.visit.clinic}</dd></div>
              </dl>
            </section>
          </aside>

          <section className="record-workspace">
            {activeTab === 'Bệnh án' ? (
              <>
                <Section title="Thông tin lượt khám">
                  <div className="visit-fields">
                    <Field label="Mã hồ sơ" hint="record_id" value={record.record_id} />
                    <Field label="Mã lượt khám" hint="visit_code" value={record.visit.visit_code} />
                    <Field label="Thời gian khám" hint="visit_datetime" value={formatDateTime(record.visit.visit_datetime)} />
                    <Field label="Lý do khám" hint="reason" value={record.visit.reason} />
                    <Field label="Khoa" hint="department" value={record.visit.department} />
                    <Field label="Phòng khám" hint="clinic" value={record.visit.clinic} />
                  </div>
                </Section>

                <Section title="Thông tin bệnh nhân">
                  <div className="patient-fields-new">
                    <Field label="Họ và tên" hint="patient" value={record.patient.full_name} />
                    <Field label="Tuổi" value={record.patient.age} compact />
                    <Field label="Giới tính" value={record.patient.gender} compact />
                    <Field label="Số điện thoại" value={record.patient.phone} />
                    <Field label="Địa chỉ" value={record.patient.address} wide />
                    <Field label="Chiều cao" value={record.vital_signs.chieu_cao_cm} unit="cm" compact />
                    <Field label="Cân nặng" value={record.vital_signs.can_nang_kg} unit="kg" compact />
                    <Field label="BMI" value={record.vital_signs.bmi} unit="kg/m²" compact />
                  </div>
                </Section>

                <Section title="Dấu hiệu sinh tồn">
                  <div className="vitals-row">
                    {vitals.map(([label, unit, value]) => <Field key={label} label={label} value={value} unit={unit} compact />)}
                  </div>
                </Section>

                <div className="clinical-grid">
                  <TextBox title="Diễn biến bệnh" hint="clinical_note" count="140/2000">
                    {noteLines.map((line) => <p key={line}>{line}</p>)}
                  </TextBox>

                  <TextBox title="Hướng xử trí" hint="treatment_plan" count="77/1000">
                    <ol>
                      {planLines.map((line) => <li key={line}>{line}</li>)}
                    </ol>
                  </TextBox>

                  <AiPanel noteLines={noteLines} diagnosis={`${record.diagnosis.icd10} - ${record.diagnosis.mo_ta}`} />
                </div>

                <div className="bottom-grid">
                  <Section title="Chẩn đoán" hint="diagnosis" className="diagnosis-section">
                    <Field label="ICD-10" value={`${record.diagnosis.icd10} - ${record.diagnosis.mo_ta}`} wide />
                  </Section>

                  <Section title="Bác sĩ phụ trách" hint="doctor">
                    <Field label="Bác sĩ" value={record.doctor} />
                  </Section>

                  <Section title="Thời gian ký" hint="signed_at">
                    <Field label="Đã ký lúc" value={formatDateTime(record.signed_at)} />
                  </Section>
                </div>

                <div className="form-actions">
                  <button onClick={() => notify('Đã lưu hồ sơ bệnh án')}>▣ Lưu</button>
                  <button className="primary" onClick={() => notify('Hồ sơ đã được ký')}>✎ Ký hồ sơ</button>
                  <button onClick={() => notify('Đã gửi lệnh in hồ sơ')}>▤ In</button>
                </div>
              </>
            ) : <TabPlaceholder tab={activeTab} patientName={record.patient.full_name} />}
          </section>
        </div>
      </main>
      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)


