import React, { useState } from 'react'
import { Button, Field, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'

/**
 * Claim an online account for a record the clinic already has (registered at the counter without an email, or a dependent who
 * turned 18 and was invited). The same answer is shown whether or not the details match a record; a matching record gets a
 * 6-digit code by email, entered on the next screen.
 */
export function ClaimAccount({ onClaim }) {
  const [form, setForm] = useState({ email: '', date_of_birth: '', password: '', password_confirmation: '' })
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submit = async e => {
    e.preventDefault()
    if (form.password !== form.password_confirmation) return setError('The passwords do not match.')
    setBusy(true); setError('')
    const r = await onClaim(form)
    setBusy(false)
    if (!r.ok) setError((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'That did not work. Please try again.')
  }
  return <AuthShell><form className="auth-form" onSubmit={submit} aria-labelledby="claim-title">
    <div className="login-copy-wrap"><div className="eyebrow">Already a patient</div><h1 id="claim-title">Claim your online account</h1>
      <p className="login-copy">Registered at the clinic counter, or invited when you turned 18? Enter the email the clinic has for you and your date of birth. If they match your record, we email you a 6-digit code.</p></div>
    <Field label="Email" required><input type="email" autoComplete="email" value={form.email} onChange={e => set('email', e.target.value)}/></Field>
    <Field label="Date of birth" required><input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/></Field>
    <PasswordField label="Choose a password" value={form.password} onChange={e => set('password', e.target.value)} autoComplete="new-password"/>
    <PasswordField label="Repeat the password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)} autoComplete="new-password"/>
    {error && <Notice tone="warning" title="Not sent">{error}</Notice>}
    <Button type="submit" width="full" disabled={busy || !form.email || !form.date_of_birth || !form.password}>{busy ? 'Sending…' : 'Email me a code'}</Button>
    <p className="login-copy"><a href="#sign-in">Back to sign in</a></p>
  </form></AuthShell>
}
