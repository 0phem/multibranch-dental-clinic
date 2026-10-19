import React, { useEffect, useState } from 'react'
import { Button, Field, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { claimAccount, verifyClaim } from '../api-client.js'

/**
 * Claim an online account for a record the clinic already has. Step 1 is either the one-time link staff or a guardian emailed
 * (#claim-account/<token>), or the email and birth date already on the record (the code goes only to that stored email; the same
 * answer whether or not they match). Step 2: the 6-digit code from the email TOGETHER with the new password, so only the person
 * who reads the code can set it.
 */
const linkToken = () => (window.location.hash.match(/^#claim-account\/([A-Za-z0-9]{48})$/) || [])[1] || null

export function ClaimAccount() {
  const [step, setStep] = useState('details'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', date_of_birth: '', otp: '', password: '', password_confirmation: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [token] = useState(linkToken), [sentTo, setSentTo] = useState('')
  useEffect(() => {
    if (!token) return
    setBusy(true)
    claimAccount({ token }).then(r => {
      setBusy(false)
      if (!r.ok) return setError(r.message || 'This link is not valid any more. Ask the clinic for a new one.')
      setSentTo(r.data?.email || ''); setStep('link-email')
    })
  }, [token])
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
    {step === 'details' && token && <div>{busy ? <p className="login-copy">Checking your link…</p> : error && <Notice tone="warning" title="Link not valid">{error}</Notice>}</div>}
    {step === 'link-email' && <form onSubmit={e => { e.preventDefault(); setStep('code') }}>
      <p className="login-copy">We emailed a 6-digit code to {sentTo}. Type that full email address to continue.</p>
      <Field label="Email" required><input type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)}/></Field>
      <Button type="submit" width="full" disabled={!form.email}>Continue</Button>
    </form>}
    {step === 'details' && !token && <form onSubmit={sendCode}>
      <p className="login-copy">Already a patient? Enter the email the clinic has on your record and your date of birth. If they match, we email a 6-digit code to that address. No email on your record? Ask the front desk to offer you an online account after checking your ID.</p>
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
