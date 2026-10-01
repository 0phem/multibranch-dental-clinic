// Backend Foundation 1B — thin HTTP client for the real Laravel/Sanctum backend. Every exported function
// returns one normalized result shape, so nothing above this module ever needs to know about Laravel, Sanctum,
// CSRF or raw HTTP status codes:
//   {ok:true, data}
//   {ok:false, kind:'validation', errors:{field:[msg]}, message}
//   {ok:false, kind:'invalid_credentials'|'inactive_account'|'email_verification_required', message}
//   {ok:false, kind:'unauthenticated'|'forbidden'}
//   {ok:false, kind:'network'|'server', message}
// Session auth only (Sanctum SPA cookies) — never a bearer token in localStorage.

function apiBaseUrl() {
  try {
    return (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || 'http://localhost:8000'
  } catch {
    return 'http://localhost:8000'
  }
}

function getCookie(name) {
  if (typeof document === 'undefined') return ''
  const escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

// Sanctum's documented SPA flow: fetch the CSRF cookie once, cache the in-flight/settled promise so concurrent
// mutating calls don't each trigger their own fetch. Cleared on a 419 (stale/expired token) and after logout.
let csrfFetchPromise = null
function resetCsrfCache() { csrfFetchPromise = null }
function ensureCsrfCookie() {
  if (!csrfFetchPromise) {
    csrfFetchPromise = fetch(`${apiBaseUrl()}/sanctum/csrf-cookie`, { credentials: 'include', headers: { Accept: 'application/json' } })
      .catch(error => { csrfFetchPromise = null; throw error })
  }
  return csrfFetchPromise
}

async function rawFetch(path, options) {
  const method = (options.method || 'GET').toUpperCase()
  const isForm = typeof FormData !== 'undefined' && options.body instanceof FormData
  const headers = { Accept: 'application/json', ...(options.body && !isForm ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
  if (method !== 'GET') {
    await ensureCsrfCookie()
    const token = getCookie('XSRF-TOKEN')
    if (token) headers['X-XSRF-TOKEN'] = token
  }
  return fetch(`${apiBaseUrl()}${path}`, { ...options, method, headers, credentials: 'include' })
}


async function parseFailure(response) {
  let body = null
  try { body = await response.json() } catch { /* no JSON body */ }
  if (response.status === 401) return { ok: false, kind: 'unauthenticated' }
  if (response.status === 403) return { ok: false, kind: 'forbidden', message: body?.message || 'This is outside your access.' }
  if (response.status === 404) return { ok: false, kind: 'not_found', message: 'That record could not be found.' }
  // Stale revision or a lost concurrent race (M6): the machine-readable code tells the UI which one.
  if (response.status === 409) return { ok: false, kind: 'conflict', code: body?.code || null, message: body?.message || 'This changed on the server. Refresh and try again.' }
  if (response.status === 419) return { ok: false, kind: 'csrf' }
  if (response.status === 422) {
    const code = body?.code
    if (code === 'invalid_credentials' || code === 'inactive_account' || code === 'email_verification_required') {
      return { ok: false, kind: code, message: body?.message || 'Sign-in failed.' }
    }
    // M6 command refusals add a stable `code`, the failed scheduling checks and alternative start times.
    return { ok: false, kind: 'validation', code: code || null, errors: body?.errors || {}, message: body?.message || 'Check the highlighted fields.',
      failedChecks: Array.isArray(body?.failed_checks) ? body.failed_checks : [], alternatives: Array.isArray(body?.alternatives) ? body.alternatives : [] }
  }
  if (response.status === 429) return { ok: false, kind: 'rate_limited', code: body?.code || null, retry_after: body?.retry_after || 0, message: body?.message || 'Please wait and try again.' }
  if (response.status === 503) return { ok: false, kind: 'server', code: body?.code || null, message: body?.message || 'The clinic system could not send the email. Try again.' }
  if (response.status >= 500) return { ok: false, kind: 'server', message: 'The clinic system is temporarily unavailable. Try again in a moment.' }
  return { ok: false, kind: 'server', message: 'Something unexpected happened. Try again.' }
}

// One CSRF retry, never a loop: a 419 clears the cached cookie state, fetches a fresh one, and retries the
// exact same request exactly once. Any further failure (including a second 419) is returned as-is.
async function request(path, options = {}, { allowCsrfRetry = true } = {}) {
  let response
  try {
    response = await rawFetch(path, options)
  } catch {
    return { ok: false, kind: 'network', message: 'Could not reach the clinic system. Check your connection and try again.' }
  }
  if (response.ok) {
    if (response.status === 204) return { ok: true, data: null }
    const body = await response.json().catch(() => null)
    // Paginated lists keep their meta/links so a client can page through a bounded range.
    return { ok: true, data: body?.data ?? body, ...(body?.meta ? { meta: body.meta } : {}), ...(body?.links ? { links: body.links } : {}) }
  }
  const failure = await parseFailure(response)
  if (failure.kind === 'csrf') {
    resetCsrfCache()
    if (allowCsrfRetry) return request(path, options, { allowCsrfRetry: false })
    return { ok: false, kind: 'network', message: 'Your session could not be verified. Please try again.' }
  }
  return failure
}

export function me() {
  return request('/api/me')
}

export function login(email, password) {
  return request('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) })
}

export function register(payload) {
  return request('/api/register', { method: 'POST', body: JSON.stringify(payload) })
}

export function verifyRegistrationEmail(email, otp) {
  return request('/api/register/verify', { method: 'POST', body: JSON.stringify({ email, otp }) })
}

export function resendRegistrationEmail(email) {
  return request('/api/register/resend', { method: 'POST', body: JSON.stringify({ email }) })
}

// Logout is honest about what actually happened: `backendConfirmed` is true only when the server itself
// confirmed the session was invalidated. A network/server failure still resets the cached CSRF state (the next
// login should never reuse a token from a session that may no longer exist) but must not be reported as a
// confirmed sign-out — the caller decides how to tell the user the difference.
export async function logout() {
  const result = await request('/api/logout', { method: 'POST' })
  resetCsrfCache()
  if (result.ok) return { ok: true, backendConfirmed: true }
  return { ok: false, backendConfirmed: false, kind: result.kind, message: result.message }
}

// Shared session-invalidated signal. A 401 from an authenticated call means the server session may be gone; the app
// shell (App.jsx) subscribes once and revalidates/clears the frontend session through its normal auth path. This is a
// notification only: nothing is retried here, and the failed call still returns its 401 result to its caller.
const sessionInvalidatedListeners = new Set()
export function onSessionInvalidated(listener) {
  sessionInvalidatedListeners.add(listener)
  return () => { sessionInvalidatedListeners.delete(listener) }
}
export function reportSessionInvalidated() {
  resetCsrfCache()
  for (const listener of [...sessionInvalidatedListeners]) listener()
}
// Revalidation after a reported 401: true only when /api/me confirms the same account (user public id) is still signed in.
export async function sessionStillValid(serverUserId) {
  const result = await me()
  return !!(result.ok && serverUserId && result.data?.id === serverUserId)
}

// Test-only: reset the module-level CSRF cache between test cases (Node's ESM module cache would otherwise
// leak it across test files/cases that share this module instance).
export function __resetCsrfCacheForTests() { resetCsrfCache() }

// Phase 2A reference data (see the Phase 2A plan). Read functions: any authenticated role except
// listStaff (Patient is denied server-side — the frontend bootstrap bridge simply never calls this for a
// Patient session, see reference-data-bridge.js). Mutation functions always send legacy_ref-keyed
// identifiers (route segments and branch_ref/service_ref body fields) — never an internal bigint id.
export function listBranches() { return request('/api/branches') }
export function listServices() { return request('/api/services') }
export function listBranchServices() { return request('/api/branch-services') }
export function listStaff() { return request('/api/staff') }
export function listDentists() { return request('/api/dentists') }

export function updateBranch(legacyRef, payload) {
  return request(`/api/branches/${encodeURIComponent(legacyRef)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function setBranchService(payload) {
  return request('/api/branch-services', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateStaffProfile(legacyRef, payload) {
  return request(`/api/staff/${encodeURIComponent(legacyRef)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

export function updateDentistProfile(legacyRef, payload) {
  return request(`/api/dentists/${encodeURIComponent(legacyRef)}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

// M1 User Management is deliberately separate from transitional state.users. These calls are on-demand
// for the Owner screen and expose only the backend account collection.
export function listUserAccounts() { return request('/api/users') }
export function createUserAccountRemote(payload) { return request('/api/users', { method: 'POST', body: JSON.stringify(payload) }) }
export function updateUserAccountRemote(id, payload) { return request(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }) }
export function deleteUserAccountRemote(id) { return request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' }) }

// M6 Appointment API (server-authoritative appointments). Raw calls only; src/appointments-api.js owns paging,
// Idempotency-Key handling and mapping. `key` is the Idempotency-Key for one user confirm attempt.
const query = params => {
  const entries = Object.entries(params || {}).filter(([, value]) => value !== null && value !== undefined && value !== '')
  return entries.length ? `?${new URLSearchParams(entries).toString()}` : ''
}
const command = (path, payload, key) => request(path, { method: 'POST', body: JSON.stringify(payload), headers: key ? { 'Idempotency-Key': key } : {} })
export function listAppointments(params) { return request(`/api/appointments${query(params)}`) }
export function getAppointment(id) { return request(`/api/appointments/${encodeURIComponent(id)}`) }
export function appointmentAvailability(params) { return request(`/api/appointments/availability${query(params)}`) }
export function appointmentRecommendation(params) { return request(`/api/appointments/recommendation${query(params)}`) }
export function createAppointment(payload, key) { return command('/api/appointments', payload, key) }
export function rescheduleAppointment(id, payload, key) { return command(`/api/appointments/${encodeURIComponent(id)}/reschedule`, payload, key) }
export function cancelAppointmentRemote(id, payload, key) { return command(`/api/appointments/${encodeURIComponent(id)}/cancel`, payload, key) }
// Appointment-only lifecycle command: the pre-arrival 'no-show' (Check-In and treatment progression are Visit commands).
export function transitionAppointment(id, name, payload, key) { return command(`/api/appointments/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, payload, key) }
// Minimal M4 Patient directory (Staff/Owner selection) and front-desk registration (Person + Patient, no login).
export function searchPatients(params) { return request(`/api/patients${query(params)}`) }
export function registerPatient(payload, key) { return command('/api/patients', payload, key) }

// M8 Patient Check-In and the shared Visit / Clinical Encounter. Raw calls only; src/visits-api.js owns mapping.
export function listVisits(params) { return request(`/api/visits${query(params)}`) }
export function getVisit(id) { return request(`/api/visits/${encodeURIComponent(id)}`) }
export function checkInVisit(payload, key) { return command('/api/visits/check-in', payload, key) }
export function walkInVisit(payload, key) { return command('/api/visits/walk-in', payload, key) }

// M5 Treatment & Clinical Workflow. Raw calls only; src/treatments-api.js owns mapping. Starting treatment is the atomic
// Treatment command on the Visit (there is no standalone Visit start/complete command).
export function listTreatments(params) { return request(`/api/treatments${query(params)}`) }
export function getTreatment(id) { return request(`/api/treatments/${encodeURIComponent(id)}`) }
export function myTreatments() { return request('/api/treatments/mine') }
export function startTreatment(visitId, payload, key) { return command(`/api/visits/${encodeURIComponent(visitId)}/treatment`, payload, key) }
export function treatmentCommand(id, name, payload, key) { return command(`/api/treatments/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, payload, key) }

// M9 Patient Queue Management (entries are created only by M8 arrival). Raw calls only; src/queue-api.js owns mapping.
export function listQueue(params) { return request(`/api/queue${query(params)}`) }
export function myQueue() { return request('/api/queue/mine') }
export function queueCommand(id, name, payload, key) { return command(`/api/queue/${encodeURIComponent(id)}/${encodeURIComponent(name)}`, payload, key) }

// M13 pricing foundation (Owner-confirmed, effective-dated prices). Raw calls only; src/pricing-api.js owns mapping.
export function listServicePrices() { return request('/api/service-prices') }
export function createServicePrice(serviceRef, payload, key) { return command(`/api/services/${encodeURIComponent(serviceRef)}/prices`, payload, key) }
export function retractServicePrice(id, key) { return command(`/api/service-prices/${encodeURIComponent(id)}/retract`, {}, key) }
export function resolveServicePrice(params) { return request(`/api/prices/resolve${query(params)}`) }

// Minimal M12 HMO foundation. Raw calls only; src/hmo-api.js owns mapping.
export function listHmoCases(params) { return request(`/api/hmo-cases${query(params)}`) }
export function myHmoCases() { return request('/api/hmo-cases/mine') }
export function listClaimDecisions(params) { return request(`/api/hmo/claim-decisions${query(params)}`) }
export function hmoGate(visitId) { return request(`/api/visits/${encodeURIComponent(visitId)}/hmo-gate`) }
export function getHmoMembership(patientId) { return request(`/api/patients/${encodeURIComponent(patientId)}/hmo-membership`) }
// Membership changes go through an in-scope Visit: the server derives the Patient from it (no Patient id is sent).
export function setHmoMembership(visitId, payload, key) { return command(`/api/visits/${encodeURIComponent(visitId)}/hmo-membership`, payload, key) }
export function endHmoMembership(visitId, payload, key) { return command(`/api/visits/${encodeURIComponent(visitId)}/hmo-membership/end`, payload, key) }
export function openHmoCase(visitId, key) { return command(`/api/visits/${encodeURIComponent(visitId)}/hmo-case`, {}, key) }
export function hmoSelfPay(visitId, payload, key) { return command(`/api/visits/${encodeURIComponent(visitId)}/hmo/self-pay`, payload, key) }
export function hmoCaseCommand(id, name, payload, key) { return command(`/api/hmo-cases/${encodeURIComponent(id)}/${name}`, payload, key) }

// M11 server-authoritative billing. These calls never write invoices, payments or receipts to browser storage.
export function listBillingInvoices() { return request('/api/invoices') }
export function listBillingTreatments() { return request('/api/billing/treatments') }
export function createBillingDraft(treatmentId, key) { return command(`/api/invoices/from-treatment/${encodeURIComponent(treatmentId)}`, {}, key) }
export function reviewBillingInvoice(id, payload, key) { return command(`/api/invoices/${encodeURIComponent(id)}/review`, payload, key) }
export function issueBillingInvoice(id, payload, key) { return command(`/api/invoices/${encodeURIComponent(id)}/issue`, payload, key) }
export function recordBillingPayment(id, payload, key) { return command(`/api/invoices/${encodeURIComponent(id)}/payment`, payload, key) }
export function myBillingInvoices() { return request('/api/invoices/mine') }
export function myBillingReceipts() { return request('/api/receipts/mine') }

// M14 Patient Forms, Documents & Consent Management
export function listDocuments(params) { return request(`/api/documents${query(params)}`) }
export function myDocuments() { return request('/api/documents/mine') }
export function getDocument(id) { return request(`/api/documents/${encodeURIComponent(id)}`) }
export function uploadDocument(formData, key) {
  return request('/api/documents', {
    method: 'POST',
    body: formData,
    headers: key ? { 'Idempotency-Key': key } : {},
  })
}
export function retractDocument(id, payload, key) {
  return command(`/api/documents/${encodeURIComponent(id)}/retract`, payload, key)
}
export function listPatientConsents(patientId) {
  return request(`/api/patients/${encodeURIComponent(patientId)}/consents`)
}
export function myConsents() { return request('/api/consents/mine') }
export function grantPatientConsent(patientId, payload, key) {
  return command(`/api/patients/${encodeURIComponent(patientId)}/consents`, payload, key)
}
export function withdrawPatientConsent(patientId, consentId, key) {
  return command(`/api/patients/${encodeURIComponent(patientId)}/consents/${encodeURIComponent(consentId)}/withdraw`, {}, key)
}

// M22 Audit Trail & Activity Monitoring Management (Owner only)
export function listAuditLogs(params) { return request(`/api/audit-logs${query(params)}`) }
export function getAuditLog(id) { return request(`/api/audit-logs/${encodeURIComponent(id)}`) }
