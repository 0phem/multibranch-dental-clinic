// Public presentation data only; never used for M2 authorization or scheduling.
// Names/addresses supplied by the client. Map pins checked against public place records.
// See docs/PUBLIC_AUTH_LOCATIONS_REFINEMENT.md for verification evidence.
// White-label (decision 12): the identity and contact fields below are the FALLBACK only. At startup main.jsx calls
// loadBranding(), which replaces them with the Owner's settings from GET /api/branding before the first render; renders without
// the API (smoke tests, an unreachable server) keep these defaults. Branch map pins stay here as public presentation data.
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
  branches: Object.freeze([
    Object.freeze({
      id: 'bocaue-37', number: '01',
      name: 'Dr. Dana Roxas Dental Clinic',
      address: '#37, MacArthur Hwy, Bocaue, 3018 Bulacan',
      latitude: 14.800254, longitude: 120.9233274,
      source: 'https://www.google.com/maps?cid=15251005469195418416',
    }),
    Object.freeze({
      id: 'bocaue-cardinal', number: '02',
      name: 'Roxas - Cardinal Dental Center',
      address: '67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan',
      latitude: 14.7996762, longitude: 120.9234564,
      source: 'https://www.google.com/maps?cid=166116950672724786',
    }),
    Object.freeze({
      id: 'guiguinto-gd-plaza', number: '03',
      name: 'Roxas Dental Clinic Guiguinto',
      address: 'Unit 20 GD Plaza, Guiguinto, Bulacan',
      latitude: 14.8284409, longitude: 120.8745988,
      source: 'https://www.google.com/maps?cid=9281875676794275970',
    }),
  ]),
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

/** Fetches the public branding once at startup; never blocks the app for more than `timeoutMs`. */
export async function loadBranding(apiBase, timeoutMs = 2500) {
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
