import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

export function mapAuditLog(row) {
  return {
    id: row.id,
    action: row.action,
    category: row.category,
    severity: row.severity,
    actor: row.actor || { id: null, name: 'System', role: 'system' },
    branch: row.branch || null,
    auditableType: row.auditable_type,
    auditableId: row.auditable_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    payload: row.payload || {},
    createdAt: row.created_at,
  }
}

export async function fetchAuditLogs(params = {}) {
  const res = await api.listAuditLogs(params)
  if (!res.ok) throw normalizeFailure(res)
  return (res.data || []).map(mapAuditLog)
}

export async function fetchAuditLog(id) {
  const res = await api.getAuditLog(id)
  if (!res.ok) throw normalizeFailure(res)
  return mapAuditLog(res.data)
}

export async function downloadAuditLogsCsv(params = {}) {
  const query = Object.entries(params)
    .filter(([, v]) => v !== null && v !== undefined && v !== '' && v !== 'all')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000'
  const url = `${baseUrl}/api/audit-logs/export${query ? `?${query}` : ''}`

  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    throw new Error(res.status === 403 ? 'Audit trail export is restricted to the clinic Owner.' : 'Failed to export audit logs.')
  }

  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `audit_trail_${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
