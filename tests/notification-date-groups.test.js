import test from 'node:test'
import assert from 'node:assert/strict'
import { groupNotificationsByDate, sortNotificationsNewestFirst } from '../src/notification-date-groups.js'

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
  assert.deepEqual(groups[0].items.map(notification => notification.id), ['legacy', 'offset', 'utc'])
})

test('GEN-10: missing and invalid timestamps stay unavailable, after newest valid groups', () => {
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
  assert.deepEqual(groups.map(group => group.label), ['Today', 'Oct 27, 2026', 'Date unavailable'])
  assert.deepEqual(groups.map(group => group.items.map(notification => notification.id)), [
    ['today-2', 'today-1'], ['old-2', 'old-1'], ['missing', 'invalid-day', 'invalid-time'],
  ])
  assert.equal(groups[1].items[1], notifications[0], 'original notification objects are retained')
})

test('GEN-10: empty input has no headings', () => {
  assert.deepEqual(groupNotificationsByDate([], today), [])
})

test('GEN-10: latest eight precede grouping, ties are stable, source and history untouched', () => {
  const items=Array.from({length:12},(_,i)=>item(String(i),`2026-10-29T${String(i).padStart(2,'0')}:00:00+08:00`))
  const original=structuredClone(items)
  assert.deepEqual(sortNotificationsNewestFirst(items).slice(0,8).map(n=>n.id),['11','10','9','8','7','6','5','4'])
  assert.deepEqual(items,original)
  const ties=[item('a','2026-10-28T16:00:00Z'),item('b','2026-10-29 00:00'),item('c','2026-10-29T00:00:00+0800')]
  assert.deepEqual(sortNotificationsNewestFirst(ties).map(n=>n.id),['a','b','c'])
})

test('GEN-10: offset variants, fractions, bad offsets and unavailable dates are handled', () => {
  const groups=groupNotificationsByDate([
    item('invalid-offset','2026-10-29T00:00:00+99:99'),
    item('before-midnight','2026-10-28T15:59:59Z'),
    item('after-midnight','2026-10-28T16:00:00Z'),
    item('fraction','2026-10-29T00:00:00.001+08'),
    item('missing',null),
  ],today)
  assert.deepEqual(groups.map(g=>g.label),['Today','Yesterday','Date unavailable'])
  assert.deepEqual(groups[0].items.map(n=>n.id),['fraction','after-midnight'])
  assert.deepEqual(groups[2].items.map(n=>n.id),['invalid-offset','missing'])
})
