import React, { useState } from 'react'
import { Button, Field, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { claimAccount, verifyClaim } from '../api-client.js'

/**
 * Claim an online account for a record the clinic already has (registered at the counter without an email, or a dependent who
 * turned 18 and was invited). Step 1: email and birth date (the same answer whether or not they match). Step 2: the 6-digit code
 * from the email TOGETHER with the new password, so only the person who reads the code can set it.
 */
export function ClaimAccount() {
  const [step, setStep] = useState('details'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', date_of_birth: '', otp: '', password: '', password_confirmation: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const fail = r => setError((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'That did not work. Please try again.')
  const sendCode = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await claimAccount({ email: form.email, date_of_birth: form.date_of_birth })
    setBusy(false)
    if (!r.ok) return fail(r)
    setStep('code')
  }
  const finish = async e => {
    e.preventDefault()
    if (form.password !== form.password_confirmation) return setError('The passwords do not match.')
    setBusy(true); setError('')
    const r = await verifyClaim({ email: form.email, otp: form.otp, password: form.password, password_confirmation: form.password_confirmation })
    setBusy(false)
    if (!r.ok) return fail(r)
    setStep('done')
  }
  return <AuthShell><div className="auth-form" aria-labelledby="claim-title">
    <div className="login-copy-wrap"><div className="eyebrow">Already a patient</div><h1 id="claim-title">Claim your online account</h1></div>
    {step === 'details' && <form onSubmit={sendCode}>
      <p className="login-copy">Registered at the clinic counter, or invited when you turned 18? Enter the email the clinic has for you and your date of birth. If they match your record, we email you a 6-digit code.</p>
      <Field label="Email" required><input type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)}/></Field>
      <Field label="Date of birth" required><input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/></Field>
      {error && <Notice tone="warning" title="Not sent">{error}</Notice>}
      <Button type="submit" width="full" disabled={busy || !form.email || !form.date_of_birth}>{busy ? 'Sending…' : 'Email me a code'}</Button>
    </form>}
    {step === 'code' && <form onSubmit={finish}>
      <p className="login-copy">If the details match a clinic record, a 6-digit code is on its way to {form.email}. Enter it and choose your password.</p>
      <Field label="6-digit code" required><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.otp} onChange={e => set('otp', e.target.value.replace(/\D/g, ''))}/></Field>
      <PasswordField label="Choose a password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"/>
      <PasswordField label="Repeat the password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)} autoComplete="new-password"/>
      {error && <Notice tone="warning" title="Not verified">{error}</Notice>}
      <Button type="submit" width="full" disabled={busy || form.otp.length !== 6 || !form.password}>{busy ? 'Checking…' : 'Activate my account'}</Button>
    </form>}
    {step === 'done' && <Notice tone="success" title="Your account is ready">Sign in with your email and the password you chose.</Notice>}
    <p className="login-copy"><a href="#sign-in">Back to sign in</a></p>
  </div></AuthShell>
}
