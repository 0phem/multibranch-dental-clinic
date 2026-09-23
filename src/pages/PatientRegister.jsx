import React, { useRef, useState } from 'react'
import { Brand } from '../layout.jsx'
import { Button, Field, Notice } from '../components.jsx'
import { uid } from '../logic.js'

// Patient self-registration (M1/M4). This is the current FRONTEND DEMO account flow: the created Person, Patient
// and User records live in this browser's local persisted state, not a server database. There is no password and
// no verification email — a future backend enforces those with a real database transaction and authentication.
const emptyForm={firstName:'',middleName:'',lastName:'',phone:'',email:'',dob:'',preferredBranchId:''}

export function PatientRegister({ store, onCancel, onSignIn }) {
  const { state, actions }=store
  const openBranches=state.branches.filter(b=>b.status==='Open')
  const [form,setForm]=useState({...emptyForm,preferredBranchId:openBranches[0]?.id||''})
  const [error,setError]=useState('')
  const [account,setAccount]=useState(null)
  const [signInError,setSignInError]=useState('')
  const command=useRef(uid('register'))
  const update=(key,value)=>{setForm(f=>({...f,[key]:value}));setError('')}

  const submit=event=>{
    event.preventDefault()
    const outcome=actions.registerPatient({...form},command.current)
    if(!outcome.ok){setError(outcome.message);return}
    command.current=uid('register')
    setAccount({email:form.email.trim().toLowerCase()})
  }
  const signIn=()=>{
    const outcome=onSignIn(account.email)
    if(!outcome.ok)setSignInError(outcome.message)
  }

  if(account)return <main className="register-shell">
    <section className="register-panel motion-in" aria-labelledby="register-done-title">
      <Brand className="brand-login"/>
      <div className="login-copy-wrap">
        <div className="eyebrow">Account created</div>
        <h1 id="register-done-title">You’re all set.</h1>
        <p className="login-copy">Your patient account was created in this browser’s demo workspace. Sign in with <b>{account.email}</b> to continue.</p>
      </div>
      {signInError&&<Notice tone="warning" title="Couldn’t sign in">{signInError}</Notice>}
      <Button className="login-button" icon="arrow" onClick={signIn}>Sign in as {account.email}</Button>
      <p className="prototype-disclaimer"><strong>Demo workspace</strong> This account lives in this browser’s local storage to demonstrate the Person/Patient/User relationship, not a server database. A production system would enforce this with a database transaction, password authentication and email verification.</p>
    </section>
  </main>

  return <main className="register-shell">
    <section className="register-panel" aria-labelledby="register-title">
      <Brand className="brand-login"/>
      <div className="login-copy-wrap">
        <div className="eyebrow">New patient</div>
        <h1 id="register-title">Create your patient account</h1>
        <p className="login-copy">This creates your Person and Patient record and the account you’ll sign in with, linked by the same identity. It is not production authentication: there is no password, and no verification email is sent.</p>
      </div>
      <form onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label="First name" required><input value={form.firstName} onChange={e=>update('firstName',e.target.value)} autoComplete="given-name"/></Field>
          <Field label="Middle name"><input value={form.middleName} onChange={e=>update('middleName',e.target.value)} autoComplete="additional-name"/></Field>
          <Field label="Last name" required><input value={form.lastName} onChange={e=>update('lastName',e.target.value)} autoComplete="family-name"/></Field>
          <Field label="Email" required hint="You’ll sign in with this."><input type="email" value={form.email} onChange={e=>update('email',e.target.value)} autoComplete="email"/></Field>
          <Field label="Contact number" required><input type="tel" value={form.phone} onChange={e=>update('phone',e.target.value)} autoComplete="tel"/></Field>
          <Field label="Date of birth" hint="Optional."><input type="date" value={form.dob} onChange={e=>update('dob',e.target.value)} autoComplete="bday"/></Field>
          <div className="span-2"><Field label="Preferred branch" required>
            {openBranches.length?<select value={form.preferredBranchId} onChange={e=>update('preferredBranchId',e.target.value)}>{openBranches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select>
              :<input value="No branch is currently open" disabled/>}
          </Field></div>
        </div>
        {error&&<Notice tone="warning" title="Couldn’t create your account">{error}</Notice>}
        <div className="row-actions top-gap">
          <Button type="submit" icon="arrow" disabled={!openBranches.length}>Create account</Button>
          <Button type="button" variant="ghost" onClick={onCancel}>Back to sign in</Button>
        </div>
      </form>
      <p className="prototype-disclaimer"><strong>Demo workspace</strong> Records are created in this browser’s local storage to demonstrate the approved Person/Patient/User relationship. No real password, verification or backend exists yet.</p>
    </section>
  </main>
}
