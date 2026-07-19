import { API_BASE_URL } from './config'
import type { SimRecordDocument } from '../data/simPatients'

export async function fetchSimRecords(): Promise<SimRecordDocument[]> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/sim-records`, { cache: 'no-store' })
  } catch {
    throw new Error('Không kết nối được API backend để tải danh sách bệnh nhân.')
  }
  if (!response.ok) {
    throw new Error(`Không tải được danh sách bệnh nhân (HTTP ${response.status})`)
  }
  const body = (await response.json()) as { items?: SimRecordDocument[] }
  return body.items ?? []
}
