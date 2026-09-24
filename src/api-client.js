// Backend Foundation 1B — thin HTTP client for the real Laravel/Sanctum backend. Every exported function
// returns one normalized result shape, so nothing above this module ever needs to know about Laravel, Sanctum,
// CSRF or raw HTTP status codes:
//   {ok:true, data}
//   {ok:false, kind:'validation', errors:{field:[msg]}, message}
//   {ok:false, kind:'invalid_credentials'|'inactive_account', message}
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
  const headers = { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
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
  if (response.status === 403) return { ok: false, kind: 'forbidden' }
  if (response.status === 419) return { ok: false, kind: 'csrf' }
  if (response.status === 422) {
    const code = body?.code
    if (code === 'invalid_credentials' || code === 'inactive_account') {
      return { ok: false, kind: code, message: body?.message || 'Sign-in failed.' }
    }
    return { ok: false, kind: 'validation', errors: body?.errors || {}, message: body?.message || 'Check the highlighted fields.' }
  }
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
    return { ok: true, data: body?.data ?? body }
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

// Test-only: reset the module-level CSRF cache between test cases (Node's ESM module cache would otherwise
// leak it across test files/cases that share this module instance).
export function __resetCsrfCacheForTests() { resetCsrfCache() }
