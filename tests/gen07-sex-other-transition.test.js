import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'

test('GEN-07: clearing Other detail does not restore the old sex selection', () => {
  const source = readFileSync(new URL('../src/pages/Clinical.jsx', import.meta.url), 'utf8')
  const field = source.match(/<SelectWithOther label="Sex"[^\n]+/)[0]
  const select = field.match(/onChange=\{(val=>setNewPatient\(patient=>\(\{\.\.\.patient,sex:val\}\)\))\}/)?.[1]
  const detail = field.match(/onOtherChange=\{(val=>setNewPatient\(patient=>\(\{\.\.\.patient,sexOther:val\}\)\))\}/)?.[1]
  assert.ok(select && detail, 'both callbacks queue updates from the latest state')

  const pending = []
  const context = { setNewPatient: update => pending.push(update) }
  const choose = runInNewContext(`(${select})`, context)
  const specify = runInNewContext(`(${detail})`, context)
  choose('Male')
  specify('') // SelectWithOther calls this in the same event when leaving Other.
  const initial = { sex: 'Other', sexOther: 'Custom value', firstName: 'Patient' }
  const result = pending.reduce((patient, update) => update(patient), initial)
  assert.deepEqual({ ...result }, { sex: 'Male', sexOther: '', firstName: 'Patient' })

  pending.length = 0
  choose('Other')
  specify('Another custom value')
  const next = pending.reduce((patient, update) => update(patient), result)
  assert.equal(next.sex, 'Other')
  assert.equal(next.sexOther, 'Another custom value')
})
