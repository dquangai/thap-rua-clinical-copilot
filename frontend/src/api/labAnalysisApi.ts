const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')

export type LabComparisonPayload = {
  name: string
  result: string
  unit: string
  reference: string
  status: 'normal' | 'high' | 'low'
  difference: string | null
}

type LabNarrativeResponse = {
  text: string
  source: 'openai'
}

export async function requestLabNarrative(rows: LabComparisonPayload[]) {
  const response = await fetch(`${API_BASE_URL}/lab-analysis/narrative`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  })

  if (!response.ok) {
    throw new Error(`Lab analysis API failed (${response.status})`)
  }

  return response.json() as Promise<LabNarrativeResponse>
}

export async function fetchLabSummaryPdf() {
  const response = await fetch(`${API_BASE_URL}/lab-reports/summary-pdf`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`Lab report PDF API failed (${response.status})`)
  return response.blob()
}
