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

test('M19 (4.4): medicine name autocomplete and Other free-text option exist with no dev-written dosing defaults', () => {
  const page = read('src/pages/ServerPrescriptions.jsx')
  assert.match(page, /<datalist id="rx-common">/)
  assert.match(page, /<option value="__other__">Other \(free-text entry\)<\/option>/)
  assert.doesNotMatch(page, /COMMON_PRESETS/)
  assert.doesNotMatch(page, /Every 8 hours|Every 4 to 6 hours|Every 12 hours|Maximum 4000mg/i)
})

test('M19: the patient sees issued prescriptions read-only with a PDF, and a void one is marked', () => {
  const page = read('src/patient/pages/Prescriptions.jsx')
  assert.match(page, /myPrescriptions\(\)/); assert.match(page, /downloadPrescriptionPdf\(p\.id, p\.number\)/)
  assert.match(page, /VOID — do not use/)
  assert.doesNotMatch(page, /updatePrescription|issuePrescription|voidPrescription/)
  assert.match(read('src/patient/Portal.jsx'), /\['prescriptions', 'file', 'Prescriptions'\]/)
})

test('DEN-06 / DEN-07 / DEN-08: medicine dropdown omits dosage, remove medicine is danger-styled, and license Save button uses standard size', () => {
  const page = read('src/pages/ServerPrescriptions.jsx'), foundation = read('src/foundation.css'), autoCss = read('src/automations.css')
  assert.doesNotMatch(page, /'Amoxicillin 500mg'|'Mefenamic Acid 500mg'|'Paracetamol 500mg'|'Ibuprofen 400mg'|'Co-amoxiclav 625mg'|'Clindamycin 300mg'|'Tranexamic Acid 500mg'|'Celecoxib 200mg'|'Chlorhexidine 0\.12% Oral Rinse'/)
  assert.match(page, /'Amoxicillin'/)
  assert.match(page, /<Button size="sm" variant="danger" onClick=\{\(\) => setLines\(ls => ls\.filter/)
  assert.match(foundation, /\.btn\.danger:hover:not\(:disabled\)/)
  assert.match(page, /<form className="au-form rx-license-row"/)
  assert.match(page, /<div className="au-actions"><Button type="submit" disabled=\{busy\}>\{busy \? 'Saving…' : 'Save'\}<\/Button><\/div>/)
  assert.match(autoCss, /\.rx-license-row \{ display: flex; flex-wrap: wrap; align-items: flex-end;/)
})
