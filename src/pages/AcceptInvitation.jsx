import React, { useEffect, useState } from 'react'
import { Button, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { acceptInvitation, parseAcceptHash } from '../employee-invitations.js'

// M1: an invited Staff member or Dentist chooses their password through the emailed single-use link. Setting it here is
// the identity confirmation (it proves control of the invited email). The server gives one generic answer for every bad,
// used, cancelled or expired link, so this page cannot reveal who was invited.
export function AcceptInvitation({ hash, onSignIn }) {
  // Read the link once, then drop the token from the address bar so it is not left on screen or in history.
  const [link] = useState(() => parseAcceptHash(hash))
  useEffect(() => { if (link && typeof window !== 'undefined') window.history.replaceState(null, '', '#accept-invitation') }, [link])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [state, setState] = useState({ phase: 'form', message: '', errors: {} })

  const submit = async event => {
    event.preventDefault()
    if (password !== confirm) return setState({ phase: 'form', message: '', errors: { password_confirmation: ['The passwords do not match.'] } })
    setState({ phase: 'submitting', message: '', errors: {} })
    const result = await acceptInvitation({ ...link, password, passwordConfirmation: confirm })
    if (result.ok) return setState({ phase: 'done', message: '', errors: {} })
    setState({ phase: 'form', message: result.errors?.token?.[0] || result.message || 'Something went wrong. Try again.', errors: result.errors || {} })
  }

  return <AuthShell><div className="auth-form" aria-labelledby="accept-title">
    <div className="login-copy-wrap"><div className="eyebrow">Employee invitation</div><h1 id="accept-title">Set your password</h1>
      <p className="login-copy">{link ? `Choose a password for ${link.email}.` : 'This invitation link is incomplete.'}</p></div>
    {!link && <Notice tone="warning" title="Link not recognised">Open the link exactly as it appears in your invitation email, or ask the clinic Owner to send a new one.</Notice>}
    {link && state.phase === 'done' && <><Notice tone="success" title="Password set">Your account is ready. Sign in with your email and the password you just chose.</Notice>
      <Button className="login-button top-gap" onClick={onSignIn}>Go to sign in</Button></>}
    {link && state.phase !== 'done' && <form onSubmit={submit} noValidate aria-busy={state.phase === 'submitting'}>
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} error={state.errors.password?.[0]}/>
      <PasswordField label="Confirm password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} error={state.errors.password_confirmation?.[0]}/>
      <p className="muted-copy">At least 8 characters with letters and numbers.</p>
      {state.message && <Notice tone="warning" title="Couldn’t set the password">{state.message}</Notice>}
      <Button type="submit" className="login-button" disabled={state.phase === 'submitting'}>{state.phase === 'submitting' ? 'Saving…' : 'Set password'}</Button>
    </form>}
  </div></AuthShell>
}
