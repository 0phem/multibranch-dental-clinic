// One clinic clock for validation, encounter dates, and event timestamps.
// Tests can inject a fixed instant; the application uses the actual Manila time.
export const CLINIC_TIME_ZONE = 'Asia/Manila'
let source = () => new Date()
export function setClockSource(next) { source = next || (() => new Date()) }
export function clinicNow() {
  const instant = source()
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIME_ZONE, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23',
  }).formatToParts(instant).map(p => [p.type, p.value]))
  const date = `${parts.year}-${parts.month}-${parts.day}`
  const time = `${parts.hour}:${parts.minute}`
  return { date, time, label:`${date} ${time}`, timestamp:`${date}T${time}:${parts.second}+08:00` }
}
export const clinicDate = () => clinicNow().date
export function addDays(date, days) {
  const value = new Date(`${date}T00:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0,10)
}
export function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return false
  const value = new Date(`${date}T00:00:00Z`)
  return !Number.isNaN(value.getTime()) && value.toISOString().slice(0,10) === date
}
// Rebase only pristine seed operational dates. Persisted encounters never move days.
export function rebaseDemoRecords(records, today=clinicDate()) {
  const offset = (Date.parse(`${today}T00:00:00Z`) - Date.parse('2026-09-19T00:00:00Z')) / 86400000
  const visit = value => {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(?:$|[ T])/.test(value)) return addDays(value.slice(0,10),offset) + value.slice(10)
    if (Array.isArray(value)) return value.map(visit)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,visit(item)]))
    return value
  }
  return visit(records)
}
