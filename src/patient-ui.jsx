import React, { useEffect, useRef } from 'react'
import { Icon, Status } from './components.jsx'

// Patient presentation components. They render supplied view models only and never touch application state.

export function DefinitionList({ items, className='' }) {
  const rows=items.filter(item=>item&&item.value!=null&&item.value!=='')
  if(!rows.length)return null
  return <dl className={`pt-dl ${className}`.trim()}>{rows.map(item=><div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
}

// One record (appointment, invoice, prescription, follow-up, HMO case, visit). A deep-linked record is focused.
export function RecordCard({ id, title, subtitle, status, children, actions, highlight=false, level=3 }) {
  const ref=useRef(null), Heading=`h${level}`
  useEffect(()=>{
    if(!highlight||!ref.current)return
    ref.current.scrollIntoView?.({block:'nearest'})
    ref.current.focus({preventScroll:true})
  },[highlight])
  return <article ref={ref} id={id} tabIndex={highlight?-1:undefined} className={`pt-record ${highlight?'is-target':''}`.trim()} aria-labelledby={id?`${id}-title`:undefined}>
    <header><div><Heading id={id?`${id}-title`:undefined} className="pt-record-title">{title}</Heading>{subtitle&&<p className="pt-record-sub">{subtitle}</p>}</div>{status&&<Status>{status}</Status>}</header>
    {highlight&&<p className="pt-target-note"><span className="sr-only">Selected record: </span>Selected</p>}
    {children}
    {actions&&<div className="row-actions pt-record-actions">{actions}</div>}
  </article>
}

// Native radios: arrow keys, group semantics and form behavior come from the browser. An option's optional
// `icon` reuses the existing Icon set — never a new asset, never emoji mixed in with product icons.
export function ChoiceGroup({ legend, hint, name, value, onChange, options, variant='cards', disabled=false, describedBy }) {
  return <fieldset className={`pt-choices ${variant==='slots'?'pt-slots':''}`.trim()} aria-describedby={describedBy}>
    <legend>{legend}</legend>
    {hint&&<p className="pt-hint">{hint}</p>}
    <div className="pt-choice-grid">{options.map(option=><label className={`pt-choice ${value===option.value?'is-selected':''}`.trim()} key={option.value}>
      <input type="radio" name={name} value={option.value} checked={value===option.value} disabled={disabled||option.disabled} onChange={()=>onChange(option.value)}/>
      {option.icon&&<span className="pt-choice-icon" aria-hidden="true"><Icon name={option.icon} size={20}/></span>}
      <span className="pt-choice-body"><b>{option.label}</b>{option.description&&<small>{option.description}</small>}</span>
      <span className="pt-choice-check" aria-hidden="true"><Icon name="checkin" size={16}/></span>
    </label>)}</div>
  </fieldset>
}

export function Stepper({ steps, current, reached, onSelect, label='Steps' }) {
  return <nav aria-label={label}><ol className="pt-stepper">{steps.map((step,index)=>{
    const state=index===current?'current':index<=reached?'done':'todo', canSelect=index!==current&&index<=reached
    const body=<><span className="pt-step-mark" aria-hidden="true">{index<current?'✓':index+1}</span><span className="pt-step-name">{step}</span><span className="sr-only">{`, step ${index+1} of ${steps.length}`}</span></>
    return <li key={step} className={`pt-step ${state}`} aria-current={index===current?'step':undefined}>{canSelect?<button type="button" onClick={()=>onSelect(index)}>{body}</button>:<div>{body}</div>}</li>
  })}</ol></nav>
}
