import test from 'node:test'
import assert from 'node:assert/strict'
import { groupNotificationsByDate } from '../src/notification-date-groups.js'

const today = '2026-10-29'
const item = (id, createdAt) => ({ id, createdAt })

test('GEN-10: Manila today, yesterday, and older dates get distinct labels', () => {
  const groups = groupNotificationsByDate([
    item('today', '2026-10-29T09:00:00+08:00'),
    item('yesterday', '2026-10-28T23:59:00+08:00'),
    item('older', '2026-10-27T10:30:00+08:00'),
  ], today)
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Yesterday', 'Oct 27, 2026'])
  assert.deepEqual(groups.map(group => group.items.map(notification => notification.id)), [['today'], ['yesterday'], ['older']])
})

test('GEN-10: UTC midnight crossing and legacy Manila wall times share the clinic date', () => {
  const groups = groupNotificationsByDate([
    item('utc', '2026-10-28T16:15:00Z'),
    item('offset', '2026-10-29T00:30:00+08:00'),
    item('legacy', '2026-10-29 01:00'),
  ], today)
  assert.equal(groups.length, 1)
  assert.equal(groups[0].label, 'Today')
  assert.deepEqual(groups[0].items.map(notification => notification.id), ['utc', 'offset', 'legacy'])
})

test('GEN-10: missing and invalid timestamps stay unavailable, with first-seen group order', () => {
  const notifications = [
    item('old-1', '2026-10-27T08:00:00+08:00'),
    item('missing', undefined),
    item('today-1', '2026-10-29T10:00:00+08:00'),
    item('old-2', '2026-10-27T09:00:00+08:00'),
    item('invalid-day', '2026-02-30T10:00:00+08:00'),
    item('invalid-time', '2026-10-29T25:99:00+08:00'),
    item('today-2', '2026-10-29T11:00:00+08:00'),
  ]
  const groups = groupNotificationsByDate(notifications, today)
  assert.deepEqual(groups.map(group => group.label), ['Oct 27, 2026', 'Date unavailable', 'Today'])
  assert.deepEqual(groups.map(group => group.items.map(notification => notification.id)), [
    ['old-1', 'old-2'], ['missing', 'invalid-day', 'invalid-time'], ['today-1', 'today-2'],
  ])
  assert.equal(groups[0].items[0], notifications[0], 'original notification objects are retained')
})

test('GEN-10: empty input has no headings', () => {
  assert.deepEqual(groupNotificationsByDate([], today), [])
})
