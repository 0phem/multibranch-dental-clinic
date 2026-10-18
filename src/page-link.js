// Deep links from the automation emails, applied after sign-in (kept for this tab only, like invoice-link.js):
//   /?appointment=<public id>#sign-in   Patient: My visits, focused on that appointment (reschedule or cancel there)
//   /?open=book#sign-in                 Patient: Book a visit
//   /?open=reports#sign-in              Owner: Analytics & Reports
// The server still decides whether the appointment belongs to the person signing in.
const KEY = 'dentalops-v4-page-link'
const ID = /^[0-9a-z]{26}$/i
const PAGES = ['book', 'reports']

export function readPageLink(search) {
  let params
  try { params = new URLSearchParams(search || '') } catch { return null }
  const appointmentId = (params.get('appointment') || '').trim()
  if (ID.test(appointmentId)) return { appointmentId: appointmentId.toLowerCase() }
  const page = (params.get('open') || '').trim()
  return PAGES.includes(page) ? { page } : null
}

export function rememberPageLink(link, storage = globalThis.sessionStorage) {
  if (!link) return
  try { storage?.setItem(KEY, JSON.stringify(link)) } catch { /* storage unavailable */ }
}

/** Returns the remembered link once and forgets it. */
export function takePageLink(storage = globalThis.sessionStorage) {
  let raw = null
  try { raw = storage?.getItem(KEY) ?? null; storage?.removeItem(KEY) } catch { return null }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return readPageLink(parsed?.appointmentId ? `?appointment=${encodeURIComponent(parsed.appointmentId)}` : `?open=${encodeURIComponent(parsed?.page || '')}`)
  } catch { return null }
}

/** Where a link opens for a role: [page, context] or null when the link is not for this role. */
export function pageForLink(link, role) {
  if (!link) return null
  if (role === 'patient' && link.appointmentId) return ['visits', { appointmentId: link.appointmentId }]
  if (role === 'patient' && link.page === 'book') return ['book', null]
  if (role === 'owner' && link.page === 'reports') return ['analytics', null]
  return null
}

export function clearPageLinkFromUrl(win = globalThis.window) {
  try {
    const url = new URL(win.location.href)
    if (!url.searchParams.has('appointment') && !url.searchParams.has('open')) return
    url.searchParams.delete('appointment')
    url.searchParams.delete('open')
    url.hash = ''
    win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}`)
  } catch { /* nothing to clean */ }
}
