import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clearInvoiceLinkFromUrl, readInvoiceLink, rememberInvoiceLink, takeInvoiceLink } from '../src/invoice-link.js'
import { billingAddressErrors } from '../src/billing-address.js'

const ID = '01m4tz56s7mbgfg9q625sd1564'
const memory = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

test('an invoice link is read only for a well-formed id and a known payment value', () => {
  assert.deepEqual(readInvoiceLink(`?invoice=${ID}`), { invoiceId: ID, payment: null })
  assert.deepEqual(readInvoiceLink(`?invoice=${ID.toUpperCase()}&payment=success`), { invoiceId: ID, payment: 'success' })
  assert.deepEqual(readInvoiceLink(`?invoice=${ID}&payment=cancelled`), { invoiceId: ID, payment: 'cancelled' })
  assert.deepEqual(readInvoiceLink(`?invoice=${ID}&payment=paid`), { invoiceId: ID, payment: null }, 'an unknown payment value is ignored, never trusted')
  for (const bad of ['', '?invoice=', '?invoice=../../x', '?invoice=1;drop', `?ref=${ID}`, null]) assert.equal(readInvoiceLink(bad), null)
})

test('the link survives sign-in once, in this tab only, and storage failures are harmless', () => {
  const storage = memory()
  rememberInvoiceLink({ invoiceId: ID, payment: 'success' }, storage)
  assert.deepEqual(takeInvoiceLink(storage), { invoiceId: ID, payment: 'success' })
  assert.equal(takeInvoiceLink(storage), null, 'taken once')
  storage.setItem('dentalops-v4-invoice-link', '{not json')
  assert.equal(takeInvoiceLink(storage), null)
  const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() {} }
  assert.doesNotThrow(() => rememberInvoiceLink({ invoiceId: ID, payment: null }, broken))
  assert.equal(takeInvoiceLink(broken), null)
})

test('the address bar is cleaned after the link is used', () => {
  let replaced = null
  const win = { location: { href: `http://localhost:5173/?invoice=${ID}&payment=success#sign-in` }, history: { state: null, replaceState: (_s, _t, url) => { replaced = url } } }
  clearInvoiceLinkFromUrl(win)
  assert.equal(replaced, '/')
})

test('App applies a remembered link after sign-in, for a Patient only', () => {
  const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8')
  assert.match(app, /rememberInvoiceLink\(readInvoiceLink\(window\.location\.search\)\)/)
  assert.match(app, /if\(session\.role==='patient'\)\{setContext\(link\);setPageState\('billing'\)\}/)
  assert.match(app, /if\(invoiceLink\.current===undefined\)invoiceLink\.current=takeInvoiceLink\(\)/, 'a repeated session start re-applies the same link')
  assert.match(app, /invoiceLink\.current=null/, 'sign-out forgets it')
})

test('the billing address is optional, but once started it must be complete and use a two-letter country', () => {
  assert.deepEqual(billingAddressErrors({ country: 'PH' }), { errors: {}, address: null })
  assert.deepEqual(billingAddressErrors({}), { errors: {}, address: null })
  const partial = billingAddressErrors({ line1: '37 MacArthur Hwy', country: 'Philippines' })
  assert.deepEqual(Object.keys(partial.errors).sort(), ['city', 'country', 'postal_code', 'state'])
  const ok = billingAddressErrors({ line1: ' 37 MacArthur Hwy ', line2: '', city: 'Bocaue', state: 'Bulacan', postal_code: '3018', country: 'ph' })
  assert.deepEqual(ok, { errors: {}, address: { line1: '37 MacArthur Hwy', line2: '', city: 'Bocaue', state: 'Bulacan', postal_code: '3018', country: 'PH' } })
})
