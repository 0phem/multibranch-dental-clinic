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
// Last real day of the given month (1-indexed). Day 0 of the following month is the prior month's last
// day — this is how JS Date already knows about leap years, with no manual leap arithmetic here.
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
// Calendar-month addition with end-of-month clamping, not naive Date rollover (which would turn
// Jan 31 + 1 month into Mar 3). 2026-07-31 + 2 months lands on 2026-09-30, not October.
export function addCalendarMonths(date, months) {
  const [y, m, d] = date.split('-').map(Number)
  const zeroIndexed = (m - 1) + months
  const year = y + Math.floor(zeroIndexed / 12)
  const month = ((zeroIndexed % 12) + 12) % 12 + 1
  const day = Math.min(d, daysInMonth(year, month))
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}
// Patients may book/reschedule no more than two calendar months ahead (inclusive maximum).
export function maxBookingDate(today=clinicDate()) {
  return addCalendarMonths(today, 2)
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

export function clinicDateAt(timestamp) {
  const instant=new Date(timestamp)
  if(!Number.isFinite(instant.getTime()))return null
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:CLINIC_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(instant).map(p=>[p.type,p.value]))
  return `${parts.year}-${parts.month}-${parts.day}`
}
