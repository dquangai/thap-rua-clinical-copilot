export type Medication = {
  id: string
  name: string
  strength: string
  unit: string
  defaultQuantity: number
  instruction: string
  // Cụm từ nhận diện thuốc trong hướng xử trí (không dấu, viết hoa).
  matchers: string[]
}

export const medications: Medication[] = [
  { id: 'sat-60', name: 'Sắt fumarat', strength: '60mg', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày sau ăn sáng, uống xa bữa trà/sữa', matchers: ['SAT'] },
  { id: 'folic-400', name: 'Acid folic', strength: '400mcg', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày sau ăn', matchers: ['ACID FOLIC', 'FOLIC'] },
  { id: 'canxi-500', name: 'Canxi carbonat', strength: '500mg', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày sau ăn trưa', matchers: ['CANXI', 'CALCI'] },
  { id: 'vitd3-1000', name: 'Vitamin D3', strength: '1000IU', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày cùng bữa ăn', matchers: ['VITAMIN D'] },
  { id: 'magie-b6', name: 'Magie – B6', strength: '470mg/5mg', unit: 'Viên', defaultQuantity: 20, instruction: 'Uống 1 viên x 2 lần/ngày khi bị chuột rút', matchers: ['MAGIE', 'MAGNE'] },
  { id: 'aspirin-81', name: 'Aspirin (dự phòng tiền sản giật)', strength: '81mg', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày buổi tối theo chỉ định bác sĩ', matchers: ['ASPIRIN'] },
  { id: 'progesterone-200', name: 'Progesterone', strength: '200mg', unit: 'Viên', defaultQuantity: 15, instruction: 'Đặt âm đạo 1 viên/ngày buổi tối theo chỉ định', matchers: ['PROGESTERONE', 'UTROGESTAN'] },
  { id: 'multivit-bau', name: 'Vitamin tổng hợp cho thai phụ', strength: '', unit: 'Viên', defaultQuantity: 30, instruction: 'Uống 1 viên/ngày sau ăn sáng', matchers: ['VITAMIN TONG HOP', 'MULTIVITAMIN'] },
  { id: 'paracetamol-500', name: 'Paracetamol', strength: '500mg', unit: 'Viên', defaultQuantity: 10, instruction: 'Uống 1 viên khi sốt/đau, cách 6 giờ, tối đa 4 viên/ngày', matchers: ['PARACETAMOL'] },
  { id: 'domperidon-10', name: 'Domperidon', strength: '10mg', unit: 'Viên', defaultQuantity: 10, instruction: 'Uống 1 viên trước ăn 30 phút khi buồn nôn nhiều', matchers: ['DOMPERIDON'] },
  { id: 'oresol', name: 'Oresol (bù nước điện giải)', strength: '', unit: 'Gói', defaultQuantity: 5, instruction: 'Pha 1 gói với 200ml nước, uống khi mất nước', matchers: ['ORESOL'] },
  { id: 'insulin-nph', name: 'Insulin NPH (theo hội chẩn nội tiết)', strength: '100IU/ml', unit: 'Lọ', defaultQuantity: 1, instruction: 'Tiêm dưới da theo phác đồ nội tiết, tái khám đúng hẹn', matchers: ['INSULIN'] },
]
