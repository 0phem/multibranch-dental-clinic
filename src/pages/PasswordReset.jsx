import React, { useEffect, useMemo, useState } from 'react'
import { Button, Field, Icon, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { requestPasswordReset, resetPassword, verifyPasswordResetOtp } from '../api-client.js'

// M1 password reset for every role: dedicated 3-step flow.
// Step 1 (#forgot-password): Enter email/phone to request an OTP. Submits request to backend and receives session verification ticket.
// Step 2 (#forgot-password/verify): Enter the OTP only. Clean, distraction-free keypad/input. Verifies OTP on backend and receives signed reset token.
// Step 3 (#forgot-password/new-password): Set new password + confirm password. Only reachable after OTP has been verified on the server;
// direct URL access redirects back to Step 1.
// Anti-enumeration: The server returns the identical answer whether or not an account exists.
// No code or password is ever stored on disk (state is kept in memory only).

function getStepFromHash(hash) {
  if (hash === '#forgot-password/new-password') return 'new-password'
  if (hash === '#forgot-password/verify') return 'verify'
  return 'request'
}

export function PasswordReset({ onSignIn }) {
  const [currentHash, setCurrentHash] = useState(() => (typeof window !== 'undefined' ? window.location.hash : '#forgot-password'))
  const [identifier, setIdentifier] = useState('')
  const [ticket, setTicket] = useState('')
  const [otp, setOtp] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState('')
  const [now, setNow] = useState(Date.now())
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const seconds = useMemo(() => Math.max(0, Math.ceil((Date.parse(cooldownUntil || 0) - now) / 1000)), [cooldownUntil, now])

  const targetStep = getStepFromHash(currentHash)

  // Route guards: direct URL access to Step 2 without ticket or Step 3 without resetToken redirects to Step 1
  useEffect(() => {
    if (targetStep === 'verify' && !ticket) {
      if (typeof window !== 'undefined') window.location.hash = 'forgot-password'
      setCurrentHash('#forgot-password')
    } else if (targetStep === 'new-password' && !resetToken) {
      if (typeof window !== 'undefined') window.location.hash = 'forgot-password'
      setCurrentHash('#forgot-password')
    }
  }, [targetStep, ticket, resetToken])

  useEffect(() => {
    const onHashChange = () => {
      setCurrentHash(window.location.hash)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Step 1: Submit email or phone
  const submitRequest = async event => {
    event?.preventDefault()
    if (submitting) return
    const trimmed = identifier.trim()
    if (!trimmed) return setErrors({ identifier: ['Enter your email or phone number.'] })
    setSubmitting(true)
    setErrors({})
    setMessage('')
    const result = await requestPasswordReset(trimmed)
    setSubmitting(false)
    if (!result.ok) {
      if (result.retry_after) setCooldownUntil(new Date(Date.now() + result.retry_after * 1000).toISOString())
      setErrors(result.errors || {})
      setMessage(result.message || 'We could not send a code. Try again.')
      return
    }
    if (result.data?.ticket) {
      setTicket(result.data.ticket)
    }
    setCooldownUntil(result.data?.resend_available_at || new Date(Date.now() + 60000).toISOString())
    if (typeof window !== 'undefined') {
      window.location.hash = 'forgot-password/verify'
      setCurrentHash('#forgot-password/verify')
    }
  }

  // Step 2: Verify OTP
  const submitOtp = async event => {
    event?.preventDefault()
    if (submitting || otp.length !== 6) return
    setSubmitting(true)
    setErrors({})
    setMessage('')
    const result = await verifyPasswordResetOtp({ ticket, otp })
    setSubmitting(false)
    if (!result.ok) {
      setErrors(result.errors || {})
      setMessage(result.errors?.otp?.[0] || result.message || 'That code is not valid or has expired. Try again.')
      return
    }
    if (result.data?.reset_token) {
      setResetToken(result.data.reset_token)
      if (typeof window !== 'undefined') {
        window.location.hash = 'forgot-password/new-password'
        setCurrentHash('#forgot-password/new-password')
      }
    }
  }

  // Resend code in Step 2
  const resendCode = async () => {
    if (submitting || seconds > 0) return
    setSubmitting(true)
    setErrors({})
    setMessage('')
    const result = await requestPasswordReset(identifier.trim())
    setSubmitting(false)
    if (!result.ok) {
      if (result.retry_after) setCooldownUntil(new Date(Date.now() + result.retry_after * 1000).toISOString())
      setMessage(result.message || 'We could not send a code. Try again.')
      return
    }
    if (result.data?.ticket) {
      setTicket(result.data.ticket)
    }
    setCooldownUntil(result.data?.resend_available_at || new Date(Date.now() + 60000).toISOString())
  }

  // Step 3: Set new password
  const submitNewPassword = async event => {
    event?.preventDefault()
    if (submitting) return
    if (password !== confirm) return setErrors({ password_confirmation: ['The passwords do not match.'] })
    setSubmitting(true)
    setErrors({})
    setMessage('')
    const result = await resetPassword({ resetToken, password, passwordConfirmation: confirm })
    setSubmitting(false)
    if (result.ok) {
      setPassword('')
      setConfirm('')
      setOtp('')
      setTicket('')
      setResetToken('')
      setDone(true)
      return
    }
    setErrors(result.errors || {})
    setMessage(result.message || 'Something went wrong. Try again.')
  }

  const goBackToStep1 = () => {
    setOtp('')
    setErrors({})
    setMessage('')
    if (typeof window !== 'undefined') {
      window.location.hash = 'forgot-password'
      setCurrentHash('#forgot-password')
    }
  }

  const effectiveStep = done ? 'done' : (targetStep === 'verify' && ticket ? 'verify' : (targetStep === 'new-password' && resetToken ? 'new-password' : 'request'))

  return (
    <AuthShell>
      <div className="auth-form auth-verification" aria-labelledby="reset-title">
        <div className="login-copy-wrap">
          <span className="auth-verification-mark" aria-hidden="true">
            <Icon name="shield" size={24} />
          </span>
          <div className="eyebrow">
            {effectiveStep === 'verify' ? 'Step 2 of 3: Verification' : effectiveStep === 'new-password' ? 'Step 3 of 3: New password' : 'Account recovery'}
          </div>
          <h1 id="reset-title">
            {effectiveStep === 'done'
              ? 'Password reset'
              : effectiveStep === 'verify'
              ? 'Enter verification code'
              : effectiveStep === 'new-password'
              ? 'Choose a new password'
              : 'Reset your password'}
          </h1>
          {effectiveStep === 'request' && (
            <p className="login-copy">Enter your email or phone number. If an account uses it, we’ll send a 6-digit code.</p>
          )}
          {effectiveStep === 'verify' && (
            <p className="login-copy">
              If an account uses <strong>{identifier.trim()}</strong>, a 6-digit code is on its way. Check your inbox and spam folder.
            </p>
          )}
          {effectiveStep === 'new-password' && (
            <p className="login-copy">Choose a strong password with at least 8 characters, including letters and numbers.</p>
          )}
        </div>

        {/* Step 1: Request OTP */}
        {effectiveStep === 'request' && (
          <form onSubmit={submitRequest} noValidate aria-busy={submitting}>
            <Field label="Email or phone number" required error={errors.identifier?.[0] || errors.email?.[0]}>
              <input
                type="text"
                autoComplete="username"
                autoFocus
                placeholder="e.g. name@example.com or 09171234567"
                value={identifier}
                onChange={e => {
                  setIdentifier(e.target.value)
                  setErrors({})
                  setMessage('')
                }}
              />
            </Field>
            {message && <Notice tone="warning" title="Couldn’t send a code">{message}</Notice>}
            <Button type="submit" className="login-button" icon="arrow" disabled={submitting}>
              {submitting ? 'Sending…' : 'Send code'}
            </Button>
          </form>
        )}

        {/* Step 2: Dedicated OTP Keypad/Input */}
        {effectiveStep === 'verify' && (
          <>
            <form onSubmit={submitOtp} noValidate aria-busy={submitting}>
              <Field label="6-digit code" required error={errors.otp?.[0]} hint="The code expires in 10 minutes.">
                <input
                  className="auth-otp"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={e => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6)
                    setOtp(cleaned)
                    setErrors({})
                    setMessage('')
                  }}
                  placeholder="000000"
                />
              </Field>
              {message && <Notice tone="warning" title="Verification failed">{message}</Notice>}
              <Button type="submit" className="login-button" icon="arrow" disabled={submitting || otp.length !== 6}>
                {submitting ? 'Verifying…' : 'Verify code'}
              </Button>
            </form>
            <div className="verification-resend">
              <p>{seconds > 0 ? `You can request another code in ${seconds}s.` : 'Didn’t receive the code?'}</p>
              <Button type="button" variant="ghost" disabled={submitting || seconds > 0} onClick={resendCode}>
                Send a new code
              </Button>
            </div>
            <p className="auth-change-email">
              <button type="button" className="text-link" onClick={goBackToStep1}>
                ← Use a different email or phone
              </button>
            </p>
          </>
        )}

        {/* Step 3: Set New Password */}
        {effectiveStep === 'new-password' && (
          <form onSubmit={submitNewPassword} noValidate aria-busy={submitting}>
            <PasswordField
              label="New password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={e => {
                setPassword(e.target.value)
                setErrors({})
                setMessage('')
              }}
              error={errors.password?.[0]}
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={e => {
                setConfirm(e.target.value)
                setErrors({})
                setMessage('')
              }}
              error={errors.password_confirmation?.[0]}
            />
            <p className="muted-copy">
              At least 8 characters with letters and numbers. Every device signed in to this account will be signed out.
            </p>
            {message && <Notice tone="warning" title="Couldn’t reset the password">{message}</Notice>}
            <Button type="submit" className="login-button" disabled={submitting || !password || !confirm}>
              {submitting ? 'Saving…' : 'Reset password'}
            </Button>
          </form>
        )}

        {/* Completion Step */}
        {effectiveStep === 'done' && (
          <>
            <Notice tone="success" title="Your password was changed">
              Sign in with your email and new password. We also emailed you a notice about this change.
            </Notice>
            <Button className="login-button top-gap" onClick={onSignIn}>
              Go to sign in
            </Button>
          </>
        )}

        {effectiveStep !== 'done' && (
          <p className="login-register-link">
            <button type="button" className="text-link" onClick={onSignIn}>
              Back to sign in
            </button>
          </p>
        )}
      </div>
    </AuthShell>
  )
}
