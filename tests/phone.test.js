import test from 'node:test'
import assert from 'node:assert/strict'
import { COUNTRY_CODES, DEFAULT_COUNTRY, normalizePhoneNumber, sanitizePhoneInput, formatPhoneDisplay } from '../src/phone.js'

test('the country-code table defaults to Philippines +63', () => {
  assert.equal(DEFAULT_COUNTRY.dial, '+63')
  assert.equal(DEFAULT_COUNTRY.label, 'Philippines')
  assert.equal(COUNTRY_CODES.length, 1, 'only one country is enabled in this checkpoint')
})

test('a valid 10-digit Philippine mobile number is accepted and normalized to E.164', () => {
  const result = normalizePhoneNumber('+63', '9994936192')
  assert.deepEqual(result, { ok: true, digits: '9994936192', e164: '+639994936192' })
})

test('9 digits are rejected, not padded', () => {
  assert.equal(normalizePhoneNumber('+63', '999493619').ok, false)
})

test('11 digits are rejected, not truncated', () => {
  assert.equal(normalizePhoneNumber('+63', '99949361923').ok, false)
})

test('a leading 0 after +63 is rejected, not silently stripped', () => {
  const result = normalizePhoneNumber('+63', '09994936192')
  assert.equal(result.ok, false)
})

test('non-digit content is rejected', () => {
  assert.equal(normalizePhoneNumber('+63', '999493619a').ok, false)
  assert.equal(normalizePhoneNumber('+63', '999-49-3619x').ok, false)
})

test('cosmetic formatting characters (spaces, dashes, parens) are tolerated', () => {
  const result = normalizePhoneNumber('+63', '999 493 6192')
  assert.equal(result.ok, true)
  assert.equal(result.digits, '9994936192')
  const dashed = normalizePhoneNumber('+63', '(999) 493-6192')
  assert.equal(dashed.ok, true)
  assert.equal(dashed.digits, '9994936192')
})

test('an unsupported dial code is rejected rather than pretending it is supported', () => {
  assert.equal(normalizePhoneNumber('+1', '9994936192').ok, false)
})

test('formatPhoneDisplay renders "+63 9994936192"', () => {
  assert.equal(formatPhoneDisplay('+63', '9994936192'), '+63 9994936192')
})

test('Owner phone input keeps +63 fixed, accepts ten local digits, and ignores letters or an eleventh digit', () => {
  assert.equal(sanitizePhoneInput('9171234567'), '9171234567')
  assert.equal(sanitizePhoneInput('+63 91712345678'), '6391712345')
  assert.equal(sanitizePhoneInput('91712a34567'), '9171234567')
  assert.deepEqual(normalizePhoneNumber('+63', sanitizePhoneInput('9171234567')), { ok: true, digits: '9171234567', e164: '+639171234567' })
})
