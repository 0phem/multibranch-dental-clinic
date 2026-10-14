import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { paymentMethodLabel } from '../src/payment-method.js'

test('stored PayMongo methods are shown in plain words; Staff-recorded methods as stored', () => {
  assert.equal(paymentMethodLabel('PayMongo (GCASH)'), 'GCash')
  assert.equal(paymentMethodLabel('PayMongo (CARD)'), 'Card')
  assert.equal(paymentMethodLabel('PayMongo (MAYA)'), 'Maya')
  assert.equal(paymentMethodLabel('PayMongo (QR PH)'), 'QR Ph')
  assert.equal(paymentMethodLabel('PayMongo (ONLINE BANKING)'), 'Online banking')
  assert.equal(paymentMethodLabel('PayMongo (NEWWALLET)'), 'Newwallet')
  for (const kept of ['Cash', 'Card/POS', 'Bank Transfer', 'E-Wallet', 'GCash']) assert.equal(paymentMethodLabel(kept), kept)
  for (const empty of [null, undefined, '', 42]) assert.equal(paymentMethodLabel(empty), '')
})

test('the Patient receipt and visit views use the display mapping (no stored value changes)', () => {
  assert.match(readFileSync(new URL('../src/pages/PatientCare.jsx', import.meta.url), 'utf8'), /method:paymentMethodLabel\(i\.receipt\.method\)/)
  assert.match(readFileSync(new URL('../src/patient-view.js', import.meta.url), 'utf8'), /method:paymentMethodLabel\(payment\?\.method/)
})
