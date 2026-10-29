import test from 'node:test'
import assert from 'node:assert/strict'
import { dutyForBranch } from '../src/work-hours-duty.js'

const today = '2026-10-30'
const duty = { date: today, rows: [
  { dentist_id: 'd1', branch_id: 'b1', on_duty_today: true },
  { dentist_id: 'd1', branch_id: 'b2', on_duty_today: false },
] }

test('DEN-12 uses only the current branch-scoped server duty projection', () => {
  assert.equal(dutyForBranch(duty, 'd1', 'b1', today), 'on')
  assert.equal(dutyForBranch(duty, 'd1', 'b2', today), 'off')
  assert.equal(dutyForBranch(duty, 'd2', 'b1', today), 'unknown')
  assert.equal(dutyForBranch({ date: today, rows: [{ dentist_id: 'd1', branch_id: 'b1' }] }, 'd1', 'b1', today), 'unknown')
  assert.equal(dutyForBranch({ ...duty, date: '2026-10-29' }, 'd1', 'b1', today), 'unknown')
  assert.equal(dutyForBranch(null, 'd1', 'b1', today), 'unknown')
})
