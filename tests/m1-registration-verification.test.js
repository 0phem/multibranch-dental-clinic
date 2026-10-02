import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8')

test('Patient registration phone control is editable, defaults to +63, and supports alternate country codes',()=>{
  const phone=read('src/pages/PatientRegister.jsx'), table=read('src/phone.js')
  assert.match(phone,/type="search"/)
  assert.match(phone,/role="listbox"/)
  assert.match(phone,/onCountryChange\(c\.code\)/)
  assert.match(phone,/value=\{localNumber\}/)
  assert.match(phone,/onLocalNumberChange\(e\.target\.value\)/)
  assert.match(phone,/inputMode="tel"/)
  assert.match(table,/getCountries\(\)/)
  assert.match(table,/code==='PH'/)
  assert.match(phone,/normalizePhoneNumber\(countryCode,phoneLocal\)/)
})

test('registration transitions to email OTP and never presents SMS verification language',()=>{
  const app=read('src/App.jsx'), verify=read('src/pages/EmailVerification.jsx'), api=read('src/api-client.js')
  assert.match(app,/setVerification\(\{email:result\.data\.email/)
  assert.match(app,/EmailVerification/)
  assert.match(verify,/autoComplete="one-time-code"/)
  assert.match(verify,/Resend code/)
  assert.match(verify,/onVerify/)
  assert.doesNotMatch(`${app}${verify}${api}`,/SMS|sms|text message|phone verification/i)
  assert.match(api,/verifyRegistrationEmail/)
  assert.match(api,/resendRegistrationEmail/)
})

test('registration has required birth date and aligned password toggles on both fields',()=>{
  const page=read('src/pages/PatientRegister.jsx'), field=read('src/pages/PasswordField.jsx'), css=read('src/foundation.css')
  assert.match(page,/<Field label="Date of birth" required/)
  assert.match(page,/max=\{maxDob\}/)
  assert.equal((page.match(/<PasswordField/g)||[]).length,2)
  assert.match(field,/aria-pressed=\{visible\}/)
  assert.match(field,/type=\{visible\?'text':'password'\}/)
  assert.match(css,/\.auth-password-control \{ position: relative/)
})

test('login, registration and verification share a responsive auth shell',()=>{
  const shell=read('src/pages/AuthShell.jsx'),css=read('src/foundation.css'),login=read('src/layout.jsx')
  assert.match(shell,/Patient Portal/)
  assert.match(read('src/clinic-config.js'),/Dr\. Dana E\. Roxas Dental Clinic/)
  assert.match(css,/@media \(max-width: 480px\)/)
  assert.match(login,/<AuthShell>/)
  assert.match(login,/onShowRegister/)
})

test('registration displays server validation beside the matching field and keeps the phone picker keyboard operable',()=>{
  const page=read('src/pages/PatientRegister.jsx')
  assert.match(page,/Object\.entries\(result\.errors\|\|\{\}\)/)
  for(const field of ['first_name','last_name','date_of_birth','email','phone','password','password_confirmation'])
    assert.match(page,new RegExp(`errors\\.${field}`))
  assert.match(page,/event\.key==='Escape'/)
  assert.match(page,/aria-expanded=\{open\}/)
})
