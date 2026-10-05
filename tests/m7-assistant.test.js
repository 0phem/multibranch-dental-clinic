import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import * as api from '../src/api-client.js'
import * as assistant from '../src/assistant-api.js'

// M7 client behaviour: the clinic server is the only assistant authority. The browser sends one typed message to the clinic
// server — no provider call, no key, no hidden instructions, no Patient identifier, no fake answer, no automatic retry.

const json = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => body, headers })
let calls
function stubFetch(...responses) {
  let i = 0
  globalThis.fetch = async (url, options = {}) => { calls.push({ url: String(url), method: options.method || 'GET', body: options.body ? JSON.parse(options.body) : null }); return responses[Math.min(i++, responses.length - 1)] }
}
beforeEach(() => { calls = []; globalThis.document = { cookie: 'XSRF-TOKEN=t' }; api.__resetCsrfCacheForTests() })
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const posts = () => calls.filter(c => c.method === 'POST')

test('a question is sent to the clinic server only, as {message} and nothing else', async () => {
  stubFetch(json(200, {}), json(200, { data: { answer: 'Open Book.', outcome: 'answered', handoff_required: false, sources: ['booking'] } }))
  const result = await assistant.ask('  How do I book?  ')
  assert.deepEqual([result.ok, result.answer, result.outcome, result.handoff, result.sources], [true, 'Open Book.', 'answered', false, ['booking']])
  assert.equal(posts().length, 1)
  assert.ok(posts()[0].url.endsWith('/api/assistant/messages'))
  assert.deepEqual(posts()[0].body, { message: 'How do I book?' }, 'no patient id, history, role, model or system text is ever sent')
  assert.ok(calls.every(c => !/anthropic|openai|api\.[a-z]+\.com/.test(c.url) || c.url.includes('localhost')), 'the browser never calls a provider')
})

test('short, long and empty input never reach the network', async () => {
  stubFetch(json(200, {}))
  for (const bad of ['', ' ', 'a', null, undefined, 'x'.repeat(assistant.MAX_MESSAGE + 1)]) assert.deepEqual([(await assistant.ask(bad)).ok, (await assistant.ask(bad)).kind], [false, 'validation'])
  assert.equal(calls.length, 0)
})

test('refusals and hand-off recommendations are shown as returned, with no claim that anyone was contacted', async () => {
  stubFetch(json(200, {}), json(200, { data: { answer: 'I can’t help with diagnosis.', outcome: 'refused_clinical', handoff_required: true, sources: [] } }))
  const result = await assistant.ask('Do I have a cavity?')
  assert.deepEqual([result.ok, result.outcome, result.handoff], [true, 'refused_clinical', true])
  const panel = read('src/assistant-panel.jsx')
  assert.match(panel, /The assistant has not contacted anyone for you/)
  assert.doesNotMatch(panel, /ticket|has been (sent|booked|cancelled|notified)|we(’|')ll contact you/i)
})

test('failures are explicit and recoverable: 502 message, 503, rate limit with a wait, network, and an unreadable answer', async () => {
  stubFetch(json(200, {}), json(502, { message: 'The clinic assistant could not answer right now. Please try again, or contact the clinic.', code: 'assistant_unavailable' }))
  const down = await assistant.ask('How do I book?')
  assert.deepEqual([down.ok, down.kind, /could not answer right now/.test(down.message)], [false, 'server', true])
  assert.equal(posts().length, 1, 'no automatic retry after a failure')
  api.__resetCsrfCacheForTests()
  stubFetch(json(200, {}), json(503, { message: 'The clinic assistant is not available right now. Please contact the clinic.', code: 'assistant_not_configured' }))
  assert.match((await assistant.ask('How do I book?')).message, /not available right now/)
  api.__resetCsrfCacheForTests()
  stubFetch(json(200, {}), json(429, { message: 'Please wait.', code: 'assistant_rate_limited', retry_after: 42 }))
  const limited = await assistant.ask('How do I book?')
  assert.deepEqual([limited.ok, limited.kind, limited.retryAfter], [false, 'rate_limited', 42])
  api.__resetCsrfCacheForTests()
  globalThis.fetch = async () => { throw new TypeError('offline') }
  assert.equal((await assistant.ask('How do I book?')).kind, 'network')
  api.__resetCsrfCacheForTests()
  stubFetch(json(200, {}), json(200, { data: { outcome: 'answered' } }))
  const unreadable = await assistant.ask('How do I book?')
  assert.deepEqual([unreadable.ok, unreadable.kind], [false, 'server'])
})

test('no provider credential, provider URL or hidden policy exists anywhere in the frontend source', () => {
  const walk = dir => readdirSync(new URL(`../${dir}`, import.meta.url)).flatMap(name => {
    const path = `${dir}/${name}`
    return statSync(new URL(`../${path}`, import.meta.url)).isDirectory() ? walk(path) : [path]
  })
  for (const file of walk('src').filter(f => /\.(js|jsx)$/.test(f))) {
    const source = read(file)
    assert.doesNotMatch(source, /ASSISTANT_API_KEY|x-api-key|api\.anthropic\.com|api\.openai\.com|sk-[A-Za-z0-9]{8,}/, file)
  }
  const code = [read('src/assistant-api.js'), read('src/assistant-panel.jsx')].join('\n').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
  assert.doesNotMatch(code, /system prompt|M7-INTERNAL|<knowledge>/i)
})

test('the panel is server-backed in a clinic-server session; the offline demo is labelled, isolated and never the server path', () => {
  const panel = read('src/assistant-panel.jsx')
  assert.match(panel, /server = false/)
  assert.match(panel, /Offline demo preview — not the clinic assistant/)
  assert.match(panel, /server \? send\(q\) : setDemoAnswer\(DEMO\[q\]\)/, 'canned answers are reachable only without a server session')
  assert.match(read('src/layout.jsx'), /server=\{!!store\?\.session\?\.serverUserId\}/)
  assert.doesNotMatch(read('src/layout.jsx'), /const reply=q=>/, 'the old keyword responder is gone from the shell')
  // memory only, no persistence, no timers (no automatic retry or fake typing)
  assert.doesNotMatch(panel + read('src/assistant-api.js'), /localStorage|sessionStorage|indexedDB|setTimeout|setInterval/)
  assert.match(panel, /Try again/)
  assert.match(panel, /Looking that up…/)
  assert.match(panel, /role="alert"/)
  assert.match(panel, /maxLength=\{MAX_MESSAGE\}/)
})

test('an unconfirmed-fact refusal has its own honest label and is a handoff, never an answer', () => {
  const panel = read('src/assistant-panel.jsx')
  assert.match(panel, /unconfirmed_fact: 'Needs clinic confirmation'/)
  assert.deepEqual(assistant.mapAnswer({ answer: 'x', outcome: 'unconfirmed_fact', handoff_required: true }), { answer: 'x', outcome: 'unconfirmed_fact', handoff: true, sources: [] })
})
