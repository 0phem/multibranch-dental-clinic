import React, { useEffect, useMemo, useState } from 'react'
import { Button, Field, Icon } from '../components.jsx'
import { AuthShell } from './AuthShell.jsx'

const maskEmail=email=>{
  const [name,domain]=String(email||'').split('@')
  if(!domain)return email
  return `${name.length>2?`${name.slice(0,2)}${'•'.repeat(Math.max(1,name.length-2))}`:'••'}@${domain}`
}

export function EmailVerification({ email, initialResendAvailableAt, onVerify, onResend, onBack }) {
  // Reload recovery asks for the recipient again; passwords and verification codes are never persisted.
  const [recoveryEmail,setRecoveryEmail]=useState('')
  const recipient=email||recoveryEmail.trim()
  const [otp,setOtp]=useState(''),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const [cooldownUntil,setCooldownUntil]=useState(initialResendAvailableAt||'')
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const seconds=useMemo(()=>Math.max(0,Math.ceil((Date.parse(cooldownUntil||0)-now)/1000)),[cooldownUntil,now])
  const verify=async event=>{
    event.preventDefault();if(submitting)return
    setSubmitting(true);setError('')
    const result=await onVerify({email:recipient,otp})
    setSubmitting(false)
    if(!result?.ok){setError(result?.message||'Enter the code from your email.');return}
  }
  const resend=async()=>{
    if(submitting||seconds>0)return
    setSubmitting(true);setError('')
    const result=await onResend(recipient)
    setSubmitting(false)
    if(!result?.ok){setError(result?.message||'We could not send a new code.');if(result.retry_after)setCooldownUntil(new Date(Date.now()+result.retry_after*1000).toISOString());return}
    setCooldownUntil(result.data?.resend_available_at||new Date(Date.now()+60000).toISOString())
  }
  return <AuthShell><div className="auth-form auth-verification" aria-labelledby="verify-title">
    <div className="login-copy-wrap"><span className="auth-verification-mark" aria-hidden="true"><Icon name="shield" size={24}/></span><div className="eyebrow">Email verification</div><h1 id="verify-title">Verify your email</h1>
      {email?<><p className="login-copy">We sent a 6-digit verification code to:</p><strong className="auth-destination">{maskEmail(email)}</strong></>:<p className="login-copy">Continue verification with your registration email and the code from your inbox.</p>}
    </div>
    <form onSubmit={verify} noValidate aria-busy={submitting}>
      {!email&&<Field label="Registration email" required><input autoFocus type="email" autoComplete="email" value={recoveryEmail} onChange={e=>{setRecoveryEmail(e.target.value);setError('')}}/></Field>}
      <Field label="Email verification code" required error={error} hint="The code expires in 10 minutes."><input className="auth-otp" autoFocus={!!email} inputMode="numeric" autoComplete="one-time-code" aria-label="Email verification code" maxLength={6} value={otp} onChange={e=>{setOtp(e.target.value.replace(/\D/g,'').slice(0,6));setError('')}} placeholder="000000"/></Field>
      <div className="auth-submit"><Button type="submit" icon="arrow" disabled={submitting||otp.length!==6}>{submitting?'Checking code…':'Verify email'}</Button></div>
    </form>
    <p className="auth-change-email"><button type="button" className="text-link" onClick={onBack}>Use a different email</button></p>
    <div className="verification-resend"><p>{seconds>0?`You can request another code in ${seconds}s.`:'Didn’t receive the email?'}</p><Button type="button" variant="ghost" disabled={submitting||seconds>0} onClick={resend}>{submitting?'Sending…':'Resend code'}</Button></div>
  </div></AuthShell>
}
