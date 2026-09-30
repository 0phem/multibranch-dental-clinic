import React, { useEffect, useMemo, useState } from 'react'
import { Brand } from '../layout.jsx'
import { Button, Field, Notice } from '../components.jsx'

const maskEmail=email=>{
  const [name,domain]=String(email||'').split('@')
  if(!domain)return email
  return `${name.length>2?`${name.slice(0,2)}${'•'.repeat(Math.max(1,name.length-2))}`:'••'}@${domain}`
}

export function EmailVerification({ email, initialResendAvailableAt, onVerify, onResend, onBack }) {
  const [otp,setOtp]=useState(''),[error,setError]=useState(''),[submitting,setSubmitting]=useState(false)
  const [cooldownUntil,setCooldownUntil]=useState(initialResendAvailableAt||'')
  const [now,setNow]=useState(Date.now())
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[])
  const seconds=useMemo(()=>Math.max(0,Math.ceil((Date.parse(cooldownUntil||0)-now)/1000)),[cooldownUntil,now])
  const verify=async event=>{
    event.preventDefault();if(submitting)return
    setSubmitting(true);setError('')
    const result=await onVerify({email,otp})
    setSubmitting(false)
    if(!result?.ok){setError(result?.message||'Enter the code from your email.');return}
  }
  const resend=async()=>{
    if(submitting||seconds>0)return
    setSubmitting(true);setError('')
    const result=await onResend(email)
    setSubmitting(false)
    if(!result?.ok){setError(result?.message||'We could not send a new code.');if(result.retry_after)setCooldownUntil(new Date(Date.now()+result.retry_after*1000).toISOString());return}
    setCooldownUntil(result.data?.resend_available_at||new Date(Date.now()+60000).toISOString())
  }
  return <main className="register-shell"><section className="register-panel" aria-labelledby="verify-title">
    <Brand className="brand-login"/><div className="login-copy-wrap"><div className="eyebrow">Verify your email</div><h1 id="verify-title">Enter your verification code</h1><p className="login-copy">We sent a six-digit code to <strong>{maskEmail(email)}</strong>. The code expires in 10 minutes.</p></div>
    <form onSubmit={verify} noValidate><Field label="Email verification code" required error={error}><input autoFocus inputMode="numeric" autoComplete="one-time-code" aria-label="Email verification code" maxLength={6} value={otp} onChange={e=>{setOtp(e.target.value.replace(/\D/g,'').slice(0,6));setError('')}} placeholder="000000"/></Field>
      {error&&<Notice tone="warning" title="Verification could not be completed">{error}</Notice>}
      <div className="row-actions top-gap"><Button type="submit" icon="arrow" disabled={submitting||otp.length!==6}>{submitting?'Checking code…':'Verify email'}</Button><Button type="button" variant="ghost" onClick={onBack}>Use a different email</Button></div>
    </form>
    <div className="verification-resend"><p>{seconds>0?`You can request another code in ${seconds}s.`:'Didn’t receive the email?'}</p><Button type="button" variant="ghost" disabled={submitting||seconds>0} onClick={resend}>{submitting?'Sending…':'Resend code'}</Button></div>
  </section></main>
}
