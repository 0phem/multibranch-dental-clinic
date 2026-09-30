import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as pricingApi from '../src/pricing-api.js'
import { __resetCsrfCacheForTests, onSessionInvalidated } from '../src/api-client.js'
import { canAccessPage } from '../src/safeguards.js'
import { NAV } from '../src/data.js'

// M13 pricing foundation: Owner-confirmed, effective-dated server prices are the only authoritative prices. The reference
// fee (`baseFee`, from services.reference_fee_php) is display-only and never pre-fills, feeds or is sent as a price.

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const row = (fields = {}) => ({
  id: '01jprice00000000000000000a', service: { id: 'svc1', code: 'CONSULT', name: 'Dental Consultation' }, branch: null, level: 'base', kind: 'priced',
  amount: '1500.00', effective_from: '2026-09-28', source: 'owner_confirmed', created_at: '2026-09-28T10:00:00+08:00', created_by: { name: 'Demo Owner' },
  retracted_at: null, retracted_by: null, ...fields,
})

let calls = []
let oldFetch
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function mockFetch(handler) {
  oldFetch = globalThis.fetch
  calls = []
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url).replace(/^https?:\/\/[^/]+/, '')
    calls.push({ path, method: (options.method || 'GET').toUpperCase(), headers: options.headers || {}, body: options.body ? JSON.parse(options.body) : null })
    if (path === '/sanctum/csrf-cookie') return new Response(null, { status: 204 })
    return handler(path, options)
  }
}
let unsubscribe = null
afterEach(() => { if (oldFetch) globalThis.fetch = oldFetch; oldFetch = null; unsubscribe?.(); unsubscribe = null; __resetCsrfCacheForTests() })
const apiCalls = () => calls.filter(c => c.path !== '/sanctum/csrf-cookie')

test('versions map to public ids with decimal-string amounts', () => {
  const v = pricingApi.mapPriceVersion(row())
  assert.deepEqual([v.id, v.serviceId, v.branchId, v.level, v.kind, v.amount, v.effectiveFrom, v.source, v.createdBy], ['01jprice00000000000000000a', 'svc1', null, 'base', 'priced', '1500.00', '2026-09-28', 'owner_confirmed', 'Demo Owner'])
  assert.equal(typeof v.amount, 'string')
})

test('amounts are formatted and validated as decimal text, never through floating point', () => {
  assert.equal(pricingApi.formatAmount('1234567.5'), '₱1,234,567.50')
  assert.equal(pricingApi.formatAmount('0.10'), '₱0.10')
  assert.equal(pricingApi.formatAmount('9999999999.99'), '₱9,999,999,999.99')
  assert.equal(pricingApi.formatAmount(1500), '—', 'a number is not an authoritative amount')
  for (const ok of ['1500', '1500.5', '1500.00', '0.01']) assert.equal(pricingApi.validAmount(ok), true, ok)
  for (const bad of ['0', '0.00', '-1', '1.234', 'abc', '1e3', '1,500', '']) assert.equal(pricingApi.validAmount(bad), false, bad)
})

test('version status and the version in effect today follow effective dates and retraction', () => {
  const versions = [
    row({ id: 'a', effective_from: '2026-09-01', amount: '500.00' }),
    row({ id: 'b', effective_from: '2026-09-20', amount: '600.00' }),
    row({ id: 'c', effective_from: '2026-10-05', amount: '700.00' }),
    row({ id: 'd', effective_from: '2026-10-10', amount: '800.00', retracted_at: '2026-09-28T10:00:00+08:00', retracted_by: { name: 'Demo Owner' } }),
    row({ id: 'e', effective_from: '2026-09-25', amount: '650.00', level: 'branch', branch: { id: 'b1', name: 'Branch A' } }),
  ].map(pricingApi.mapPriceVersion)
  const status = id => pricingApi.versionStatus(versions.find(v => v.id === id), versions, '2026-09-28')
  assert.deepEqual(['a', 'b', 'c', 'd', 'e'].map(status), ['Superseded', 'In effect', 'Scheduled', 'Retracted', 'In effect'])
  assert.equal(pricingApi.inEffect(versions, 'svc1', null, '2026-09-28').id, 'b')
  assert.equal(pricingApi.inEffect(versions, 'svc1', 'b1', '2026-09-28').id, 'e')
  assert.equal(pricingApi.inEffect(versions, 'svc2', null, '2026-09-28'), null, 'no confirmed price')
})

