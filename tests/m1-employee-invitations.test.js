import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { build } from 'esbuild'
import React from 'react'
import { renderToString } from 'react-dom/server'
import { __resetCsrfCacheForTests, getBranchScopes, setBranchScopes } from '../src/api-client.js'
import { publicViewFromHash } from '../src/public-route.js'
import { deliveryLabel, deliveryNotice, fetchInvitations, invitationPayload, mapInvitation, parseAcceptHash, resendInvitation, sendInvitation, acceptInvitation } from '../src/employee-invitations.js'

// M1 employee provisioning (client) + M18 truthful dispatch wording. Server rules are covered by
// backend/tests/Feature/Identity/EmployeeInvitationTest.php; these are unit/fixture checks.
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const TOKEN = 'A'.repeat(32) + 'b'.repeat(32)

test('dispatch outcomes are worded truthfully: nothing claims inbox delivery', () => {
  const all = ['transport_accepted', 'logged_only', 'failed', undefined].map(status => deliveryNotice(status ? { status } : null))
  for (const n of all) assert.doesNotMatch(`${n.title} ${n.message}`, /\bdelivered\b|successfully sent|reached the inbox/i)
  assert.match(deliveryNotice({ status: 'logged_only' }).title, /not emailed/i)
  assert.match(deliveryNotice({ status: 'transport_accepted' }).message, /not confirmed/i)
  assert.equal(deliveryNotice({ status: 'failed' }).tone, 'warning')
  assert.equal(deliveryNotice({ status: 'logged_only', message: 'server words' }).message, 'server words') // the server's own text wins
  assert.equal(deliveryLabel('logged_only'), 'Recorded locally only (not emailed)')
  assert.equal(deliveryLabel(null), 'No send recorded')
})

test('accept links: only a well-formed email and 64-character token are accepted; the route opens the accept page', () => {
  assert.deepEqual(parseAcceptHash(`#accept-invitation?email=New.Person%40Example.test&token=${TOKEN}`), { email: 'new.person@example.test', token: TOKEN })
  for (const bad of ['', '#sign-in', '#accept-invitation', `#accept-invitation?token=${TOKEN}`, '#accept-invitation?email=a%40b.c&token=short', `#accept-invitation?email=a%40b.c&token=${TOKEN}!`, null])
    assert.equal(parseAcceptHash(bad), null, String(bad))
  assert.equal(publicViewFromHash(`#accept-invitation?email=x&token=${TOKEN}`), 'accept')
  assert.equal(publicViewFromHash('#accept-invitation'), 'accept')
  assert.equal(publicViewFromHash('#sign-in'), 'login')
})

test('the invitation payload carries only role-appropriate fields and never a password', () => {
  const form = { role: 'staff', firstName: 'Rina', lastName: 'Lopez', email: 'r@x.test', phone: '', title: 'Receptionist', branchId: 'b1', shiftStart: '09:00', shiftEnd: '17:00', licenseNo: 'L', specialty: 'S' }
  const staff = invitationPayload(form)
  assert.deepEqual([staff.title, staff.license_no, staff.specialty, staff.phone], ['Receptionist', null, null, null])
  const dentist = invitationPayload({ ...form, role: 'dentist' })
  assert.deepEqual([dentist.title, dentist.license_no, dentist.specialty], [null, 'L', 'S'])
  for (const p of [staff, dentist]) assert.equal(Object.keys(p).some(k => /pass/i.test(k)), false)
  assert.deepEqual(mapInvitation({ id: 'u1', status: 'Revoked', last_delivery: { status: 'failed' }, branch: { name: 'Dr. Dana Roxas Dental Clinic' } }).lastDelivery, 'failed')
})

let oldFetch
const calls = []
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function mockServer(handler) {
  oldFetch = globalThis.fetch; calls.length = 0
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    calls.push({ path, method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null })
    return handler(path)
  }
}
afterEach(() => { if (oldFetch) globalThis.fetch = oldFetch; oldFetch = null; __resetCsrfCacheForTests() })
const row = { id: '01KUSER', name: 'Rina Lopez', email: 'r@x.test', role: 'staff', title: 'Receptionist', status: 'Invited', expires_at: '2026-10-16T10:00:00+08:00', expired: false, last_delivery: { status: 'logged_only' } }

test('client calls: the send outcome travels with the record, and failures keep the server message', async () => {
  mockServer(path => path === '/api/employee-invitations' ? json(201, { data: row, delivery: { status: 'logged_only', message: 'Recorded in the local mail log only.' } }) : json(200, { data: row, delivery: { status: 'transport_accepted' } }))
  const sent = await sendInvitation({ role: 'staff', firstName: 'Rina', lastName: 'Lopez', email: 'r@x.test', title: 'Receptionist', branchId: 'b1', shiftStart: '09:00', shiftEnd: '17:00' })
  assert.deepEqual([sent.ok, sent.record.status, sent.delivery.status], [true, 'Invited', 'logged_only'])
  assert.deepEqual([calls[0].method, calls[0].body.branch_ref, calls[0].body.role], ['POST', 'b1', 'staff'])
  const again = await resendInvitation('01KUSER')
  assert.deepEqual([calls[1].path, again.delivery.status], ['/api/employee-invitations/01KUSER/resend', 'transport_accepted'])
  mockServer(() => json(403, { message: 'This is outside your access.' }))
  assert.deepEqual(await fetchInvitations(), { ok: false, kind: 'forbidden', message: 'This is outside your access.' })
  mockServer(() => json(422, { message: 'The given data was invalid.', errors: { token: ['This invitation link is not valid or has expired. Ask the clinic Owner to send a new one.'] } }))
  const accepted = await acceptInvitation({ email: 'r@x.test', token: TOKEN, password: 'Passw0rd1', passwordConfirmation: 'Passw0rd1' })
  assert.equal(accepted.ok, false); assert.match(accepted.errors.token[0], /not valid or has expired/)
  assert.deepEqual(calls[0].body, { email: 'r@x.test', token: TOKEN, password: 'Passw0rd1', password_confirmation: 'Passw0rd1' })
})

