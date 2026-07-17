export type AiExceptionStatus = 'KHONG_DAT' | 'THIEU_DU_LIEU'

export interface AiCheckException {
  item_id: string
  trang_thai: AiExceptionStatus
  bang_chung: string
  ghi_chu: string
}

export interface AiGestationalAge {
  detected: boolean
  weeks: number | null
  days: number | null
  trimester: string | null
  source: string
}

export interface AiCheckResult {
  thong_tin_lan_kham: {
    tuoi_thai_tuan: number | null
    tuoi_thai_ngay: number | null
    phan_loai_nguy_co?: string
    lan_kham_thu: number | null
  }
  dat_ids: string[]
  exceptions: AiCheckException[]
  tong_ket: {
    vi_pham_critical: string[]
    khuyen_nghi: string
  }
  criteria_summary: {
    criteria_applicable: number
    dat_count: number
    khong_dat_count: number
    thieu_du_lieu_count: number
  }
  scope_filter: {
    gestational_age: AiGestationalAge
    criteria_sent_to_llm: number
    criteria_excluded_locally: number
  }
}

export interface AiCheckResponse {
  run_id: string
  result: AiCheckResult
  criteria_catalog: Record<string, string>
  meta: {
    status?: string
    model?: string
    pipeline_version?: string
    latency_ms?: number
    total_tokens?: number
    api_calls?: number
  }
}
