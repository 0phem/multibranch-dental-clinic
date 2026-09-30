import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8')

test('Patient registration phone control is editable, defaults to +63, and supports alternate country codes',()=>{
  const phone=read('src/pages/PatientRegister.jsx'), table=read('src/phone.js')
  assert.match(phone,/value=\{dial\}/)
  assert.match(phone,/onChange=\{e=>onDialChange\(e\.target\.value\)\}/)
  assert.match(phone,/value=\{localNumber\}/)
  assert.match(table,/dial: '\+63'/)
  assert.match(table,/dial: '\+1'/)
  assert.match(phone,/normalizePhoneNumber\(dial,phoneLocal\)/)
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

test('password visibility control is shared by password and confirmation fields',()=>{
  const page=read('src/pages/PatientRegister.jsx'), css=read('src/foundation.css')
  assert.equal((page.match(/type=\{showPassword\?'text':'password'\}/g)||[]).length,2)
  assert.match(page,/className="show-password"/)
  assert.match(css,/\.show-password \{[^}]*align-items: center/)
  assert.match(css,/\.show-password input \{ margin: 0; \}/)
})
