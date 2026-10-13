import React, { useState } from 'react'
import { Button, Field, Modal, Notice } from '../components.jsx'
import { PasswordField } from './PasswordField.jsx'
import { requestEmailChange, confirmEmailChange } from '../api-client.js'

// M1 sign-in email change. Step 1 re-confirms the current password and sends a 6-digit code to the NEW address; step 2
// takes that code. The server answers step 1 the same way when the new address belongs to someone else (no code is sent),
// so this dialog never says whether an address is in use. A successful change signs every session out, this one included.
export function ChangeEmailButton() {
  const [open,setOpen]=useState(false)
  const [phase,setPhase]=useState('request') // request → code → done
  const [newEmail,setNewEmail]=useState(''),[password,setPassword]=useState(''),[otp,setOtp]=useState('')
  const [errors,setErrors]=useState({}),[message,setMessage]=useState(''),[submitting,setSubmitting]=useState(false)
  const reset=()=>{setPhase('request');setNewEmail('');setPassword('');setOtp('');setErrors({});setMessage('')}
  const close=()=>{if(submitting||phase==='done')return;setOpen(false);reset()}

  const request=async event=>{
    event.preventDefault()
    if(submitting)return
    setSubmitting(true);setErrors({});setMessage('')
    const result=await requestEmailChange({newEmail:newEmail.trim(),currentPassword:password})
    setSubmitting(false)
    if(!result.ok){setErrors(result.errors||{});setMessage(Object.keys(result.errors||{}).length?'':(result.message||'Something went wrong. Try again.'));return}
    setPassword('');setPhase('code')
  }
  const confirm=async event=>{
    event.preventDefault()
    if(submitting)return
    setSubmitting(true);setErrors({});setMessage('')
    const result=await confirmEmailChange(otp)
    setSubmitting(false)
    if(!result.ok){setErrors(result.errors||{});setMessage(result.errors?.otp?.[0]?'':(result.message||'Something went wrong. Try again.'));return}
    setPhase('done')
  }
  const signInAgain=()=>{window.location.hash='sign-in';window.location.reload()}

  return <>
    <Button size="sm" variant="soft" onClick={()=>setOpen(true)}>Change sign-in email</Button>
    <Modal open={open} onClose={close} title="Change sign-in email" subtitle={phase==='done'?null:'We’ll send a code to the new address to confirm it’s yours.'}>
      {phase==='request'&&<form onSubmit={request} className="form-grid one-col" noValidate aria-busy={submitting}>
        <Field label="New email" required error={errors.new_email?.[0]}><input type="email" autoComplete="email" value={newEmail} onChange={e=>{setNewEmail(e.target.value);setErrors({})}}/></Field>
        <PasswordField label="Current password" autoComplete="current-password" value={password} onChange={e=>{setPassword(e.target.value);setErrors({})}} error={errors.current_password?.[0]}/>
        {message&&<Notice tone="warning">{message}</Notice>}
        <div className="form-actions"><Button type="button" variant="ghost" onClick={close}>Cancel</Button><Button type="submit" disabled={submitting||!newEmail.trim()||!password}>{submitting?'Sending…':'Send code'}</Button></div>
      </form>}
      {phase==='code'&&<form onSubmit={confirm} className="form-grid one-col" noValidate aria-busy={submitting}>
        <p>If <strong>{newEmail.trim()}</strong> can be used, a 6-digit code is on its way to it. Check that inbox and its spam folder.</p>
        <Field label="Code from the email" required error={errors.otp?.[0]} hint="The code expires in 10 minutes."><input className="auth-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={e=>{setOtp(e.target.value.replace(/\D/g,'').slice(0,6));setErrors({})}} placeholder="000000"/></Field>
        {message&&<Notice tone="warning">{message}</Notice>}
        <div className="form-actions"><Button type="button" variant="ghost" onClick={()=>{setPhase('request');setOtp('');setErrors({});setMessage('')}}>Back</Button><Button type="submit" disabled={submitting||otp.length!==6}>{submitting?'Checking…':'Confirm new email'}</Button></div>
      </form>}
      {phase==='done'&&<><Notice tone="success" title="Your sign-in email was changed">For your security you’ve been signed out everywhere. Sign in again with your new email. We sent a notice to your previous address.</Notice>
        <div className="form-actions"><Button onClick={signInAgain}>Sign in again</Button></div></>}
    </Modal>
  </>
}
