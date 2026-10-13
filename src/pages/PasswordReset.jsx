import React, { useEffect, useMemo, useState } from 'react'
import { Button, Field, Icon, Notice } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { requestPasswordReset, resetPassword } from '../api-client.js'

// M1 password reset for every role. Step 1 asks for the email; the server answers the same way whether or not an account
// uses it, so this page never tells the person whether an address is registered. Step 2 takes the emailed 6-digit code and the new password. Neither
// the code nor the password is stored in the browser.
export function PasswordReset({ onSignIn }) {
  const [phase,setPhase]=useState('email') // email → code → done
  const [email,setEmail]=useState('')
  const [otp,setOtp]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
  const [errors,setErrors]=useState({}),[message,setMessage]=useState(''),[submitting,setSubmitting]=useState(false)
  const [cooldownUntil,setCooldownUntil]=useState('')
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const seconds=useMemo(()=>Math.max(0,Math.ceil((Date.parse(cooldownUntil||0)-now)/1000)),[cooldownUntil,now])

  const sendCode=async event=>{
    event?.preventDefault()
    if(submitting||(phase==='code'&&seconds>0))return
    if(!email.trim())return setErrors({email:['Enter your email.']})
    setSubmitting(true);setErrors({});setMessage('')
    const result=await requestPasswordReset(email.trim())
    setSubmitting(false)
    if(!result.ok){
      if(result.retry_after)setCooldownUntil(new Date(Date.now()+result.retry_after*1000).toISOString())
      setErrors(result.errors||{});setMessage(result.message||'We could not send a code. Try again.');return
    }
    setCooldownUntil(result.data?.resend_available_at||new Date(Date.now()+60000).toISOString())
    setPhase('code')
  }

  const submit=async event=>{
    event.preventDefault()
    if(submitting)return
    if(password!==confirm)return setErrors({password_confirmation:['The passwords do not match.']})
    setSubmitting(true);setErrors({});setMessage('')
    const result=await resetPassword({email:email.trim(),otp,password,passwordConfirmation:confirm})
    setSubmitting(false)
    if(result.ok){setPassword('');setConfirm('');setOtp('');setPhase('done');return}
    setErrors(result.errors||{})
    setMessage(result.errors?.otp?.[0]?'':(result.message||'Something went wrong. Try again.'))
  }

  return <AuthShell><div className="auth-form auth-verification" aria-labelledby="reset-title">
    <div className="login-copy-wrap"><span className="auth-verification-mark" aria-hidden="true"><Icon name="shield" size={24}/></span><div className="eyebrow">Account recovery</div>
      <h1 id="reset-title">{phase==='done'?'Password reset':'Reset your password'}</h1>
      {phase==='email'&&<p className="login-copy">Enter the email you sign in with. If an account uses it, we’ll email a 6-digit code.</p>}
      {phase==='code'&&<p className="login-copy">If an account uses <strong>{email.trim()}</strong>, a 6-digit code is on its way. Check your inbox and spam folder.</p>}
    </div>
    {phase==='email'&&<form onSubmit={sendCode} noValidate aria-busy={submitting}>
      <Field label="Email" required error={errors.email?.[0]}><input type="email" autoComplete="email" autoFocus value={email} onChange={e=>{setEmail(e.target.value);setErrors({});setMessage('')}}/></Field>
      {message&&<Notice tone="warning" title="Couldn’t send a code">{message}</Notice>}
      <Button type="submit" className="login-button" icon="arrow" disabled={submitting}>{submitting?'Sending…':'Send code'}</Button>
    </form>}
    {phase==='code'&&<>
      <form onSubmit={submit} noValidate aria-busy={submitting}>
        <Field label="Code from the email" required error={errors.otp?.[0]} hint="The code expires in 10 minutes."><input className="auth-otp" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>{setOtp(e.target.value.replace(/\D/g,'').slice(0,6));setErrors({});setMessage('')}} placeholder="000000"/></Field>
        <PasswordField label="New password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} error={errors.password?.[0]}/>
        <PasswordField label="Confirm new password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} error={errors.password_confirmation?.[0]}/>
        <p className="muted-copy">At least 8 characters with letters and numbers. Every device signed in to this account will be signed out.</p>
        {message&&<Notice tone="warning" title="Couldn’t reset the password">{message}</Notice>}
        <Button type="submit" className="login-button" disabled={submitting||otp.length!==6}>{submitting?'Saving…':'Reset password'}</Button>
      </form>
      <div className="verification-resend"><p>{seconds>0?`You can request another code in ${seconds}s.`:'Didn’t receive the email?'}</p><Button type="button" variant="ghost" disabled={submitting||seconds>0} onClick={sendCode}>Send a new code</Button></div>
      <p className="auth-change-email"><button type="button" className="text-link" onClick={()=>{setPhase('email');setOtp('');setErrors({});setMessage('')}}>Use a different email</button></p>
    </>}
    {phase==='done'&&<><Notice tone="success" title="Your password was changed">Sign in with your email and new password. We also emailed you a notice about this change.</Notice>
      <Button className="login-button top-gap" onClick={onSignIn}>Go to sign in</Button></>}
    {phase!=='done'&&<p className="login-register-link"><button type="button" className="text-link" onClick={onSignIn}>Back to sign in</button></p>}
  </div></AuthShell>
}
