import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { applyBranding, clinic } from '../src/clinic-config.js'

test('the Owner branding replaces the fallback identity, contact and (only when uploaded) the logo', () => {
  const before = { ...clinic }
  try {
    applyBranding({ name: 'Bright Smile Dental', name_line: 'Bright Smile', subtitle: 'Family Dentistry', address: 'Malolos, Bulacan', phone: '0917 555 0101',
      email: 'hello@brightsmile.test', logo_url: 'http://localhost:8000/api/branding/logo?v=1', logo_custom: false })
    assert.equal(clinic.name, 'Bright Smile Dental')
    assert.equal(clinic.nameLine, 'Bright Smile')
    assert.equal(clinic.subtitle, 'Family Dentistry')
    assert.equal(clinic.phoneE164, '+639175550101')
    assert.equal(clinic.locationLabel, 'Bright Smile Dental - Malolos, Bulacan')
    assert.equal(clinic.logo, '/images/logo.png', 'the supplied logo stays unless one was uploaded')
    applyBranding({ logo_url: 'http://localhost:8000/api/branding/logo?v=2', logo_custom: true, name: '   ' })
    assert.equal(clinic.logo, 'http://localhost:8000/api/branding/logo?v=2')
    assert.equal(clinic.name, 'Bright Smile Dental', 'blank values keep what is there')
    applyBranding(null)
    assert.ok(Array.isArray(clinic.branches) && Object.isFrozen(clinic.branches), 'branch map pins are unchanged')
  } finally {
    Object.assign(clinic, before)
  }
})

test('branding loads before the first render and nothing else hard-codes the clinic name', () => {
  assert.match(readFileSync(new URL('../src/main.jsx', import.meta.url), 'utf8'), /loadBranding\(apiBase\)\.finally\(\(\) => createRoot/)
  for (const file of ['src/pages/PatientCare.jsx', 'src/layout.jsx', 'src/pages/ReviewAndPay.jsx', 'src/Brand.jsx']) {
    assert.doesNotMatch(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replace(/\/\/.*$/gm, ''), /Dr\. Dana E\. Roxas Dental Clinic/, file)
  }
})

test('the Owner reaches Clinic Branding; no other role does', async () => {
  const { canAccessPage } = await import('../src/safeguards.js')
  const source = readFileSync(new URL('../src/safeguards.js', import.meta.url), 'utf8')
  assert.match(source, /owner:\[[^\]]*'branding'/)
  for (const role of ['patient', 'staff', 'dentist']) assert.doesNotMatch(source.match(new RegExp(`${role}:\\[[^\\]]*\\]`))[0], /'branding'/, role)
  assert.equal(typeof canAccessPage, 'function')
})

test('the logo file is checked in the browser before upload (type, size, dimensions, shape)', async () => {
  const { checkLogoFile } = await import('../src/logo-check.js')
  const file = (type, size) => ({ type, size })
  const sized = (width, height) => async () => ({ width, height })
  assert.match(await checkLogoFile(null), /Choose a logo/)
  assert.match(await checkLogoFile(file('image/svg+xml', 1000), sized(300, 300)), /PNG or JPEG/)
  assert.match(await checkLogoFile(file('image/png', 600 * 1024), sized(300, 300)), /512 KB/)
  assert.match(await checkLogoFile(file('image/png', 1000), sized(100, 100)), /128/)
  assert.match(await checkLogoFile(file('image/jpeg', 1000), sized(900, 300)), /square/)
  assert.match(await checkLogoFile(file('image/png', 1000), async () => null), /could not be read/)
  assert.equal(await checkLogoFile(file('image/png', 1000), sized(400, 360)), '')
})
