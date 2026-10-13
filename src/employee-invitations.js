import * as api from './api-client.js'

// M1 employee provisioning (client side). The server decides everything: who may invite (Owner), which roles (Staff,
// Dentist), validity and acceptance. This module only maps responses and words M18 dispatch outcomes truthfully.

export const INVITABLE_ROLES = [['staff', 'Staff'], ['dentist', 'Dentist']]

export function mapInvitation(row) {
  return {
    id: row.id, name: row.name || '', email: row.email || '', role: row.role, title: row.title || '',
    branchName: row.branch?.name || '', status: row.status, expiresAt: row.expires_at || null, expired: !!row.expired,
    lastDelivery: row.last_delivery?.status || null,
  }
}

/** The send outcome as the server reported it. Never says "delivered": no inbox receipt exists. */
export function deliveryNotice(delivery) {
  const status = delivery?.status
  if (status === 'transport_accepted') return { tone: 'success', title: 'Invitation handed to the mail service', message: delivery.message || 'Accepted by the mail transport. Delivery to the inbox is not confirmed.' }
  if (status === 'logged_only') return { tone: 'warning', title: 'Invitation not emailed', message: delivery.message || 'The clinic mail transport is not set up for delivery, so the email was only recorded locally.' }
  if (status === 'failed') return { tone: 'warning', title: 'Invitation email failed', message: delivery.message || 'Sending failed. The invitation was saved; use Resend after the mail settings are fixed.' }
  return { tone: 'info', title: 'Invitation saved', message: 'The server did not report a send outcome.' }
}

export const deliveryLabel = status => ({ transport_accepted: 'Accepted by mail transport', logged_only: 'Recorded locally only (not emailed)', failed: 'Send failed' }[status] || 'No send recorded')

export function invitationPayload(form) {
  return {
    role: form.role, first_name: form.firstName, last_name: form.lastName, email: form.email, phone: form.phone || null,
    title: form.role === 'staff' ? form.title : null, branch_ref: form.branchId, shift_start: form.shiftStart, shift_end: form.shiftEnd,
    license_no: form.role === 'dentist' ? form.licenseNo || null : null, specialty: form.role === 'dentist' ? form.specialty || null : null,
  }
}

export async function fetchInvitations() {
  const result = await api.listEmployeeInvitations()
  return result.ok ? { ok: true, records: (result.data || []).map(mapInvitation) } : result
}
export async function sendInvitation(form) {
  const result = await api.createEmployeeInvitation(invitationPayload(form))
  return result.ok ? { ok: true, record: mapInvitation(result.data), delivery: result.delivery || null } : result
}
export async function resendInvitation(id) {
  const result = await api.resendEmployeeInvitation(id)
  return result.ok ? { ok: true, record: mapInvitation(result.data), delivery: result.delivery || null } : result
}
export async function cancelInvitation(id) {
  const result = await api.cancelEmployeeInvitation(id)
  return result.ok ? { ok: true, record: mapInvitation(result.data) } : result
}

/** Reads `#accept-invitation?email=…&token=…`. Returns null for anything malformed. */
export function parseAcceptHash(hash) {
  if (typeof hash !== 'string' || !hash.startsWith('#accept-invitation')) return null
  const params = new URLSearchParams(hash.slice(hash.indexOf('?') + 1 || hash.length))
  const email = (params.get('email') || '').trim().toLowerCase(), token = params.get('token') || ''
  return email && /^[A-Za-z0-9]{64}$/.test(token) ? { email, token } : null
}

export async function acceptInvitation({ email, token, password, passwordConfirmation }) {
  return api.acceptEmployeeInvitation({ email, token, password, password_confirmation: passwordConfirmation })
}