test('create and retract send named commands with an Idempotency-Key; source and author are never sent', async () => {
  mockFetch(path => (path.endsWith('/retract') ? json(200, { data: row({ retracted_at: '2026-09-28T10:00:00+08:00' }) }) : json(201, { data: row() })))
  await pricingApi.createPriceVersion({ serviceId: 'svc1', branchId: 'b1', kind: 'priced', amount: ' 1500.00 ', effectiveFrom: '2026-10-01' }, 'create-1')
  await pricingApi.createPriceVersion({ serviceId: 'svc1', kind: 'ended', amount: '99', effectiveFrom: '2026-10-02' }, 'create-2')
  await pricingApi.retractPriceVersion({ id: '01jprice00000000000000000a' }, 'retract-1')
  const [priced, ended, retract] = apiCalls()
  assert.deepEqual([priced.method, priced.path, priced.body, priced.headers['Idempotency-Key']], ['POST', '/api/services/svc1/prices', { kind: 'priced', effective_from: '2026-10-01', branch_ref: 'b1', amount: '1500.00' }, 'create-1'])
  assert.deepEqual(ended.body, { kind: 'ended', effective_from: '2026-10-02' }, 'an ended version sends no amount')
  assert.deepEqual([retract.path, retract.headers['Idempotency-Key']], ['/api/service-prices/01jprice00000000000000000a/retract', 'retract-1'])
  for (const call of [priced, ended]) for (const field of ['source', 'created_by_user_id', 'reference_fee_php', 'baseFee']) assert.equal(field in call.body, false, field)
  assert.equal(typeof priced.body.amount, 'string')
})

test('pricing refusals keep their codes; a 401 reaches the shared session-invalidated path', async () => {
  mockFetch(path => (path.startsWith('/api/services') ? json(409, { message: 'exists', code: 'price_version_exists' }) : json(401, { message: 'Unauthenticated.' })))
  const seen = []; unsubscribe = onSessionInvalidated(() => seen.push(1))
  const conflict = await pricingApi.createPriceVersion({ serviceId: 'svc1', kind: 'priced', amount: '1.00', effectiveFrom: '2026-10-01' }, 'k')
  assert.deepEqual([conflict.kind, conflict.code], ['conflict', 'price_version_exists']); assert.match(conflict.message, /already starts on that date/)
  const expired = await pricingApi.loadPriceVersions()
  assert.equal(expired.kind, 'unauthenticated'); assert.equal(seen.length, 1)
})

test('the reference fee never pre-fills, feeds or is labelled as a confirmed price', () => {
  const page = read('src/pages/Pricing.jsx')
  assert.match(page, /const emptyForm = today => \(\{ level: 'base', kind: 'priced', amount: '', effectiveFrom: today \}\)/, 'the amount field starts blank')
  // baseFee appears only inside the labelled reference-fee displays, never in the form or the create request.
  const uses = page.split('\n').filter(line => line.includes('baseFee'))
  assert.ok(uses.length >= 2)
  for (const line of uses) assert.match(line, /[Rr]eference fee \(unconfirmed\)|reference only/, line.trim())
  assert.doesNotMatch(page, /amount:\s*[^,}]*baseFee/)
  const code = read('src/pricing-api.js').split('\n').filter(line => !line.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(code, /baseFee|reference_fee/, 'the pricing client never reads or sends the reference fee')
  assert.match(read('src/pages/Admin.jsx'), /Reference fee \(unconfirmed\): \{peso\.format\(service\.baseFee\)\}/, 'the Branches screen labels it')
})

test('Services & Pricing is an Owner-only page', () => {
  assert.deepEqual(NAV.owner.find(([page]) => page === 'pricing'), ['pricing', 'Services & Pricing'])
  for (const role of ['staff', 'dentist', 'patient']) assert.equal(NAV[role].some(([page]) => page === 'pricing'), false, role)
  assert.match(read('src/safeguards.js'), /owner:\[[^\]]*'pricing'/)
  assert.doesNotMatch(read('src/safeguards.js').match(/staff:\[[^\]]*\]/)[0], /pricing/)
  assert.equal(typeof canAccessPage, 'function')
})

test('the current browser billing prototype is unchanged by the M13 foundation', () => {
  assert.match(read('src/phase2.js'), /const configuredFee=assignment\?\.feeOverride\?\?service\?\.baseFee/, 'M11 prototype pricing stays until the M11 cutover')
  assert.doesNotMatch(read('src/phase2.js'), /pricing-api/)
  assert.doesNotMatch(read('src/workflow.js'), /pricing-api/)
})
