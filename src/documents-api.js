import * as api from './api-client.js'
import { normalizeFailure } from './appointments-api.js'

export function mapDocument(row) {
  return {
    id: row.id,
    title: row.title || row.original_filename,
    category: row.category,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    fileSizeFormatted: row.file_size_bytes < 1024 * 1024
      ? `${(row.file_size_bytes / 1024).toFixed(1)} KB`
      : `${(row.file_size_bytes / (1024 * 1024)).toFixed(2)} MB`,
    checksumSha256: row.checksum_sha256,
    status: row.status,
    patient: row.patient || null,
    branch: row.branch || null,
    uploader: row.uploader || null,
    retractionReason: row.retraction_reason || null,
    retractedAt: row.retracted_at || null,
    createdAt: row.created_at,
    metadata: row.metadata || {},
    extractions: (row.extractions || []).map(e => ({
      id: e.id,
      extractionMethod: e.extraction_method,
      status: e.status,
      rawText: e.raw_text,
      structuredPayload: e.structured_payload || {},
      createdAt: e.created_at,
    })),
  }
}

export function mapConsent(row) {
  return {
    id: row.id,
    consentType: row.consent_type,
    version: row.version,
    status: row.status,
    signedAt: row.signed_at,
    withdrawnAt: row.withdrawn_at,
    notes: row.notes,
    patient: row.patient || null,
    documentId: row.document_id || null,
    recordedBy: row.recorded_by || null,
    createdAt: row.created_at,
  }
}

export async function fetchDocuments(params) {
  const res = await api.listDocuments(params)
  if (!res.ok) throw normalizeFailure(res)
  return (res.data || []).map(mapDocument)
}

export async function fetchMyDocuments() {
  const res = await api.myDocuments()
  if (!res.ok) throw normalizeFailure(res)
  return (res.data || []).map(mapDocument)
}

export async function fetchDocument(id) {
  const res = await api.getDocument(id)
  if (!res.ok) throw normalizeFailure(res)
  return mapDocument(res.data)
}

export async function submitDocumentUpload(formData) {
  const res = await api.uploadDocument(formData)
  if (!res.ok) throw normalizeFailure(res)
  return mapDocument(res.data)
}

export async function retractDocument(id, reason) {
  const res = await api.retractDocument(id, { reason })
  if (!res.ok) throw normalizeFailure(res)
  return mapDocument(res.data)
}

export async function fetchPatientConsents(patientId) {
  const res = await api.listPatientConsents(patientId)
  if (!res.ok) throw normalizeFailure(res)
  return (res.data || []).map(mapConsent)
}

export async function fetchMyConsents() {
  const res = await api.myConsents()
  if (!res.ok) throw normalizeFailure(res)
  return (res.data || []).map(mapConsent)
}

export async function grantConsent(patientId, payload) {
  const res = await api.grantPatientConsent(patientId, payload)
  if (!res.ok) throw normalizeFailure(res)
  return mapConsent(res.data)
}

export async function withdrawConsent(patientId, consentId) {
  const res = await api.withdrawPatientConsent(patientId, consentId)
  if (!res.ok) throw normalizeFailure(res)
  return mapConsent(res.data)
}

export async function downloadDocumentFile(id, filename) {
  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000'
  const url = `${baseUrl}/api/documents/${encodeURIComponent(id)}/download`
  const res = await fetch(url, { credentials: 'include' })
  if (!res.ok) {
    let msg = 'Could not download document.'
    if (res.status === 410) msg = 'This document has been retracted and is no longer available for download.'
    if (res.status === 403) msg = 'You do not have permission to download this document.'
    throw new Error(msg)
  }
  const blob = await res.blob()
  const blobUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = filename || 'document'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(blobUrl)
}
