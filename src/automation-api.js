// Module 23: Integrated Workflow & Automation Control API
import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

export async function fetchAutomationSnapshot(branchId = null) {
  const res = await api.getAutomationSnapshot(branchId)
  if (!res.ok) throw normalizeFailure(res)
  return res.data
}

export async function fetchAutomationRules() {
  const res = await api.listAutomationRules()
  if (!res.ok) throw normalizeFailure(res)
  return res.data
}

export async function fetchAutomationActions(params = {}) {
  const res = await api.listAutomationActions(params)
  if (!res.ok) throw normalizeFailure(res)
  return res
}

export async function dispatchAutomationRule(ruleCode, payload = {}) {
  const res = await api.dispatchAutomationRule(ruleCode, payload)
  if (!res.ok) throw normalizeFailure(res)
  return res
}

export async function downloadAutomationCsv(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000'
  const url = `${baseUrl}/api/automation/export-csv${query ? `?${query}` : ''}`

  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(res.status === 403 ? 'Automation export is restricted to the clinic Owner.' : 'Failed to export automation activity.')
  }

  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `automation-activity-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
