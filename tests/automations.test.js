import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pageForLink, readPageLink, rememberPageLink, takePageLink } from '../src/page-link.js'

const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) } }

test('automation email links: appointment, book and reports open the right page for the right role only', () => {
  const id = '01jabcdefghjkmnpqrstvwxyz0'
  assert.deepEqual(readPageLink(`?appointment=${id}`), { appointmentId: id })
  assert.deepEqual(readPageLink('?open=book'), { page: 'book' })
  assert.equal(readPageLink('?open=admin'), null)
  assert.equal(readPageLink('?appointment=../../x'), null)
  assert.deepEqual(pageForLink({ appointmentId: id }, 'patient'), ['visits', { appointmentId: id }])
  assert.deepEqual(pageForLink({ page: 'book' }, 'patient'), ['book', null])
  assert.deepEqual(pageForLink({ page: 'reports' }, 'owner'), ['analytics', null])
  assert.equal(pageForLink({ page: 'reports' }, 'patient'), null)
  assert.equal(pageForLink({ appointmentId: id }, 'staff'), null)
  const storage = memory()
  rememberPageLink({ page: 'book' }, storage)
  assert.deepEqual(takePageLink(storage), { page: 'book' })
  assert.equal(takePageLink(storage), null) // used once
})

test('Automations page: Owner-only nav entry, defaults labelled as not confirmed, switch is a real switch, demo clock only in demo', () => {
  const page = readFileSync('src/pages/Automations.jsx', 'utf8')
  assert.match(readFileSync('src/safeguards.js', 'utf8'), /owner:\[[^\]]*'automations'/)
  assert.doesNotMatch(readFileSync('src/safeguards.js', 'utf8'), /staff:\[[^\]]*'automations'/)
  assert.match(page, /not confirmed by the clinic/)
  assert.match(page, /role="switch" aria-checked=\{row\.enabled\}/)
  assert.match(page, /\{meta\.demo && <DemoClockCard/)
  assert.match(page, /Send a test to myself/)
  assert.match(page, /expected_revision: row\.revision/)
})

test('front desk possible no-shows: confirm uses the server command and undo leaves the appointment unchanged', () => {
  const panel = readFileSync('src/pages/PossibleNoShows.jsx', 'utf8')
  assert.match(panel, /confirmNoShowFlag\(flag\.id\)/)
  assert.match(panel, /dismissNoShowFlag\(flag\.id\)/)
  assert.match(panel, /never marks a no-show by itself/)
  assert.match(readFileSync('src/pages/PatientFlow.jsx', 'utf8'), /<PossibleNoShows /)
})
