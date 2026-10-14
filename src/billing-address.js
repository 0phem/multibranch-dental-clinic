// M11 decision 9: the optional structured billing address sent to PayMongo (its documented keys). Mirrors the server rules.
const REQUIRED = ['line1', 'city', 'state', 'postal_code', 'country']
export const ADDRESS_LABELS = { line1: 'Address line 1', line2: 'Address line 2', city: 'City / Municipality', state: 'Province', postal_code: 'Postal code', country: 'Country code' }

/** Client-side check mirroring the server rules: the address is optional, but once started it must be complete. */
export function billingAddressErrors(address) {
  const values = Object.fromEntries(Object.keys(ADDRESS_LABELS).map(k => [k, String(address?.[k] ?? '').trim()]))
  const started = ['line1', 'line2', 'city', 'state', 'postal_code'].some(k => values[k] !== '')
  if (!started) return { errors: {}, address: null }
  const errors = {}
  for (const key of REQUIRED) if (!values[key]) errors[key] = `Enter the ${ADDRESS_LABELS[key].toLowerCase()}.`
  if (values.country && !/^[A-Za-z]{2}$/.test(values.country)) errors.country = 'Use the two-letter country code, for example PH.'
  if (values.postal_code && !/^[A-Za-z0-9 -]+$/.test(values.postal_code)) errors.postal_code = 'Use letters, numbers, spaces or dashes only.'
  return { errors, address: { ...values, country: values.country.toUpperCase() } }
}
