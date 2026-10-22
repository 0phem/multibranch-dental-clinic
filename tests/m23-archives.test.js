import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MODULES, NAV } from '../src/data.js'
import { DOMAIN_MODULE } from '../src/module-map.js'

test('Module 23 metadata: Archives & Historical Records Management', () => {
  const m23 = MODULES.find(m => m.no === 23)
  assert.ok(m23, 'Module 23 must exist in MODULES registry')
  assert.equal(m23.no, 23)
  assert.equal(m23.name, 'Archives & Historical Records Management')
  assert.equal(m23.owner, 'Delos Santos, Joevan')
  assert.equal(m23.area, 'Archives')
  assert.deepEqual(m23.roles, ['patient', 'staff', 'dentist', 'owner'])
  assert.equal(DOMAIN_MODULE.archives, 23, 'archives domain key maps to Module 23')
})

test('Patient portal: Family tab is removed and Archives tab is active', () => {
  const portalCode = readFileSync('src/patient/Portal.jsx', 'utf8')
  // Verify Family tab is gone from active NAV
  assert.doesNotMatch(portalCode, /\['family',\s*'user',\s*'Family'\]/)
  assert.doesNotMatch(portalCode, /\['feedback',\s*'star',\s*'Feedback'\]/)
  // Verify Archives tab is present
  assert.match(portalCode, /\['archives',\s*'archive',\s*'Archives'\]/)
  assert.match(portalCode, /case 'archives':/)
})

test('Staff and Owner navigation include Archives & Records', () => {
  for (const role of ['staff', 'dentist', 'owner']) {
    const hasArchives = NAV[role].some(([k]) => k === 'archives')
    assert.equal(hasArchives, true, `${role} navigation includes archives`)
  }
})
