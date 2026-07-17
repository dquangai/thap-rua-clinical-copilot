import { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const patients = [
  {
    id: '2001175594',
    queue: '53005',
    name: 'NGUYỄN THỊ HỒNG NGỌC',
    year: '1993',
    status: 'Đang khám',
    insurance: 'DN4807215005924',
    phone: '0349779842',
    address: 'Ấp Long Thịnh, Xã Long Thuận, Tỉnh Tây Ninh',
    reason: 'KHÁM THAI',
    doctor: 'BS. Nguyễn Thị Hương',
    nurse: 'NHS. Trương Ngọc Quý',
    vitals: { pulse: '80', breathing: '20', bloodPressure: '120 / 80', weight: '67', temperature: '37' },
    diagnosis: 'Z35 - Theo dõi thai phụ có nguy cơ cao',
    note: 'PARA: 1001 / ST 2014 2600 g\nDự sinh ngày: 25/07/2026 theo siêu âm thai # 12 tuần (bn khai)\nTiền căn: Nội - Ngoại khoa: Bình thường\nSản khoa: Bình thường\n\nQUÁ TRÌNH KHÁM THAI:\nTiêm ngừa: vắc 1 mũi\nXét nghiệm: Sàng lọc mẹ: NCT',
    plan: 'Tái khám lại sau 4 ngày\n- Siêu âm thai\n- NST\n\nHoặc tái khám lại khi có dấu hiệu bất thường như: Sốt, đau bụng, ra nước âm đạo, ra huyết âm đạo, thai máy yếu.',
  },
  { id: '2001180393', queue: '53026', name: 'TRẦN THỊ BÍCH CHÂU', year: '1996', status: 'Chờ khám', insurance: 'DN4807215006122', phone: '0908123456', address: 'P. 3, TP. Tây Ninh', reason: 'KHÁM PHỤ KHOA', doctor: 'BS. Nguyễn Thị Hương', nurse: 'NHS. Nguyễn Minh Anh', vitals: { pulse: '76', breathing: '18', bloodPressure: '118 / 76', weight: '54', temperature: '36.7' }, diagnosis: 'N92 - Rối loạn kinh nguyệt', note: 'Đau bụng dưới nhẹ, chu kỳ không đều trong 3 tháng gần đây.', plan: 'Siêu âm phụ khoa và hẹn tái khám sau khi có kết quả.' },
  { id: '2001149971', queue: '53041', name: 'BÙI THỊ NGÂN HÀ', year: '2005', status: 'Đã khám', insurance: 'DN4807215007120', phone: '0987654321', address: 'Xã Hiệp Thạnh, Tỉnh Tây Ninh', reason: 'TƯ VẤN SỨC KHỎE', doctor: 'BS. Lê Thị Mai', nurse: 'NHS. Trương Ngọc Quý', vitals: { pulse: '82', breathing: '19', bloodPressure: '110 / 70', weight: '49', temperature: '36.5' }, diagnosis: 'Z00 - Khám sức khỏe tổng quát', note: 'Khám định kỳ. Chưa ghi nhận bất thường.', plan: 'Duy trì lối sống lành mạnh, tái khám định kỳ.' },
]

const navItems = [
  ['⌂', 'Bàn làm việc'], ['▦', 'Tiếp nhận'], ['◉', 'Khám bệnh'], ['▥', 'Nội trú'], ['♧', 'Dược'], ['⌁', 'Xét nghiệm'], ['▣', 'Chẩn đoán hình ảnh'], ['☷', 'Báo cáo'],
]

function Field({ label, value, wide = false, muted = false }) {
  return <div className={`field ${wide ? 'field-wide' : ''}`}><span className="field-label">{label}</span><div className={`field-value ${muted ? 'muted' : ''}`}>{value}</div></div>
}

function StatusDot({ color, label, count }) {
  return <span className="status-item"><i className={`dot ${color}`} />{label} <b>({count})</b></span>
}

function App() {
  const [selectedId, setSelectedId] = useState(patients[0].id)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('Thông tin khám bệnh')
  const [showToast, setShowToast] = useState('')
  const selected = patients.find((patient) => patient.id === selectedId) ?? patients[0]
  const visiblePatients = useMemo(() => patients.filter((patient) => patient.name.includes(query.toUpperCase()) || patient.id.includes(query)), [query])

  const notify = (message) => {
    setShowToast(message)
    window.setTimeout(() => setShowToast(''), 2400)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">TR</div>
        <div className="sidebar-user">BS</div>
        <nav>{navItems.map(([icon, label], index) => <button key={label} className={`nav-item ${index === 2 ? 'active' : ''}`} title={label}><span>{icon}</span><small>{label}</small></button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item" title="Trợ giúp"><span>?</span></button><button className="nav-item" title="Cài đặt"><span>⚙</span></button></div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">HỆ THỐNG QUẢN LÝ BỆNH VIỆN</p><h1>Phòng Khám Chuyên Khoa Phụ Sản <span>(PK53)</span></h1></div>
          <div className="topbar-actions"><span className="live-pill"><i />Hệ thống hoạt động</span><button className="icon-button">⌕</button><button className="icon-button">⋮</button><div className="profile"><span className="avatar">HL</span><div><b>Trần Thái Hữu Lộc</b><small>Hùng Duy Group</small></div><span>⌄</span></div></div>
        </header>

        <section className="content-grid">
          <aside className="patient-panel card">
            <div className="date-row"><label>Từ ngày<input type="date" defaultValue="2026-07-17" /></label><label>Đến ngày<input type="date" defaultValue="2026-07-17" /></label></div>
            <button className="primary queue-button" onClick={() => notify('Đã tải danh sách bệnh nhân hôm nay')}><span>☷</span><strong>Danh sách<br />bệnh nhân</strong><kbd>F5</kbd></button>
            <div className="status-grid"><StatusDot color="dark" label="Chờ khám" count="0" /><StatusDot color="blue" label="Đang khám" count="2" /><StatusDot color="dark" label="Đã có KQCLS" count="1" /><StatusDot color="gray" label="Đã khám" count="35" /></div>
            <div className="patient-heading"><span>Bệnh nhân :</span><strong>{selected.name}</strong></div>
            <div className="action-grid"><button className="action-button blue" onClick={() => notify('Đã gọi số thứ tự ' + selected.queue)}>↕ Gọi số thứ tự</button><button className="action-button blue" onClick={() => notify('Đã gọi tên bệnh nhân')}>✣ Gọi tên bệnh nhân</button><button className="action-button pale" onClick={() => notify('Bắt đầu phiên khám')}>▣ Khám (F1)</button><button className="action-button red" onClick={() => notify('Đã kết thúc khám')}>⊗ Kết thúc khám (F2)</button><button className="action-button orange" onClick={() => notify('Đã hủy phiên khám')}>⊘ Hủy khám</button><button className="action-button blue" onClick={() => notify('Mở nghiệp vụ thủ thuật')}>▰ Thủ thuật</button></div>
            <label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm kiếm bệnh nhân..." /></label>
            <div className="patient-table-wrap"><table><thead><tr><th>MÃ BN</th><th>STT</th><th>TÊN BỆNH NHÂN</th><th>NS</th></tr></thead><tbody>{visiblePatients.map((patient) => <tr key={patient.id} className={patient.id === selectedId ? 'selected' : ''} onClick={() => setSelectedId(patient.id)}><td>{patient.id}</td><td>{patient.queue}</td><td>{patient.name}</td><td>{patient.year}</td></tr>)}</tbody></table></div>
            <div className="panel-footer-actions"><button onClick={() => notify('Đã mở biên bản hội chẩn')}>☷ Biên bản hội chẩn</button><button className="green" onClick={() => notify('Đã mở lịch sử khám')}>↶ Lịch sử khám</button><button onClick={() => notify('Đã tạo giấy nghỉ ốm / dưỡng thai')}>▣ In giấy nghỉ ốm/Dưỡng thai</button><button className="danger" onClick={() => notify('Bộ nhớ tạm đã được xóa')}>⊗ Xóa bộ nhớ tạm</button></div>
          </aside>

          <section className="clinical-panel card">
            <div className="clinical-tabs">{['Thông tin khám bệnh', 'Toa thuốc · Vật tư y tế', 'Dịch vụ kỹ thuật', 'Chuyển viện', 'Nhập viện'].map((tab, index) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}><span>{index === 0 ? '▣' : index === 1 ? '♧' : index === 2 ? '⌁' : index === 3 ? '↗' : '▤'}</span>{tab}<small>{['F6', 'F7', 'F8', 'F9', 'F10'][index]}</small></button>)}<button className="more-button">⋮</button></div>
            <div className="clinical-content">
              <div className="section-bar"><span>▣</span>Thông tin bệnh nhân</div>
              <div className="patient-fields"><Field label="Mã y tế" value={selected.id} /><Field label="Họ và tên" value={selected.name} /><Field label="Tuổi / tháng" value={`${2026 - Number(selected.year)} tuổi`} /><Field label="Giới tính" value="Nữ" /><Field label="Ngày khám trước" value="06/23/2026" /><Field label="Số BHYT" value={selected.insurance} /><Field label="Đối tượng" value="DN thành lập, hoạt động theo Luật Doanh nghiệp" /><Field label="TL giảm (%)" value="80" /><Field label="Ngày BH còn lại" value="162" /><Field label="Ngày còn thuốc" value="6" /><Field label="Số dư (vnđ)" value="0" muted /><Field label="Số điện thoại" value={selected.phone} wide /><Field label="Địa chỉ" value={selected.address} wide /></div>
              <div className="section-bar visit-bar"><span>▣</span>Thông tin khám bệnh <time>Ngày giờ khám bệnh <b>17/07/2026 03:28</b></time></div>
              {activeTab === 'Thông tin khám bệnh' ? <div className="visit-grid">
                <div className="notes-column"><div className="mini-actions"><button className="green" onClick={() => notify('Đã mở hồ sơ khám')}>▣ Hồ sơ khám</button><button onClick={() => notify('Đã tải mẫu ghi chú')}>⇩ Load mẫu</button><button onClick={() => notify('Đã tải lịch sử khám')}>⇩ Load lịch sử</button></div><div className="note-card"><h3>Diễn biến bệnh</h3><pre>{selected.note}</pre></div><div className="note-card plan"><h3>Hướng xử trí</h3><pre>{selected.plan}</pre></div><div className="mini-actions"><button className="green" onClick={() => notify('Đã tạo mẫu xử trí')}>▣ Tạo mẫu</button><button onClick={() => notify('Đã tải mẫu xử trí')}>⇩ Load mẫu</button></div></div>
                <div className="exam-form"><div className="form-row"><Field label="Lý do khám" value={selected.reason} wide /></div><div className="vitals-grid"><Field label="Mạch (lần/phút)" value={selected.vitals.pulse} /><Field label="Nhịp thở (lần/phút)" value={selected.vitals.breathing} /><Field label="Huyết áp (mmHg)" value={selected.vitals.bloodPressure} /><Field label="SpO₂ (%)" value="0" /><Field label="Đường huyết (mg/dL)" value="0" /><Field label="Nhiệt độ (°C)" value={selected.vitals.temperature} /><Field label="Chiều cao (cm)" value="0" /><Field label="Cân nặng (kg)" value={selected.vitals.weight} /><Field label="Vòng eo (cm)" value="0" /><Field label="Chỉ số BMI" value="0" /><Field label="BSA" value="0" /><Field label="HbA1c (%)" value="0" /></div><div className="check-row"><label><input type="checkbox" /> MANG THAI / NGHI NGỜ (Tuần)</label><label><input type="checkbox" /> CHO CON BÚ</label></div><Field label="Bác sĩ điều trị (*)" value={selected.doctor} wide /><Field label="Điều dưỡng 1" value={selected.nurse} wide /><Field label="Điều dưỡng 2" value="Chọn..." wide muted /></div>
              </div> : <div className="empty-tab"><div className="empty-icon">{activeTab === 'Toa thuốc · Vật tư y tế' ? '♧' : '▣'}</div><h3>{activeTab}</h3><p>Khu vực nghiệp vụ đang sẵn sàng cho phiên khám của {selected.name}.</p><button className="primary" onClick={() => notify(`Đã mở module ${activeTab}`)}>Mở module</button></div>}
              <div className="diagnosis"><div className="diagnosis-row"><label>ICD bệnh chính (*)</label><input value={selected.diagnosis.split(' - ')[0]} readOnly /><input className="grow" value={selected.diagnosis} readOnly /></div><div className="diagnosis-row"><label>ICD bệnh khác</label><input /><input className="grow" /></div><div className="diagnosis-row"><label>Bệnh kèm theo</label><input /><input className="grow" /></div><textarea defaultValue={selected.diagnosis} aria-label="Chẩn đoán bổ sung" /></div>
              <div className="bottom-actions"><button onClick={() => notify('Đã mở tiền sử ứng dụng')}>▣ Tiền sử ứng dụng</button><button onClick={() => notify('Đã mở thông tin khám')}>▣ Xem thông tin khám</button><button className="save" onClick={() => notify('Đã lưu hồ sơ khám thành công')}>◉ Lưu</button><button className="cancel" onClick={() => notify('Các thay đổi chưa lưu đã được hủy')}>⊗ Hủy</button></div>
            </div>
          </section>
        </section>
        <footer className="status-footer"><span className="code-card blue-code"><b>CODE BLUE</b><small>Cấp cứu</small></span><span className="code-card yellow-code"><b>CODE YELLOW</b><small>Ưu tiên</small></span><span className="code-card green-code"><b>CODE GREEN</b><small>Hỗ trợ</small></span><input placeholder="Ghi chú nhanh..." /><span className="footer-user"><b>Trần Thái Hữu Lộc</b><small>Hùng Duy Group</small></span></footer>
      </main>
      {showToast && <div className="toast">✓ {showToast}</div>}
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)

