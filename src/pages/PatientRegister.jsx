import React, { useEffect, useRef, useState } from 'react'
import { Button, Field, Notice, SectionLabel } from '../components.jsx'
import { COUNTRY_CODES, DEFAULT_COUNTRY, normalizePhoneNumber } from '../phone.js'
import { AuthShell } from './AuthShell.jsx'
import { PasswordField } from './PasswordField.jsx'
import { clinicDate } from '../clock.js'

// Patient self-registration (M1/M4, Backend Foundation 1B). Submits to the real Laravel backend
// (`POST /api/register` via the `onRegister` prop — see App.jsx/api-client.js), which creates a pending
// Person+Patient+User in PostgreSQL and sends an email OTP. The account cannot enter the workspace until the
// OTP is verified.
//
// No "Preferred branch" field: the current backend registration contract collects no branch preference (see
// backend/README.md) — the frontend identity bridge defaults it locally, and this form does not invent one.
// The identity form intentionally collects first and last name only.
const emptyForm={first_name:'',last_name:'',email:'',date_of_birth:'',password:'',password_confirmation:''}

function PhoneField({ countryCode, localNumber, onCountryChange, onLocalNumberChange, error }) {
  const [open,setOpen]=useState(false),[search,setSearch]=useState('')
  const wrapRef=useRef(null),triggerRef=useRef(null),numberRef=useRef(null)
  useEffect(()=>{
    if(!open)return
    const close=event=>{if(!wrapRef.current?.contains(event.target))setOpen(false)}
    document.addEventListener('pointerdown',close)
    return()=>document.removeEventListener('pointerdown',close)
  },[open])
  const country=COUNTRY_CODES.find(c=>c.code===countryCode)||DEFAULT_COUNTRY
  const matches=COUNTRY_CODES.filter(c=>`${c.label} ${c.code} ${c.dial}`.toLowerCase().includes(search.trim().toLowerCase()))
  return <div className={`field auth-phone-field ${error?'has-error':''}`}>
    <span>Phone number<b className="required" aria-hidden="true">*</b></span>
    <div className="phone-field">
      <div className="auth-country-wrap" ref={wrapRef} onKeyDown={event=>{if(event.key==='Escape'){setOpen(false);triggerRef.current?.focus()}}}>
        <button type="button" ref={triggerRef} className="auth-country-trigger" aria-label={`Country and calling code: ${country.label} ${country.dial}`}
          aria-expanded={open} aria-haspopup="listbox" onClick={()=>{setOpen(!open);setSearch('')}}>
          <span className="auth-country-name">{country.label}</span><b>{country.dial}</b><span aria-hidden="true">⌄</span>
        </button>
        {open&&<div className="auth-country-menu">
          <input type="search" autoFocus aria-label="Search countries" placeholder="Search country or code" value={search} onChange={e=>setSearch(e.target.value)}/>
          <div role="listbox" aria-label="Country and calling code" className="auth-country-options">
            {matches.map(c=><button type="button" role="option" aria-selected={c.code===country.code} key={c.code}
              onClick={()=>{onCountryChange(c.code);setOpen(false);setSearch('');numberRef.current?.focus()}}>{c.label} <span>{c.dial}</span></button>)}
            {!matches.length&&<p>No matching countries</p>}
          </div>
        </div>}
      </div>
      <input ref={numberRef} type="tel" inputMode="tel" aria-label="Phone number" aria-required="true" aria-invalid={error?true:undefined}
        className="phone-field-number" placeholder="917 123 4567" autoComplete="tel-national"
        value={localNumber} onChange={e=>onLocalNumberChange(e.target.value)}/>
    </div>
    {error&&<small className="field-error" role="alert">{error}</small>}
    <small>Choose a country, then enter the phone number. Used for clinic contact only.</small>
  </div>
}

export function PatientRegister({ onRegister, onCancel }) {
  const [form,setForm]=useState(emptyForm)
  const [phoneLocal,setPhoneLocal]=useState('')
  const [countryCode,setCountryCode]=useState(DEFAULT_COUNTRY.code)
  const [errors,setErrors]=useState({})
  const [formError,setFormError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const update=(key,value)=>{
    setForm(f=>({...f,[key]:value}))
    setErrors(e=>(e[key]?{...e,[key]:undefined}:e))
    setFormError('')
  }
  const updatePhone=value=>{setPhoneLocal(value);setErrors(e=>(e.phone?{...e,phone:undefined}:e));setFormError('')}
  const updateCountry=value=>{if(value!==countryCode){setCountryCode(value);setPhoneLocal('')};setErrors(e=>(e.phone?{...e,phone:undefined}:e));setFormError('')}

  const submit=async event=>{
    event.preventDefault()
    if(submitting)return
    const phone=normalizePhoneNumber(countryCode,phoneLocal)
    if(!phone.ok){setErrors(e=>({...e,phone:phone.reason}));return}
    setSubmitting(true)
    setErrors({})
    setFormError('')
    const result=await onRegister({...form,phone:phone.e164})
    setSubmitting(false)
    if(result?.ok)return
    if(result?.kind==='validation'){
      const fieldErrors=Object.fromEntries(Object.entries(result.errors||{}).map(([key,messages])=>[key,messages?.[0]]))
      setErrors(fieldErrors)
      if(!Object.keys(fieldErrors).length)setFormError(result.message||'Enter valid registration details.')
      return
    }
    setFormError(result?.message||'Something went wrong. Try again.')
  }

  const maxDob=clinicDate()
  return <AuthShell wide><div className="auth-form auth-register" aria-labelledby="register-title">
      <div className="login-copy-wrap">
        <div className="eyebrow">New patient</div>
        <h1 id="register-title">Create your patient account</h1>
        <p className="login-copy">Your details help the clinic keep your visits and account connected.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <SectionLabel>Personal information</SectionLabel>
        <div className="form-grid">
          <Field label="First name" required error={errors.first_name}><input value={form.first_name} onChange={e=>update('first_name',e.target.value)} autoComplete="given-name"/></Field>
          <Field label="Last name" required error={errors.last_name}><input value={form.last_name} onChange={e=>update('last_name',e.target.value)} autoComplete="family-name"/></Field>
          <Field label="Date of birth" required error={errors.date_of_birth}><input type="date" required max={maxDob} value={form.date_of_birth} onChange={e=>update('date_of_birth',e.target.value)} autoComplete="bday"/></Field>
        </div>
        <SectionLabel>Contact information</SectionLabel>
        <div className="form-grid">
          <div className="span-2"><Field label="Email" required hint="We'll send your verification code to this email address." error={errors.email}><input type="email" value={form.email} onChange={e=>update('email',e.target.value)} autoComplete="email"/></Field></div>
          <div className="span-2"><PhoneField countryCode={countryCode} localNumber={phoneLocal} onCountryChange={updateCountry} onLocalNumberChange={updatePhone} error={errors.phone}/></div>
        </div>
        <SectionLabel>Account security</SectionLabel>
        <div className="form-grid">
          <PasswordField label="Password" value={form.password} onChange={e=>update('password',e.target.value)} autoComplete="new-password" error={errors.password}/>
          <PasswordField label="Confirm password" value={form.password_confirmation} onChange={e=>update('password_confirmation',e.target.value)} autoComplete="new-password" error={errors.password_confirmation}/>
        </div>
        {formError&&<Notice tone="warning" title="Couldn’t create your account">{formError}</Notice>}
        <div className="row-actions top-gap">
          <Button type="submit" icon="arrow" disabled={submitting}>{submitting?'Creating account…':'Create account'}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Back to sign in</Button>
        </div>
      </form>
  </div></AuthShell>
}
