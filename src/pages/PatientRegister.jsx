import React, { useState } from 'react'
import { Brand } from '../layout.jsx'
import { Button, Field, Notice, SectionLabel } from '../components.jsx'
import { COUNTRY_CODES, DEFAULT_COUNTRY, normalizePhoneNumber } from '../phone.js'

// Patient self-registration (M1/M4, Backend Foundation 1B). Submits to the real Laravel backend
// (`POST /api/register` via the `onRegister` prop — see App.jsx/api-client.js), which creates a real
// Person+Patient+User in PostgreSQL inside one transaction and auto-authenticates the new session. There is no
// local "account created, now sign in" step here: once `onRegister` resolves ok, App.jsx's own session state
// flips to authenticated and this screen simply unmounts in favor of first-use Home.
//
// No "Preferred branch" field: the current backend registration contract collects no branch preference (see
// backend/README.md) — the frontend identity bridge defaults it locally, and this form does not invent one.
// The identity form intentionally collects first and last name only.
const emptyForm={first_name:'',last_name:'',email:'',date_of_birth:'',password:'',password_confirmation:''}

function PhoneField({ dial, localNumber, onLocalNumberChange, error }) {
  const country=COUNTRY_CODES.find(c=>c.dial===dial)||DEFAULT_COUNTRY
  return <Field label="Mobile number" required error={error}>
    <div className="phone-field">
      <select aria-label="Country code" className="phone-field-code" value={dial} onChange={()=>{}}>
        {COUNTRY_CODES.map(c=><option key={c.dial} value={c.dial}>{c.dial} {c.label}</option>)}
      </select>
      <input type="tel" inputMode="numeric" aria-label="Mobile number" maxLength={country.digits}
        placeholder={'9'.repeat(country.digits)} className="phone-field-number"
        value={localNumber} onChange={e=>onLocalNumberChange(e.target.value.replace(/\D/g,'').slice(0,country.digits))}/>
    </div>
  </Field>
}

export function PatientRegister({ onRegister, onCancel }) {
  const [form,setForm]=useState(emptyForm)
  const [phoneLocal,setPhoneLocal]=useState('')
  const [errors,setErrors]=useState({})
  const [formError,setFormError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [showPassword,setShowPassword]=useState(false)
  const update=(key,value)=>{
    setForm(f=>({...f,[key]:value}))
    setErrors(e=>(e[key]?{...e,[key]:undefined}:e))
    setFormError('')
  }
  const updatePhone=value=>{setPhoneLocal(value);setErrors(e=>(e.phone?{...e,phone:undefined}:e));setFormError('')}

  const submit=async event=>{
    event.preventDefault()
    if(submitting)return
    const phone=normalizePhoneNumber(DEFAULT_COUNTRY.dial,phoneLocal)
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

  return <main className="register-shell">
    <section className="register-panel" aria-labelledby="register-title">
      <Brand className="brand-login"/>
      <div className="login-copy-wrap">
        <div className="eyebrow">New patient</div>
        <h1 id="register-title">Create your patient account</h1>
        <p className="login-copy">This creates your Person and Patient record and the account you’ll sign in with, linked by the same identity.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <SectionLabel>Patient information</SectionLabel>
        <div className="form-grid">
          <Field label="First name" required error={errors.first_name}><input value={form.first_name} onChange={e=>update('first_name',e.target.value)} autoComplete="given-name"/></Field>
          <Field label="Last name" required error={errors.last_name}><input value={form.last_name} onChange={e=>update('last_name',e.target.value)} autoComplete="family-name"/></Field>
          <PhoneField dial={DEFAULT_COUNTRY.dial} localNumber={phoneLocal} onLocalNumberChange={updatePhone} error={errors.phone}/>
          <Field label="Date of birth" hint="Optional." error={errors.date_of_birth}><input type="date" value={form.date_of_birth} onChange={e=>update('date_of_birth',e.target.value)} autoComplete="bday"/></Field>
        </div>
        <SectionLabel>Account security</SectionLabel>
        <div className="form-grid">
          <div className="span-2"><Field label="Email" required hint="You’ll sign in with this." error={errors.email}><input type="email" value={form.email} onChange={e=>update('email',e.target.value)} autoComplete="email"/></Field></div>
          <Field label="Password" required error={errors.password}><input type={showPassword?'text':'password'} value={form.password} onChange={e=>update('password',e.target.value)} autoComplete="new-password"/></Field>
          <Field label="Confirm password" required error={errors.password_confirmation}><input type={showPassword?'text':'password'} value={form.password_confirmation} onChange={e=>update('password_confirmation',e.target.value)} autoComplete="new-password"/></Field>
        </div>
        <label className="show-password"><input type="checkbox" checked={showPassword} onChange={e=>setShowPassword(e.target.checked)}/> Show password</label>
        {formError&&<Notice tone="warning" title="Couldn’t create your account">{formError}</Notice>}
        <div className="row-actions top-gap">
          <Button type="submit" icon="arrow" disabled={submitting}>{submitting?'Creating account…':'Create account'}</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Back to sign in</Button>
        </div>
      </form>
    </section>
  </main>
}
