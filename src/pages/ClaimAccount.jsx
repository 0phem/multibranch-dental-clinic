import React, { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { claimAccount, verifyClaim } from '../api-client.js'

/**
 * Claim an online account for a record the clinic already has. It starts either from the one-time link staff or a guardian
 * emailed (#claim-account/<token>: the link names the account, so the email is never retyped), or from the email and birth date
 * already on the record (the code goes only to that stored email; the same answer whether or not they match). Then step 1 is the
 * 6-digit code from the email and step 2 the new password, sent TOGETHER with the code, so only the person who reads the code can
 * set it. Success opens sign-in with the email filled in.
 */
const linkToken = () => (window.location.hash.match(/^#claim-account\/([A-Za-z0-9]{48})$/) || [])[1] || null

export function ClaimAccount({ onVerified = () => {} }) {
  const [token] = useState(linkToken)
  const [step, setStep] = useState(token ? 'link' : 'details'), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [form, setForm] = useState({ email: '', date_of_birth: '', otp: '', password: '', password_confirmation: '' })
  const [sentTo, setSentTo] = useState('')
  const heading = useRef(null)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const go = next => { setError(''); setStep(next); requestAnimationFrame(() => heading.current?.focus()) }
  const fail = r => setError((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'That did not work. Please try again.')

  useEffect(() => {
    if (!token) return
    let live = true
    setBusy(true)
    claimAccount({ token }).then(r => {
      if (!live) return
      setBusy(false)
      if (!r.ok) return fail(r)
      setSentTo(r.data?.email || ''); go('code')
    })
    return () => { live = false }
  }, [token])

  const sendCode = async e => {
    e.preventDefault()
    setBusy(true); setError('')
    const r = await claimAccount({ email: form.email, date_of_birth: form.date_of_birth })
    setBusy(false)
    if (!r.ok) return fail(r)
    setSentTo(form.email); go('code')
  }
  const finish = async e => {
    e.preventDefault()
    if (form.password !== form.password_confirmation) return setError('The passwords do not match.')
    setBusy(true); setError('')
    const r = await verifyClaim({ ...(token ? { token } : { email: form.email }), otp: form.otp, password: form.password, password_confirmation: form.password_confirmation })
    setBusy(false)
    if (!r.ok) return fail(r)
    onVerified(r.data?.email || form.email)
  }

  const codeBack = token ? null : <button type="button" className="link-button" onClick={() => go('details')}>Use a different email</button>
  return <AuthShell><div className="auth-form" aria-labelledby="claim-title">
    <div className="login-copy-wrap"><div className="eyebrow">Already a patient</div>
      <h1 id="claim-title" ref={heading} tabIndex={-1}>{step === 'password' ? 'Choose your password' : 'Claim your online account'}</h1></div>
    {step !== 'details' && step !== 'link' && <p className="au-muted" aria-live="polite">Step {step === 'code' ? 1 : 2} of 2</p>}

    {step === 'link' && <div aria-live="polite">{busy
      ? <p className="login-copy">Checking your link…</p>
      : error && <Notice tone="warning" title="This link can’t be used">{error}</Notice>}</div>}

    {step === 'details' && <form className="join-form" onSubmit={sendCode} noValidate>
      <p className="login-copy">Enter the email the clinic has on your record and your date of birth. If they match, we email a 6-digit code to that address.</p>
      <Field label="Email" required><input type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)}/></Field>
      <Field label="Date of birth" required><input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/></Field>
      {error && <Notice tone="warning" title="Not sent">{error}</Notice>}
      <Button type="submit" width="full" disabled={busy || !form.email || !form.date_of_birth}>{busy ? 'Sending…' : 'Email me a code'}</Button>
      <p className="au-muted">No email on your record? Ask the front desk to offer you an online account. They check your ID first.</p>
    </form>}

    {step === 'code' && <form className="join-form" onSubmit={e => { e.preventDefault(); go('password') }} noValidate>
      <p className="login-copy">{token ? `We emailed a 6-digit code to ${sentTo}.` : `If the details match a clinic record, a 6-digit code is on its way to ${sentTo}.`} It works for 10 minutes.</p>
      <Field label="6-digit code" required><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={form.otp} onChange={e => set('otp', e.target.value.replace(/\D/g, ''))}/></Field>
      <Button type="submit" width="full" disabled={form.otp.length !== 6}>Continue</Button>
      {codeBack}
    </form>}

    {step === 'password' && <form className="join-form" onSubmit={finish} noValidate>
      <p className="login-copy">Use at least 8 characters with letters and numbers. Your password is saved together with the code you entered.</p>
      <PasswordField label="New password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"/>
      <PasswordField label="Repeat the password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)} autoComplete="new-password"/>
      {error && <Notice tone="warning" title="Not activated">{error} {/code/i.test(error) && <button type="button" className="link-button" onClick={() => { set('otp', ''); go('code') }}>Enter the code again</button>}</Notice>}
      <Button type="submit" width="full" disabled={busy || !form.password || !form.password_confirmation}>{busy ? 'Activating…' : 'Activate my account'}</Button>
      <button type="button" className="link-button" onClick={() => go('code')}>Back</button>
    </form>}

    <p className="login-copy"><a href="#sign-in">Back to sign in</a></p>
  </div></AuthShell>
}
