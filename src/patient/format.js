// Patient portal formatting. All clinic dates and times are Asia/Manila business values from the server; nothing here invents data.
const TZ = 'Asia/Manila'

export const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** "2026-10-15" -> "Thu, Oct 15, 2026" (a calendar date, no timezone shift). */
export function dateLong(date, { year = true } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return ''
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

/** "14:00" -> "2:00 PM". */
export function time12(hhmm) {
  const m = /^(\d{2}):(\d{2})/.exec(String(hhmm || ''))
  if (!m) return ''
  const h = Number(m[1]), suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${m[2]} ${suffix}`
}

export function todayManila(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(now))
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
}

export const initials = name => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0].toUpperCase()).join('') || '•'

const ACTIVE = ['Confirmed', 'Pending']
/** Upcoming = an active appointment that starts in the future, soonest first. */
export function splitAppointments(rows, now = new Date()) {
  const list = Array.isArray(rows) ? rows : []
  const upcoming = list.filter(a => ACTIVE.includes(a.status) && new Date(a.starts_at) > now).sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  const past = list.filter(a => !upcoming.includes(a)).sort((a, b) => b.starts_at.localeCompare(a.starts_at))
  return { upcoming, past }
}

/** An .ics calendar file for one appointment (generated in the browser; nothing is sent anywhere). */
export function icsFor({ id, service, branchName, branchAddress, dentist, startsAt, endsAt, clinicName }) {
  const stamp = iso => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = text => String(text || '').replace(/\\/g, '\\\\').replace(/[,;]/g, m => `\\${m}`).replace(/\n/g, '\\n')
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Patient Portal//EN', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:${id}@patient-portal`, `DTSTAMP:${stamp(new Date().toISOString())}`, `DTSTART:${stamp(startsAt)}`, `DTEND:${stamp(endsAt)}`,
    `SUMMARY:${esc(`${service} · ${clinicName}`)}`, `LOCATION:${esc([branchName, branchAddress].filter(Boolean).join(', '))}`,
    `DESCRIPTION:${esc(dentist ? `With ${dentist}. Please arrive a few minutes early.` : 'Please arrive a few minutes early.')}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(service)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n')
}

export function downloadIcs(appointment, name = 'appointment.ics') {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(new Blob([icsFor(appointment)], { type: 'text/calendar;charset=utf-8' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
