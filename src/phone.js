import { getCountries, getCountryCallingCode, parsePhoneNumberFromString } from 'libphonenumber-js/max'

const names=new Intl.DisplayNames(['en'],{type:'region'})
export const COUNTRY_CODES=getCountries().map(code=>({
  code,
  dial:`+${getCountryCallingCode(code)}`,
  label:names.of(code)||code,
  // Retained for the existing Owner directory form; registration has no fixed digit limit.
  digits:code==='PH'?10:undefined,
})).sort((a,b)=>a.label.localeCompare(b.label))
export const DEFAULT_COUNTRY=COUNTRY_CODES.find(country=>country.code==='PH')

// The Owner directory's existing Philippine contact control keeps its input behavior.
export function sanitizePhoneInput(value) {
  return String(value||'').replace(/\D/g,'').slice(0,10)
}

export function normalizePhoneNumber(countrySelection,raw) {
  const country=COUNTRY_CODES.find(item=>item.code===countrySelection)
    ||COUNTRY_CODES.find(item=>item.dial===countrySelection)
  if(!country)return {ok:false,reason:'Select a valid country.'}
  const value=String(raw||'').trim()
  if(!value||!/^\+?[\d\s().-]+$/.test(value))return {ok:false,reason:'Enter a valid phone number.'}
  const parsed=parsePhoneNumberFromString(value,country.code)
  if(!parsed?.isValid()||`+${parsed.countryCallingCode}`!==country.dial)
    return {ok:false,reason:`Enter a valid phone number for ${country.label}.`}
  return {ok:true,digits:parsed.nationalNumber,e164:parsed.number}
}

export function formatPhoneDisplay(dial,digits) {
  return digits?`${dial} ${digits}`:dial
}
