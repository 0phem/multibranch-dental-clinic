import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INITIAL_PRESCRIPTIONS, NAV } from '../src/data.js'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('M19: prescriptions come from the clinic server; the browser mock and its seed are gone', () => {
  assert.deepEqual(INITIAL_PRESCRIPTIONS, [])
  assert.doesNotMatch(read('src/pages/Clinical.jsx'), /export function PrescriptionsPage/)
  assert.doesNotMatch(read('src/pages/PatientCare.jsx'), /export function PatientPrescriptionsPage/)
  assert.match(read('src/App.jsx'), /import\('\.\/pages\/ServerPrescriptions\.jsx'\)/)
  for (const role of ['dentist', 'staff', 'owner']) assert.ok(NAV[role].some(([k]) => k === 'prescriptions'), role)
})

test('M19: dentist form shows the allergy check, has no drug database or interaction claims, and issuing is final', () => {
  const page = read('src/pages/ServerPrescriptions.jsx')
  assert.match(page, /title="Check allergies before prescribing"/)
  assert.match(page, /There is no drug list and no interaction check/)
  assert.doesNotMatch(page, /interaction warning|drug database|e-signature|digitally signed/i)
  assert.match(page, /Issuing locks the prescription and gives it a number\. It cannot be edited afterwards, only voided\./)
  assert.match(page, /voidPrescription\(id, reason\.trim\(\)\)/)
})

test('M19: the patient sees issued prescriptions read-only with a PDF, and a void one is marked', () => {
  const page = read('src/patient/pages/Prescriptions.jsx')
  assert.match(page, /myPrescriptions\(\)/); assert.match(page, /downloadPrescriptionPdf\(p\.id, p\.number\)/)
  assert.match(page, /VOID — do not use/)
  assert.doesNotMatch(page, /updatePrescription|issuePrescription|voidPrescription/)
  assert.match(read('src/patient/Portal.jsx'), /\['prescriptions', 'file', 'Prescriptions'\]/)
})
