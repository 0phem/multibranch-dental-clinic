// Deep link to one invoice on the Patient billing page: `/?invoice=<public id>[&payment=success|cancelled]#sign-in`.
// Used by the Invoice and Payment Receipt email buttons and by PayMongo's return URLs (both built by the server). When the
// visitor is not signed in, the request is kept for this browser tab only (sessionStorage) and applied after sign-in.
// The `payment` value only says which message to show while the page asks the server; it is never treated as proof of payment.
const KEY = 'dentalops-v4-invoice-link'
const ID = /^[0-9a-z]{26}$/i

export function readInvoiceLink(search) {
  let params
  try { params = new URLSearchParams(search || '') } catch { return null }
  const invoiceId = (params.get('invoice') || '').trim()
  if (!ID.test(invoiceId)) return null
  const payment = params.get('payment')
  return { invoiceId: invoiceId.toLowerCase(), payment: payment === 'success' || payment === 'cancelled' ? payment : null }
}

export function rememberInvoiceLink(link, storage = globalThis.sessionStorage) {
  if (!link) return
  try { storage?.setItem(KEY, JSON.stringify(link)) } catch { /* storage unavailable: the link still works if already signed in */ }
}

/** Returns the remembered link once and forgets it, so a later sign-in does not jump to an old invoice. */
export function takeInvoiceLink(storage = globalThis.sessionStorage) {
  let raw = null
  try { raw = storage?.getItem(KEY) ?? null; storage?.removeItem(KEY) } catch { return null }
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return readInvoiceLink(`?invoice=${encodeURIComponent(parsed?.invoiceId || '')}${parsed?.payment ? `&payment=${encodeURIComponent(parsed.payment)}` : ''}`)
  } catch { return null }
}

/** Drops ?invoice= and ?payment= from the address bar (no reload), so refreshing does not replay the link. */
export function clearInvoiceLinkFromUrl(win = globalThis.window) {
  try {
    const url = new URL(win.location.href)
    if (!url.searchParams.has('invoice') && !url.searchParams.has('payment')) return
    url.searchParams.delete('invoice')
    url.searchParams.delete('payment')
    url.hash = ''
    win.history.replaceState(win.history.state, '', `${url.pathname}${url.search}`)
  } catch { /* nothing to clean */ }
}
