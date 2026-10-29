import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/pages/CounterIntake.jsx', import.meta.url), 'utf8')

test('STF-04 / GEN-07: counter confirmation clears Other ID detail on ordinary ID selection', () => {
  const handler = source.match(/<select value=\{idType\} onChange=\{(e => \{[^}]+\})\}>/)?.[1]
  assert.ok(handler)
  let type = 'other', detail = 'Company ID'
  const change = runInNewContext(`(${handler})`, {
    setIdType: value => { type = value },
    setIdOther: value => { detail = value },
  })
  change({ target: { value: 'other' } })
  assert.equal(detail, 'Company ID')
  change({ target: { value: 'philid' } })
  assert.equal(type, 'philid')
  assert.equal(detail, '')
  change({ target: { value: 'other' } })
  assert.equal(detail, '')
  assert.match(source, /idType === 'other' \? \{ other_details: idOther\.trim\(\) \} : \{\}/)
})

test('STF-04 / GEN-07: patient-record ID check clears Other detail on ordinary ID selection', () => {
  const handler = source.match(/<select aria-label="ID shown" value=\{type\} onChange=\{(e => \{[^}]+\})\}>/)?.[1]
  assert.ok(handler)
  let type = 'other', detail = 'School ID'
  const change = runInNewContext(`(${handler})`, {
    setType: value => { type = value },
    setOtherText: value => { detail = value },
  })
  change({ target: { value: 'other' } })
  assert.equal(detail, 'School ID')
  change({ target: { value: 'passport' } })
  assert.equal(type, 'passport')
  assert.equal(detail, '')
  change({ target: { value: 'other' } })
  assert.equal(detail, '')
  assert.match(source, /type === 'other' \? \{ other_details: otherText\.trim\(\) \} : \{\}/)
})
