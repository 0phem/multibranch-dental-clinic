import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as api from '../src/api-client.js'
import * as feedback from '../src/feedback-api.js'
import * as data from '../src/data.js'
import { canAccessPage } from '../src/safeguards.js'

// M26 client behaviour: a foundation only. The server is the authority; no rating/category/anonymity/status/reply/publication exists.

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: {} })
let calls
function stubFetch(...responses) {
  let i = 0
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null, headers: options.headers || {} }); return responses[Math.min(i++, responses.length - 1)] }
}
beforeEach(() => { calls = []; globalThis.document = { cookie: 'XSRF-TOKEN=t' }; api.__resetCsrfCacheForTests() })
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const posts = () => calls.filter(c => c.method === 'POST')
const mine = (n, over = {}) => ({ id: `01k00000000000000000000f0${n}`, visit: { id: `01k00000000000000000000v0${n}`, date: '2026-09-28', services: ['Oral Prophylaxis'] }, body: `feedback ${n}`, submitted_at: '2026-09-28T10:00:00+08:00', ...over })

test('submitting sends only {visit_id, body} with an Idempotency-Key: no Patient, rating, category, anonymity, publication or consent field', async () => {
  stubFetch(json(200, {}), json(201, { data: mine(1) }))
  const result = await feedback.submit('01k00000000000000000000v01', '  Thank you  ', 'key-1')
  assert.deepEqual([result.ok, result.row.body], [true, 'feedback 1'])
  assert.deepEqual(posts()[0].body, { visit_id: '01k00000000000000000000v01', body: 'Thank you' })
  assert.equal(posts()[0].headers['Idempotency-Key'], 'key-1')
  assert.ok(posts()[0].url.endsWith('/api/feedback'))
})

test('missing visit, empty or oversized text never reaches the network', async () => {
  stubFetch(json(200, {}))
  for (const [visit, text] of [['', 'x'], ['v', ''], ['v', '  '], ['v', null], ['v', 'x'.repeat(feedback.MAX_FEEDBACK + 1)]]) assert.equal((await feedback.submit(visit, text, 'k')).ok, false)
  assert.equal(calls.length, 0)
})

test('failures are explicit and retryable: the same key can be reused; 422 ineligible, 429 with a wait, network', async () => {
  stubFetch(json(200, {}), json(422, { message: 'Choose one of your completed visits.', code: 'visit_not_eligible' }))
  const refused = await feedback.submit('v', 'hi', 'k')
  assert.deepEqual([refused.ok, refused.code], [false, 'visit_not_eligible'])
  api.__resetCsrfCacheForTests()
  stubFetch(json(200, {}), json(429, { message: 'slow down', code: 'feedback_rate_limited', retry_after: 12 }))
  const limited = await feedback.submit('v', 'hi', 'k')
  assert.deepEqual([limited.kind, limited.retry_after], ['rate_limited', 12])
  api.__resetCsrfCacheForTests()
  globalThis.fetch = async () => { throw new TypeError('offline') }
  assert.equal((await feedback.submit('v', 'hi', 'k')).kind, 'network')
})

test('lists are read through the server cursor and a failed page is an error, never a shorter list', async () => {
  stubFetch(json(200, { data: [mine(2), mine(1)], meta: { per_page: 25, next_cursor: 'c1' } }))
  const first = await feedback.loadMyFeedback()
  assert.deepEqual([first.ok, first.rows.length, first.nextCursor], [true, 2, 'c1'])
  stubFetch(json(200, { data: [mine(0)], meta: { per_page: 25, next_cursor: null } }))
  await feedback.loadMyFeedback('c1'); assert.match(calls.at(-1).url, /cursor=c1/)
  stubFetch(json(500, { message: 'boom' }))
  const failed = await feedback.loadMyFeedback('c1')
  assert.equal(failed.ok, false); assert.equal(failed.rows, undefined)
  assert.equal('loadReviewList' in feedback || 'loadReviewDetail' in feedback || 'mapReview' in feedback, false, 'no reviewer client exists')
})

test('feedback text is a plain string rendered only as text; no HTML, link, fetch or storage path exists', () => {
  const xss = '<img src=x onerror=alert(1)><script>alert(2)</script> https://evil.example'
  assert.equal(feedback.mapMine(mine(3, { body: xss })).body, xss)
  const page = read('src/pages/Feedback.jsx') + read('src/feedback-api.js')
  assert.doesNotMatch(page, /dangerouslySetInnerHTML|innerHTML|insertAdjacentHTML|document\.write|localStorage|sessionStorage|indexedDB|setTimeout|setInterval/)
  assert.doesNotMatch(read('src/pages/Feedback.jsx'), /<a\s|href=|window\.open|fetch\(/)
})

test('the screens promise only what exists: no response time, no anonymity, no rating/category/status/reply/publication', () => {
  const page = read('src/pages/Feedback.jsx')
  const visible = page.split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.match(visible, /it is not anonymous/)
  assert.match(visible, /The clinic has not set a response time, and this form does not start a conversation/)
  assert.doesNotMatch(visible, /within \d|we will (contact|respond|reply)|anonymous(ly)? (feedback|submission)|\bstars?\b|\brating:|\bResolved\b|Action Required|testimonial|public review|\bsurvey\b|satisfaction/i)
  for (const text of ['Load older', 'Retry', 'Try again', 'Loading', 'No completed visits yet', 'maxLength={MAX_FEEDBACK}']) assert.ok(visible.includes(text), text)
  assert.doesNotMatch(visible, /Read-only for now|Patient feedback entries|Read full text/, 'no reviewer UI')
  assert.match(visible, /if \(failure\) key\.current = commandKey\(\)/, 'a retry of the same text reuses the same key; editing starts a new one')
})

test('registry and access: only Patients have a feedback entry (no reviewer authority exists); M26 registry reflects a built-but-partial foundation', () => {
  assert.deepEqual(data.NAV.patient.find(([k]) => k === 'feedback'), ['feedback', 'Share Feedback'])
  for (const role of ['owner', 'staff', 'dentist']) assert.equal(data.NAV[role].some(([k]) => k === 'feedback'), false, role)
  const state = { users: [], patients: [], clock: {} }
  for (const role of ['owner', 'staff', 'dentist']) assert.equal(canAccessPage(state, { role, userId: 'x' }, 'feedback'), false, role)
  const m26 = data.MODULES.find(m => m.no === 26)
  assert.deepEqual([m26.coverage, m26.implemented, m26.area, m26.owner, m26.roles], ['partial', false, 'Quality', 'Group 3 — Shared Enhancement', ['patient']])
  assert.ok(!m26.pe && !m26.enhancement, 'M26 is a shared enhancement, never a PE')
  assert.match(m26.coverageNote, /Patient-only technical foundation/)
  assert.doesNotMatch(m26.coverageNote, /Owner/)
  const app = read('src/App.jsx')
  assert.doesNotMatch(app, /FeedbackReviewPage/)
  assert.doesNotMatch(read('src/pages/Feedback.jsx') + read('src/feedback-api.js'), /FeedbackReviewPage|loadReviewList|owner/i)
})

test('dashboards and analytics show no satisfaction, feedback, rating or complaint metric', () => {
  for (const file of ['src/pages/Dashboards.jsx', 'src/pages/Admin.jsx', 'src/pages/PatientHome.jsx']) {
    assert.doesNotMatch(read(file), /satisfaction|feedback count|complaint count|\bratings?\b|\bnps\b/i, file)
  }
})
