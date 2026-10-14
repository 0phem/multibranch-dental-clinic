// Public presentation data only; never used for M2 authorization or scheduling.
// Only the clinic's name and contact live here, as the fallback when the server cannot be reached. Branches (names, addresses,
// map pins) come from the clinic records through GET /api/public/branches (docs/BRANCH_LOCATIONS.md).
// White-label (decision 12): the identity and contact fields below are the FALLBACK only. At startup main.jsx calls
// loadBranding(), which replaces them with the Owner's settings from GET /api/branding before the first render; renders without
// the API (smoke tests, an unreachable server) keep these defaults.
export const clinic = {
  name: 'Dr. Dana E. Roxas Dental Clinic',
  nameLine: 'Dr. Dana E. Roxas',
  subtitle: 'Dental Clinic',
  locationLabel: 'Dr. Dana E. Roxas Dental Clinic - Bocaue, Bulacan',
  city: 'Bocaue, Bulacan',
  phoneDisplay: '0922 878 7341',
  phoneE164: '+639228787341',
  email: 'danaroxas.dentalclinic@gmail.com',
  logo: '/images/logo.png',
}

/** Applies the public branding (GET /api/branding) to `clinic`. Unknown or empty values keep the fallback. */
export function applyBranding(data) {
  if (!data || typeof data !== 'object') return clinic
  const text = value => (typeof value === 'string' && value.trim() ? value.trim() : null)
  const set = (key, value) => { if (value) clinic[key] = value }
  set('name', text(data.name))
  set('nameLine', text(data.name_line))
  set('subtitle', text(data.subtitle))
  set('city', text(data.address))
  set('email', text(data.email))
  const phone = text(data.phone)
  if (phone) {
    clinic.phoneDisplay = phone
    const digits = phone.replace(/[^0-9+]/g, '')
    clinic.phoneE164 = digits.startsWith('+') ? digits : digits.startsWith('0') ? `+63${digits.slice(1)}` : digits
  }
  if (text(data.name) || text(data.address)) clinic.locationLabel = [clinic.name, clinic.city].filter(Boolean).join(' - ')
  // Only an uploaded logo replaces the supplied one; otherwise the official /images/logo.png stays (full resolution).
  if (data.logo_custom === true && typeof data.logo_url === 'string' && /^https?:\/\//.test(data.logo_url)) clinic.logo = data.logo_url
  return clinic
}

let publicApiBase = 'http://localhost:8000'

/** The open branches for the public website, from the clinic records. {ok, branches} — never a built-in list. */
export async function loadPublicBranches(timeoutMs = 6000) {
  if (typeof fetch !== 'function') return { ok: false, branches: [] }
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const response = await fetch(`${publicApiBase.replace(/\/$/, '')}/api/public/branches`, { headers: { Accept: 'application/json' }, signal: controller?.signal })
    const rows = response.ok ? (await response.json())?.data : null
    if (!Array.isArray(rows)) return { ok: false, branches: [] }
    return { ok: true, branches: rows.filter(b => b && typeof b.name === 'string' && typeof b.address === 'string').map(b => ({ id: String(b.id), number: String(b.number || ''), name: b.name, address: b.address,
      latitude: typeof b.latitude === 'number' ? b.latitude : null, longitude: typeof b.longitude === 'number' ? b.longitude : null })) }
  } catch { return { ok: false, branches: [] } } finally { clearTimeout(timer) }
}

/** Fetches the public branding once at startup; never blocks the app for more than `timeoutMs`. */
export async function loadBranding(apiBase, timeoutMs = 2500) {
  publicApiBase = apiBase || publicApiBase
  if (typeof fetch !== 'function') return clinic
  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/branding`, { headers: { Accept: 'application/json' }, credentials: 'include', signal: controller?.signal })
    if (response.ok) applyBranding((await response.json())?.data)
  } catch { /* offline or slow: the fallback stays */ } finally { clearTimeout(timer) }
  if (typeof document !== 'undefined') document.title = clinic.name
  return clinic
}
