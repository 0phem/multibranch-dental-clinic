// Module 21: Operational Analytics & Executive Intelligence API
import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

export async function fetchExecutiveSummary(params = {}) {
  const res = await api.getExecutiveSummary(params)
  if (!res.ok) throw normalizeFailure(res)
  return res.data
}

export async function fetchBranchPerformance(params = {}) {
  const res = await api.getBranchPerformance(params)
  if (!res.ok) throw normalizeFailure(res)
  return res.data
}

export async function downloadAnalyticsCsv(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000'
  const url = `${baseUrl}/api/analytics/export${query ? `?${query}` : ''}`

  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(res.status === 403 ? 'Analytics export is restricted to the clinic Owner.' : 'Failed to export analytics report.')
  }

  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `operational-analytics-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
