export interface AiFailedCriterion {
  item_id: string
  ly_do: string
}

export interface AiCheckResult {
  ket_luan: 'DAT' | 'KHONG_DAT'
  khong_dat: AiFailedCriterion[]
  vi_pham_critical: string[]
  khuyen_nghi: string
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
    criteria_count?: number
    included_by_request_count?: number
    excluded_by_request_count?: number
    cache_status?: 'hit' | 'miss' | 'bypass'
    saved_tokens?: number
  }
}
