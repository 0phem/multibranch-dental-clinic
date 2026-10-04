import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const patient = fs.readFileSync('src/pages/PatientCare.jsx', 'utf8')
const admin = fs.readFileSync('src/pages/Admin.jsx', 'utf8')
const api = fs.readFileSync('src/api-client.js', 'utf8')

test('PayMongo and Mailer API methods are properly exported in api-client.js', () => {
  assert.match(api, /export function createPayMongoCheckout/)
  assert.match(api, /export function sendTestEmail/)
  assert.match(api, /\/paymongo-checkout/)
  assert.match(api, /\/api\/mail\/test/)
})

test('Patient billing page contains PayMongo checkout button and payment return handlers', () => {
  assert.match(patient, /createPayMongoCheckout/)
  assert.match(patient, /Pay Online \(GCash \/ Maya \/ Card\)/)
  assert.match(patient, /Connecting to PayMongo…/)
  // The return redirect is not proof of payment: the banner follows the server's invoice status (see tests/billing-ui.test.js).
  assert.match(patient, /Confirming your payment/)
  assert.match(patient, /Payment received/)
  assert.match(patient, /Payment Cancelled/)
  assert.match(patient, /Payment Error/)
})

test('Admin automation page contains SMTP mailer diagnostics tool for clinic Owner', () => {
  assert.match(admin, /sendTestEmail/)
  assert.match(admin, /Clinic SMTP Mailer Diagnostics/)
  assert.match(admin, /Test recipient email/)
  assert.match(admin, /Send Test Email/)
  assert.match(admin, /Diagnostic Email Dispatched/)
})
