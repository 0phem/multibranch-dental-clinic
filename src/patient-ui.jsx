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
// `icon` reuses the existing Icon set — never a new asset, never emoji mixed in with product icons. An
// option's optional `descriptionLabel` (a small micro-label, e.g. "Estimated time") renders above
// `description`; an optional `meta` line (e.g. a category, or a payment-safety note) renders smaller and
// more secondary still — both additive, undefined for every option that doesn't supply them.
export function ChoiceGroup({ legend, hint, name, value, onChange, options, variant='cards', disabled=false, describedBy }) {
  return <fieldset className={`pt-choices ${variant==='slots'?'pt-slots':''}`.trim()} aria-describedby={describedBy}>
    <legend>{legend}</legend>
    {hint&&<p className="pt-hint">{hint}</p>}
    <div className="pt-choice-grid">{options.map(option=><label className={`pt-choice ${value===option.value?'is-selected':''}`.trim()} key={option.value}>
      <input type="radio" name={name} value={option.value} checked={value===option.value} disabled={disabled||option.disabled} onChange={()=>onChange(option.value)}/>
      {option.icon&&<span className="pt-choice-icon" aria-hidden="true"><Icon name={option.icon} size={20}/></span>}
      <span className="pt-choice-body">
        <b>{option.label}</b>
        {option.descriptionLabel&&<em className="pt-choice-desc-label">{option.descriptionLabel}</em>}
        {option.description&&<small>{option.description}</small>}
        {option.meta&&<small className="pt-choice-meta">{option.meta}</small>}
      </span>
      <span className="pt-choice-check" aria-hidden="true"><Icon name="checkin" size={16}/></span>
    </label>)}</div>
  </fieldset>
}

// A compact, keyboard-accessible date radiogroup for the Smart Find availability explorer (Pass 2). Not
// built on native radio inputs like ChoiceGroup — this needs an explicit ARIA roving-tabindex radiogroup
// so Left/Right/Home/End can skip disabled (no-opening) dates, which native radio-group arrow behavior
// cannot do. Renders only a supplied view model (`days`); computes no dates itself. Returns null when
// nothing is selectable — an inert radiogroup with no real choice is worse than the caller's own honest
// empty state.
export function DateStrip({ legend='Choose a date', days, value, onChange }) {
  const refs=useRef({})
  const selectable=days.filter(day=>day.hasOpenings)
  if(!selectable.length)return null
  const focusable=value&&selectable.some(day=>day.date===value)?value:selectable[0].date
  const focus=date=>{
    const node=refs.current[date]
    node?.focus()
    node?.scrollIntoView?.({block:'nearest',inline:'nearest'})
  }
  const selectAndFocus=date=>{onChange(date);focus(date)}
  const moveTo=(fromIndex,direction)=>{
    let i=fromIndex
    do{i+=direction}while(days[i]&&!days[i].hasOpenings)
    if(days[i]&&days[i].hasOpenings)selectAndFocus(days[i].date)
  }
  const onKeyDown=(event,index)=>{
    if(event.key==='ArrowRight'){event.preventDefault();moveTo(index,1)}
    else if(event.key==='ArrowLeft'){event.preventDefault();moveTo(index,-1)}
    else if(event.key==='Home'){event.preventDefault();selectAndFocus(selectable[0].date)}
    else if(event.key==='End'){event.preventDefault();selectAndFocus(selectable[selectable.length-1].date)}
    else if(event.key===' '||event.key==='Enter'){if(days[index].hasOpenings){event.preventDefault();selectAndFocus(days[index].date)}}
  }
  return <div className="pt-date-strip" role="radiogroup" aria-label={legend}>
    {days.map((day,index)=><button key={day.date} type="button"
      ref={el=>{refs.current[day.date]=el}}
      role="radio" aria-checked={value===day.date}
      aria-label={day.hasOpenings?undefined:`${day.fullLabel||day.date}, no openings`}
      disabled={!day.hasOpenings}
      tabIndex={day.date===focusable?0:-1}
      className={`pt-date-chip ${value===day.date?'is-selected':''}`.trim()}
      onClick={()=>day.hasOpenings&&selectAndFocus(day.date)}
      onKeyDown={event=>onKeyDown(event,index)}
    >{['Today','Tomorrow'].includes(day.dayLabel)&&<span className="pt-date-chip-context">{day.dayLabel}</span>}<span className="pt-date-chip-day">{new Date(`${day.date}T12:00:00`).toLocaleDateString('en-PH',{weekday:'short'})}</span><span className="pt-date-chip-number">{day.dayNumber||day.date.slice(-2)}</span></button>)}
  </div>
}

export function TimeSlotGroup({ legend, slots, value, onPick }) {
  if(!slots.length)return null
  return <section className="pt-time-period" aria-label={`${legend} appointment times`}>
    <h3>{legend}</h3>
    <div className="pt-time-grid">{slots.map(slot=><button type="button" key={slot.value}
      className={`pt-time-slot ${value===slot.value?'is-selected':''}`.trim()}
      aria-pressed={value===slot.value} disabled={slot.disabled}
      onClick={()=>onPick(slot.value)}>{slot.label}</button>)}</div>
  </section>
}

export function Stepper({ steps, current, reached, onSelect, label='Steps' }) {
  return <nav aria-label={label}><ol className="pt-stepper">{steps.map((step,index)=>{
    const state=index===current?'current':index<=reached?'done':'todo', canSelect=index!==current&&index<=reached
    const body=<><span className="pt-step-mark" aria-hidden="true">{index<current?'✓':index+1}</span><span className="pt-step-name">{step}</span><span className="sr-only">{`, step ${index+1} of ${steps.length}`}</span></>
    return <li key={step} className={`pt-step ${state}`} aria-current={index===current?'step':undefined}>{canSelect?<button type="button" onClick={()=>onSelect(index)}>{body}</button>:<div>{body}</div>}</li>
  })}</ol></nav>
}
