import test from 'node:test'
import assert from 'node:assert/strict'
import { dateLabel } from '../src/logic.js'

test('dateLabel shows calendar dates as written, server timestamps as their clinic date, and never "Invalid Date"', () => {
  assert.equal(dateLabel('2026-10-14'), 'Oct 14, 2026')
  assert.equal(dateLabel('2026-10-14T02:28:17+08:00'), 'Oct 14, 2026')
  assert.equal(dateLabel('2026-10-13T18:28:17+00:00'), 'Oct 14, 2026', 'an instant is shown in clinic (Manila) time')
  assert.equal(dateLabel('2026-10-14 02:28:17+08'), 'Oct 14, 2026')
  assert.equal(dateLabel(new Date('2026-10-14T02:28:17+08:00')), 'Oct 14, 2026')
  for (const odd of [null, undefined, '', '   ', 'soon', '14/10/2026', '2026-02-31', '2026-13-01', 42, {}, new Date('nope'), 'T00:00']) {
    const label = dateLabel(odd)
    assert.equal(label, '—', `for ${String(odd)}`)
    assert.ok(!label.includes('Invalid'))
  }
})
