import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { NAV } from '../src/data.js'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('M3, M15, M25 pages are in the navigation of the roles that use them', () => {
  const keys = role => NAV[role].map(([k]) => k)
  for (const k of ['schedules', 'leave', 'handovers']) {
    assert.ok(keys('staff').includes(k), `staff ${k}`); assert.ok(keys('owner').includes(k), `owner ${k}`); assert.ok(keys('dentist').includes(k), `dentist ${k}`)
  }
  assert.ok(!keys('patient').includes('handovers'))
  const app = read('src/App.jsx')
  for (const p of ['WorkSchedulesPage', 'LeavePage', 'HandoversPage']) assert.match(app, new RegExp(`case '\\w+': content=<${p} `))
})

test('schedule and leave conflicts are listed, moved through the reschedule command or notified, never cancelled', () => {
  const staffing = read('src/pages/Staffing.jsx')
  assert.match(staffing, /rescheduleAppointment\(\{ id: a\.id, revision: a\.revision \}, \{ date: a\.date, start: a\.start_time, dentistId: dentist\.id \}/)
  assert.doesNotMatch(staffing, /cancelAppointment/)
  assert.match(staffing, /Demo schedule, not confirmed by the clinic/)
  assert.match(staffing, /Seen only by you and the approver\. Never emailed\./)
  assert.match(staffing, /Leave balances are not tracked/)
})

test('handover content is shown only when the server sends it; the Owner sees metadata only; the duplicate guard can ask for one', () => {
  const h = read('src/pages/Handovers.jsx')
  assert.match(h, /h\.summary !== undefined \?/)
  assert.match(h, /the clinical notes are visible only to the sending and receiving teams/i)
  assert.match(read('src/pages/CounterIntake.jsx'), /Request handover/)
  assert.match(read('src/pages/Clinical.jsx'), /<HandoverPanel patientId=\{patient\.id\}/)
})

test('portal: a reload keeps the page (#p/<page>) and Archives is in the navigation', () => {
  const portal = read('src/patient/Portal.jsx')
  assert.match(portal, /window\.history\.replaceState\(null, '', `#p\/\$\{page\}`\)/)
  assert.match(portal, /useState\(\(\) => portalPageFromHash\(\) \|\|/)
  assert.match(portal, /\['archives', 'archive', 'Archives'\]/)
  assert.match(portal, /case 'archives':/)
  assert.doesNotMatch(read('src/patient/pages/Account.jsx'), /<Family\/>/)
})

test('a portal address (#p/<page>) opens sign-in when signed out, never the landing page', async () => {
  const { publicViewFromHash } = await import('../src/public-route.js')
  assert.equal(publicViewFromHash('#p/visits'), 'login')
  assert.equal(publicViewFromHash('#p/family'), 'login')
})

test('Batch 1 UI foundation: compact PageHeader/PageHead, declarative + child FilterBar, and ConfirmDialog on consequential actions', () => {
  const components = read('src/components.jsx')
  const patientUi = read('src/patient/ui.jsx')
  assert.match(components, /page-header-compact/)
  assert.match(components, /page-header-desc sr-only/)
  assert.match(components, /const clearHandler = onClear \|\| onReset/)
  assert.match(patientUi, /pp-head-compact/)
  assert.match(patientUi, /pp-lead sr-only/)

  assert.match(read('src/pages/Staffing.jsx'), /<ConfirmDialog/)
  assert.match(read('src/pages/ClosedDates.jsx'), /title="Remove clinic closure\?"/)
  assert.match(read('src/pages/Handovers.jsx'), /title="Cancel patient handover\?"/)
  assert.match(read('src/pages/ServerPrescriptions.jsx'), /title="Issue and lock prescription\?"/)
})

test('Batch 2 priority verification status is sent to server in queue-api.js', () => {
  const queueApi = read('src/queue-api.js')
  assert.match(queueApi, /payload\.verification_status = meta\.verificationStatus/)
  assert.match(queueApi, /payload\.category = meta\.category/)
})
