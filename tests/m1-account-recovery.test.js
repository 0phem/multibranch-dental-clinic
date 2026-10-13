import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as api from '../src/api-client.js'
import { publicViewFromHash } from '../src/public-route.js'

// M1 Priority 1: password reset and sign-in email change go to the documented endpoints with the exact field names, and
// the UI never stores or echoes a code or password.
const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body })
let calls
beforeEach(() => {
  calls = []
  globalThis.document = { cookie: 'XSRF-TOKEN=abc' }
  api.__resetCsrfCacheForTests()
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? json(204, null) : json(200, { data: { ok: 1 } }) }
})
const lastBody = () => JSON.parse(calls.at(-1).options.body)

test('#forgot-password opens the reset page', () => {
  assert.equal(publicViewFromHash('#forgot-password'), 'forgot')
})

test('password reset and email change call their endpoints with the server field names', async () => {
  await api.requestPasswordReset('a@example.com')
  assert.match(calls.at(-1).url, /\/api\/password\/forgot$/)
  assert.deepEqual(lastBody(), { email: 'a@example.com' })
  await api.resetPassword({ email: 'a@example.com', otp: '123456', password: 'Passw0rd1', passwordConfirmation: 'Passw0rd1' })
  assert.match(calls.at(-1).url, /\/api\/password\/reset$/)
  assert.deepEqual(lastBody(), { email: 'a@example.com', otp: '123456', password: 'Passw0rd1', password_confirmation: 'Passw0rd1' })
  await api.requestEmailChange({ newEmail: 'b@example.com', currentPassword: 'Passw0rd1' })
  assert.deepEqual(lastBody(), { new_email: 'b@example.com', current_password: 'Passw0rd1' })
  await api.confirmEmailChange('654321')
  assert.match(calls.at(-1).url, /\/api\/account\/email\/confirm$/)
  for (const call of calls.slice(1)) assert.equal(call.options.method, 'POST')
})

test('a rate-limited code request reports when to try again', async () => {
  globalThis.fetch = async () => json(429, { code: 'otp_rate_limited', retry_after: 120, message: 'Too many code requests for this email. Please try again later.' })
  api.__resetCsrfCacheForTests()
  const result = await api.requestPasswordReset('a@example.com')
  assert.deepEqual([result.kind, result.code, result.retry_after], ['rate_limited', 'otp_rate_limited', 120])
})

test('the reset and email-change screens never persist codes or passwords in the browser', () => {
  for (const file of ['src/pages/PasswordReset.jsx', 'src/pages/ChangeEmailDialog.jsx']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/, file)
  }
})

test('the sign-in form offers the reset path and the reset page never says whether an account exists', () => {
  assert.match(readFileSync(new URL('../src/layout.jsx', import.meta.url), 'utf8'), /Forgot password\?/)
  const page = readFileSync(new URL('../src/pages/PasswordReset.jsx', import.meta.url), 'utf8')
  assert.doesNotMatch(page, /no account|not found|doesn.t exist/i)
})