test('wiring: Owner-only Users page hosts invitations; the public accept page is reachable; diagnostics no longer claim success', () => {
  const admin = read('src/pages/Admin.jsx'), app = read('src/App.jsx')
  assert.match(admin, /<EmployeeInvitations store=\{store\}\/>/)
  assert.doesNotMatch(admin, /Diagnostic Email Dispatched|dispatched successfully|Operational \(Verified\)/)
  assert.match(admin, /Not emailed \(local mail log only\)/)
  assert.match(app, /publicView==='accept'\s*\?<AcceptInvitation/)
  assert.match(read('src/safeguards.js'), /owner:\[[^\]]*'users'/) // the Users page stays Owner-only
  assert.doesNotMatch(read('backend/resources/views/emails/test-mail.blade.php'), /Operational \(Verified\)/)
})

// ---- render ------------------------------------------------------------------------------------------------------------
const bundle = await build({ stdin: { contents: "export * from './src/pages/AcceptInvitation.jsx'; export * from './src/pages/EmployeeInvitations.jsx'; export * from './src/pages/BranchAccessDialog.jsx'", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', external: ['react', 'react-dom'], loader: { '.css': 'empty', '.png': 'empty', '.svg': 'empty' } })
const dir = new URL('../node_modules/.cache/', import.meta.url); mkdirSync(dir, { recursive: true })
const file = new URL('m1-invitations-test-bundle.mjs', dir); writeFileSync(file, bundle.outputFiles[0].text)
const ui = await import(file.href)
const html = el => renderToString(el).replace(/<!-- -->/g, '')

test('accept page: a valid link shows the password form; a malformed one explains and shows no form', () => {
  const ok = html(React.createElement(ui.AcceptInvitation, { hash: `#accept-invitation?email=rina%40x.test&token=${TOKEN}`, onSignIn() {} }))
  assert.match(ok, /Choose a password for rina@x\.test/); assert.match(ok, /Set password/); assert.doesNotMatch(ok, new RegExp(TOKEN))
  const bad = html(React.createElement(ui.AcceptInvitation, { hash: '#accept-invitation?email=x', onSignIn() {} }))
  assert.match(bad, /Link not recognised/); assert.doesNotMatch(bad, /type="password"/)
})

test('Owner invitation form offers Staff and Dentist only and starts in a loading state', () => {
  const out = html(React.createElement(ui.EmployeeInvitations, { store: { state: { branches: [{ id: 'b1', name: 'Dr. Dana Roxas Dental Clinic' }] } } }))
  assert.match(out, /<option value="staff"[^>]*>Staff<\/option><option value="dentist">Dentist<\/option><\/select>/)
  assert.doesNotMatch(out, /value="owner"|value="patient"/)
  assert.match(out, /Loading invitations/); assert.doesNotMatch(out, /No open invitations/)
  assert.doesNotMatch(out, /type="password"/) // the Owner never sets an employee password
})

test('Staff branch access uses the existing Owner-only scope command; only Staff rows offer it', async () => {
  mockServer(path => json(200, { data: { user: { id: '01KS', role: 'staff' }, branch_scopes: [{ id: 'b1', name: 'Dr. Dana Roxas Dental Clinic' }, { id: 'b2', name: 'Roxas - Cardinal Dental Center' }] } }))
  const saved = await setBranchScopes('01KS', ['b1', 'b2'])
  assert.deepEqual([calls[0].method, calls[0].path, calls[0].body], ['PUT', '/api/users/01KS/branch-scopes', { branch_refs: ['b1', 'b2'] }])
  assert.deepEqual(saved.data.branch_scopes.map(b => b.id), ['b1', 'b2'])
  await getBranchScopes('01KS'); assert.equal(calls[1].method, 'GET')
  const admin = read('src/pages/Admin.jsx')
  assert.match(admin, /\{u\.role==='staff'&&<Button size="sm" variant="soft" onClick=\{\(\)=>setScopeTarget\(u\)\}>Branch access<\/Button>\}/)
  const dialog = html(React.createElement(ui.BranchAccessDialog, { user: { id: '01KS', name: 'Rina' }, branches: [{ id: 'b1', name: 'Dr. Dana Roxas Dental Clinic' }], onClose() {} }))
  assert.match(dialog, /Loading branch access/); assert.doesNotMatch(dialog, /Save branch access/) // no controls before the server answers
})
