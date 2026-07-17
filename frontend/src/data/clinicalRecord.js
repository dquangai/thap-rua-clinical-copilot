export const simulatedClinicalRecord = {
  record_id: 'SIM-001',
  visit: {
    visit_code: 'KB170720260740',
    visit_datetime: '2026-07-17T07:40:00',
    reason: 'KHÁM THAI ĐỊNH KÌ',
    department: 'Khoa Sản',
    clinic: 'Phòng khám thai',
  },
  patient: {
    full_name: 'NGUYỄN THỊ MAI ANH',
    age: 26,
    gender: 'Nữ',
    phone: '0903214567',
    address: 'KP3, Phường Long Hoa, Tỉnh Tây Ninh',
  },
  vital_signs: {
    mach_lan_phut: null,
    nhiet_do_c: null,
    huyet_ap_tam_thu_mmhg: null,
    huyet_ap_tam_truong_mmhg: null,
    nhip_tho_lan_phut: null,
    chieu_cao_cm: 158,
    can_nang_kg: 50,
    bmi: 20.03,
    duong_huyet_mg_dl: null,
  },
  clinical_note: {
    dien_bien: `PARA: 0000
Dự sanh ngày: 26/01/2027  theo siêu âm thai 8 tuần
Tiền căn:  Nội - Ngoại khoa: không
Sản khoa: không
QUÁ TRÌNH KHÁM THAI:
Tiêm Ngừa:
Xét Nghiệm:
Sàng lọc bé:
Sàng lọc nguy cơ TSG:
Sàng lọc mẹ:
Test dung nạp đường: (HbA1c:)
GBS:
Siêu Âm:
Độ mờ da gáy: 1.4 mm
CRL: 60 mm, tim thai (+), 01 thai trong buồng tử cung
Hình thái học :
Siêu âm tim thai qua thành bụng:
Khám hiện tại:
Tỉnh, niêm hồng
Bụng mềm
Âm đạo hiện không ra huyết`,
    huong_xu_tri:
      'TOA VỀ: SẮT 30MG 1V/NGÀY, ACID FOLIC 800MCG 1V/NGÀY, CANXI 1000MG/NGÀY\nTÁI KHÁM SAU 04 TUẦN HOẶC KHÁM NGAY KHI CÓ GÌ LẠ',
  },
  diagnosis: {
    icd10: 'Z34.0',
    mo_ta: 'THAI 12 TUẦN 03 NGÀY',
  },
  doctor: 'BSCKI. Lê Thị Mỹ Hạnh',
  signed_at: '2026-07-17T08:05:00',
}

export function toQueuePatient(record) {
  const visitDate = new Date(record.visit.visit_datetime)
  const yearOfBirth = String(visitDate.getFullYear() - record.patient.age)
  const systolic = record.vital_signs.huyet_ap_tam_thu_mmhg
  const diastolic = record.vital_signs.huyet_ap_tam_truong_mmhg

  return {
    id: record.visit.visit_code,
    queue: record.record_id,
    name: record.patient.full_name,
    year: yearOfBirth,
    status: 'Đang khám',
    insurance: 'Chưa cập nhật',
    phone: record.patient.phone,
    address: record.patient.address,
    reason: record.visit.reason,
    doctor: record.doctor,
    nurse: 'Chưa phân công',
    gender: record.patient.gender,
    age: record.patient.age,
    visitDateTime: record.visit.visit_datetime,
    signedAt: record.signed_at,
    vitals: {
      pulse: record.vital_signs.mach_lan_phut ?? '',
      breathing: record.vital_signs.nhip_tho_lan_phut ?? '',
      bloodPressure: systolic && diastolic ? `${systolic} / ${diastolic}` : '',
      weight: record.vital_signs.can_nang_kg ?? '',
      height: record.vital_signs.chieu_cao_cm ?? '',
      temperature: record.vital_signs.nhiet_do_c ?? '',
      bmi: record.vital_signs.bmi ?? '',
      glucose: record.vital_signs.duong_huyet_mg_dl ?? '',
    },
    diagnosis: `${record.diagnosis.icd10} - ${record.diagnosis.mo_ta}`,
    note: record.clinical_note.dien_bien,
    plan: record.clinical_note.huong_xu_tri,
  }
}
