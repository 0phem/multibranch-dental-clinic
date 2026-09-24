import test from 'node:test'
import assert from 'node:assert/strict'
import { addCalendarMonths, maxBookingDate } from '../src/clock.js'

// Calendar-month addition with end-of-month clamping — never naive Date rollover (which would turn
// 2026-07-31 + 2 months into October, not September 30).
test('addCalendarMonths matches simple same-day cases', () => {
  assert.equal(addCalendarMonths('2026-09-24', 2), '2026-11-24')
})

test('addCalendarMonths clamps to the shorter target month\'s last day', () => {
  assert.equal(addCalendarMonths('2026-07-31', 2), '2026-09-30')
})

test('addCalendarMonths clamps into a non-leap February after a leap year', () => {
  assert.equal(addCalendarMonths('2026-12-31', 2), '2027-02-28')
  assert.equal(addCalendarMonths('2028-12-31', 2), '2029-02-28')
})

test('addCalendarMonths clamps into a leap February correctly (29, not 28)', () => {
  assert.equal(addCalendarMonths('2027-12-31', 2), '2028-02-29')
})

test('maxBookingDate is addCalendarMonths(today, 2), inclusive', () => {
  assert.equal(maxBookingDate('2026-09-24'), '2026-11-24')
})
