import { addDays, clinicDateAt, validDate } from './clock.js'

// Current events have an offset; older demo records store a Manila-local wall time without one.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/

function notificationClinicDate(value) {
  if (typeof value !== 'string') return null
  const match = TIMESTAMP.exec(value.trim())
  if (!match || !validDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return null
  if (!match[5]) return match[1]
  const normalized = value.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  return clinicDateAt(normalized)
}

export function groupNotificationsByDate(notifications, today) {
  const yesterday = addDays(today, -1)
  const groups = new Map()
  for (const notification of notifications) {
    const date = notificationClinicDate(notification.createdAt)
    const key = date || 'unavailable'
    if (!groups.has(key)) {
      const label = !date ? 'Date unavailable' : date === today ? 'Today' : date === yesterday ? 'Yesterday'
        : new Date(`${date}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
      groups.set(key, { key, label, items: [] })
    }
    groups.get(key).items.push(notification)
  }
  return [...groups.values()]
}
