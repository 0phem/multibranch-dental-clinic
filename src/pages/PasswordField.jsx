import React, { useId, useState } from 'react'

export function PasswordField({label,value,onChange,autoComplete,error}) {
  const [visible,setVisible]=useState(false)
  const id=useId(), errorId=`${id}-error`
  return <div className={`field auth-password-field ${error?'has-error':''}`}>
    <label htmlFor={id}>{label}<b className="required" aria-hidden="true">*</b></label>
    <div className="auth-password-control">
      <input id={id} type={visible?'text':'password'} autoComplete={autoComplete} value={value} onChange={onChange}
        aria-required="true" aria-invalid={error?true:undefined} aria-describedby={error?errorId:undefined}/>
      <button type="button" className="auth-password-toggle" aria-label={`${visible?'Hide':'Show'} ${label.toLowerCase()}`}
        aria-pressed={visible} onClick={()=>setVisible(!visible)}>{visible?'Hide':'Show'}</button>
    </div>
    {error&&<small id={errorId} className="field-error" role="alert">{error}</small>}
  </div>
}
