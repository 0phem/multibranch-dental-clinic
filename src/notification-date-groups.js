import { addDays, clinicDateAt, validDate } from './clock.js'

// Current events have an offset; older demo records store a Manila-local wall time without one.
const TIMESTAMP = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|[+-]\d{2}(?::?\d{2})?)?$/

function notificationInstant(value) {
  if (typeof value !== 'string') return null
  const match = TIMESTAMP.exec(value.trim())
  if (!match || !validDate(match[1]) || Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4] || 0) > 59) return null
  if (!match[5]) return Date.parse(value.trim().replace(' ', 'T') + '+08:00')
  const normalized = value.trim().replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00').replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  const instant = Date.parse(normalized)
  return Number.isFinite(instant) ? instant : null
}

// Stable source order breaks equal/unknown timestamps; never rewrite event history.
export function sortNotificationsNewestFirst(notifications) {
  return notifications.map((item,index)=>({item,index,time:notificationInstant(item.createdAt)}))
    .sort((a,b)=>a.time===null?(b.time===null?a.index-b.index:1):b.time===null?-1:b.time-a.time||a.index-b.index)
    .map(row=>row.item)
}

export function groupNotificationsByDate(notifications, today) {
  const yesterday = addDays(today, -1)
  const groups = new Map()
  for (const notification of sortNotificationsNewestFirst(notifications)) {
    const instant = notificationInstant(notification.createdAt)
    const date = instant === null ? null : clinicDateAt(instant)
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
