// Country-code-aware phone input support. Structured as a small table so a future country is an additional
// entry, not a redesign — but only Philippines (+63) is enabled/selectable in this checkpoint. Never implies
// another country's numbers are supported: there is no validation rule for one.
export const COUNTRY_CODES = [
  { code: 'PH', dial: '+63', label: 'Philippines', digits: 10 },
]
export const DEFAULT_COUNTRY = COUNTRY_CODES[0]

const onlyFormattingChars = value => value.replace(/[\s\-()]/g, '')

// Strips cosmetic formatting (spaces, dashes, parentheses) — never actual digits — then requires exactly
// the country's local-number length, digits only, with no leading 0 (the 0 is only ever used with the
// domestic trunk prefix, which the country code already replaces). A 9- or 11-digit result, or any
// remaining non-digit character, is a rejection, not a silent mutation into something "close enough."
export function normalizePhoneNumber(dial, raw) {
  const country = COUNTRY_CODES.find(c => c.dial === dial)
  if (!country) return { ok: false, reason: 'Unsupported country code.' }
  const stripped = onlyFormattingChars(typeof raw === 'string' ? raw : '')
  if (!/^\d+$/.test(stripped)) return { ok: false, reason: 'Enter digits only.' }
  if (stripped.length !== country.digits) {
    return { ok: false, reason: `Enter exactly ${country.digits} digits after ${country.dial}.` }
  }
  if (stripped[0] === '0') return { ok: false, reason: `Don’t include the leading 0 after ${country.dial}.` }
  return { ok: true, digits: stripped, e164: `${country.dial}${stripped}` }
}

// For display: "+63 9994936192" — never mutates the underlying value, purely presentational.
export function formatPhoneDisplay(dial, digits) {
  return digits ? `${dial} ${digits}` : dial
}
