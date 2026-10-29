import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('GEN-07: patient cancellation clears a hidden custom reason when leaving Other', () => {
  const source = read('src/patient/pages/Visits.jsx')
  const handler = source.match(/<select value=\{reason\} onChange=\{(e => \{[^}]+\})\}>/)?.[1]
  assert.ok(handler)
  let reason = 'Other', detail = 'Earlier custom reason', error = 'Earlier error'
  const change = runInNewContext(`(${handler})`, {
    setReason: value => { reason = value },
    setCustomReason: value => { detail = value },
    setError: value => { error = value },
  })
  change({ target: { value: 'Other' } })
  assert.equal(detail, 'Earlier custom reason')
  change({ target: { value: 'Schedule conflict' } })
  assert.equal(reason, 'Schedule conflict')
  assert.equal(detail, '')
  assert.equal(error, '')
  change({ target: { value: 'Other' } })
  assert.equal(detail, '')
  assert.match(source, /const effectiveReason = reason === 'Other' \? customReason\.trim\(\) : reason/)
})

test('GEN-07: staff follow-up clears a hidden custom reason when leaving Other', () => {
  const source = read('src/pages/ServerFollowups.jsx')
  const handler = source.match(/<select value=\{reasonCategory\} onChange=\{(e => \{[^}]+\})\}>/)?.[1]
  assert.ok(handler)
  let category = 'Other', detail = 'Earlier clinical reason'
  const change = runInNewContext(`(${handler})`, {
    setReasonCategory: value => { category = value },
    setCustomReason: value => { detail = value },
  })
  change({ target: { value: 'Other' } })
  assert.equal(detail, 'Earlier clinical reason')
  change({ target: { value: 'Suture Removal' } })
  assert.equal(category, 'Suture Removal')
  assert.equal(detail, '')
  change({ target: { value: 'Other' } })
  assert.equal(detail, '')
  assert.match(source, /const effectiveReason = reasonCategory === 'Other' \? customReason\.trim\(\) : reasonCategory/)
})
