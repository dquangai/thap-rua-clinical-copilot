import { API_BASE_URL } from './config'

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

export async function requestLabNarrative(rows: LabComparisonPayload[], accessToken: string) {
  const response = await fetch(`${API_BASE_URL}/lab-analysis/narrative`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ rows }),
  })

  if (!response.ok) {
    throw new Error(`Lab analysis API failed (${response.status})`)
  }

  return response.json() as Promise<LabNarrativeResponse>
}

export async function fetchLabSummaryPdf(accessToken: string | null, demoMode: boolean) {
  const endpoint = demoMode ? 'demo-summary-pdf' : 'summary-pdf'
  const headers: Record<string, string> = demoMode
    ? { 'X-Demo-Mode': '1' }
    : { Authorization: `Bearer ${accessToken}` }
  const response = await fetch(`${API_BASE_URL}/lab-reports/${endpoint}`, { headers, cache: 'no-store' })
  if (!response.ok) throw new Error(`Lab report PDF API failed (${response.status})`)
  return response.blob()
}