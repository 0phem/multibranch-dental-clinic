import React, { createContext, useEffect, useId, useRef } from 'react'
import { statusTone } from './logic.js'

const ICON_PATHS={
  home:<><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></>,
  plusCalendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></>,
  users:<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
  user:<><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></>,
  queue:<><path d="M4 6h16M4 12h11M4 18h7"/><circle cx="19" cy="17" r="3"/></>,
  activity:<><path d="M3 12h4l2.3-6 4.4 12 2.2-6H21"/></>,
  message:<><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></>,
  receipt:<><path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/></>,
  pill:<><path d="m10.5 5.5 8 8a4.24 4.24 0 0 1-6 6l-8-8a4.24 4.24 0 0 1 6-6Z"/><path d="m8 14 6-6"/></>,
  followup:<><path d="M20 11a8 8 0 1 1-2.34-5.66L20 7"/><path d="M20 3v4h-4"/><path d="M12 8v4l3 2"/></>,
  gift:<><rect x="3" y="8" width="18" height="13" rx="2"/><path d="M12 8v13M3 12h18M7.5 8C5 8 5 4.5 7 4.5c2.3 0 5 3.5 5 3.5s2.7-3.5 5-3.5c2 0 2 3.5-.5 3.5"/></>,
  checkin:<><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
  chart:<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></>,
  building:<><path d="M3 21h18M5 21V5l7-3 7 3v16"/><path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01M9 17h.01M15 17h.01"/></>,
  shield:<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
  settings:<><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.5 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.15.36.37.68.66.94.29.26.67.4 1.06.4H21v4h-.1a1.7 1.7 0 0 0-1.5.66Z"/></>,
  bell:<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>,
  search:<><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  chevron:<path d="m9 18 6-6-6-6"/>,
  arrow:<><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
  sparkles:<><path d="m12 3-1.2 3.5L7 8l3.8 1.5L12 13l1.2-3.5L17 8l-3.8-1.5Z"/><path d="m5 14-.7 2L2 17l2.3 1 .7 2 .7-2 2.3-1-2.3-1Z"/><path d="m19 14-.7 2-2.3 1 2.3 1 .7 2 .7-2 2.3-1-2.3-1Z"/></>,
  logout:<><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
  menu:<><path d="M4 6h16M4 12h16M4 18h16"/></>,
  x:<><path d="M6 6l12 12M18 6 6 18"/></>,
  tooth:<><path d="M12 3c-2.2 0-3.7-1.2-5.5-.8C3.6 2.9 2.5 6 3.3 9.2c.8 3.2 1.9 4.1 2.3 7.7.3 2.5 1.1 4.1 2.3 4.1 1.6 0 1.8-4.9 4.1-4.9s2.5 4.9 4.1 4.9c1.2 0 2-1.6 2.3-4.1.4-3.6 1.5-4.5 2.3-7.7C21.5 6 20.4 2.9 17.5 2.2 15.7 1.8 14.2 3 12 3Z"/></>,
  robot:<><rect x="4" y="7" width="16" height="12" rx="3"/><path d="M9 11h.01M15 11h.01M8 15h8M12 3v4M9 3h6"/></>,
  file:<><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h6"/></>,
  wallet:<><path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4Z"/></>,
}

export function Icon({name,size=20,className=''}){
  return <svg className={`icon ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON_PATHS[name]||ICON_PATHS.home}</svg>
}

export function ModuleBadge({ no, enhancement=false }) {
  return <span className="module-badge">M{no}{enhancement?' • Approved enhancement':''}</span>
}

export function Status({ children }) {
  const label=String(children)
  const tone=label==='Escalated'?'attention':label==='Validated locally'?'info':statusTone(label)
  return <span className={`status ${tone}`}><i aria-hidden="true"/>{children}</span>
}

export function Card({ title, subtitle, actions, children, className='' }) {
  return <section className={`card ${className}`}>
    {(title||subtitle||actions) && <div className="card-head">
      <div>{title&&<h2>{title}</h2>}{subtitle&&<p>{subtitle}</p>}</div>
      {actions&&<div className="card-actions">{actions}</div>}
    </div>}
    {children}
  </section>
}

export function StatCard({ label, value, hint, tone='teal', icon }) {
  return <div className={`stat-card ${tone}`}>
    <div className="stat-top"><span className="stat-label">{label}</span><span className="stat-icon">{icon||<Icon name="activity" size={18}/>}</span></div>
    <div className="stat-value">{value}</div>
    {hint&&<div className="stat-hint">{hint}</div>}
  </div>
}

export function PageHeader({ title, text, modules=[], aside, kicker }) {
  return <div className="page-header">
    <div className="page-title-block">{kicker&&<span className="page-kicker">{kicker}</span>}<h1>{title}</h1>{text&&<p>{text}</p>}</div>
    <div className="page-header-right">{aside}</div>
  </div>
}

// width: 'content' (default) sizes to its label; 'full' spans its container — reserved for a single-column
// mobile form/step action where the button genuinely is the row, not a default for every Button.
export function Button({ children, variant='primary', size='md', width='content', className='', icon, type='button', ...props }) {
  return <button type={type} className={`btn ${variant} ${size} ${width==='full'?'btn-full':''} ${className}`.trim()} {...props}>{icon&&<Icon name={icon} size={size==='sm'?15:17}/>}<span>{children}</span></button>
}

export function Field({ label, children, hint, required=false, error }) {
  const id=useId(), hintId=`${id}-hint`, errorId=`${id}-error`
  const control=React.Children.map(children,child=>{
    if(!React.isValidElement(child)||!['input','select','textarea'].includes(child.type))return child
    return React.cloneElement(child,{
      id:child.props.id||id,
      'aria-required':required||undefined,
      'aria-invalid':error?true:child.props['aria-invalid'],
      'aria-describedby':[child.props['aria-describedby'],hint&&hintId,error&&errorId].filter(Boolean).join(' ')||undefined,
    })
  })
  return <label className={`field ${error?'has-error':''}`}><span>{label}{required&&<b className="required" aria-hidden="true">*</b>}</span>{control}{hint&&<small id={hintId}>{hint}</small>}{error&&<small id={errorId} className="field-error" role="alert">{error}</small>}</label>
}

export function Table({ columns, rows, keyField='id', empty='No records found.', caption='Records' }) {
  if (!rows?.length) return <Empty text={empty}/>
  return <div className="table-wrap"><table role="table">
    <caption className="sr-only">{caption}</caption>
    <thead role="rowgroup"><tr role="row">{columns.map(c=><th scope="col" role="columnheader" key={c.key}>{c.label}</th>)}</tr></thead>
    <tbody role="rowgroup">{rows.map(row=><tr role="row" key={row[keyField]}>{columns.map(c=><td role="cell" key={c.key}><span className="mobile-cell-label" aria-hidden="true">{c.label}</span><div className="cell-value">{c.render?c.render(row):row[c.key]}</div></td>)}</tr>)}</tbody>
  </table></div>
}

export function Empty({ text='No records found.', title='Nothing here yet' }) {
  return <div className="empty-state"><div className="empty-icon"><Icon name="sparkles" size={21}/></div><b>{title}</b><span>{text}</span></div>
}

export function Notice({ tone='info', title, children }) {
  return <div className={`notice ${tone}`} role={tone==='danger'||tone==='error'?'alert':'status'}><div className="notice-icon"><Icon name={tone==='warning'?'activity':tone==='success'?'shield':'sparkles'} size={17}/></div><div>{title&&<b>{title}</b>}<span>{children}</span></div></div>
}

export function Tabs({ tabs, active, onChange }) {
  return <div className="tabs" role="group" aria-label="Views">{tabs.map(t=><button key={t.key} type="button" aria-pressed={active===t.key} className={active===t.key?'active':''} onClick={()=>onChange(t.key)}>{t.label}{t.count!=null&&<span>{t.count}</span>}</button>)}</div>
}

export function Progress({ value=0, label, threshold=100 }) {
  const capped=Math.max(0,Math.min(100,value))
  return <div className="progress-block">
    {label&&<div className="progress-label"><span>{label}</span><b>{value}%</b></div>}
    <div className="progress-track"><span className={value>=threshold?'danger':''} style={{width:`${capped}%`}}/></div>
  </div>
}

export function Modal({ open, title, subtitle, onClose, children, wide=false, className='' }) {
  const ref=useRef(null), closeRef=useRef(onClose), titleId=useId(), subtitleId=useId()
  closeRef.current=onClose
  useEffect(()=>{
    if(!open||!ref.current)return
    const dialog=ref.current, previous=document.activeElement, overflow=document.body.style.overflow
    dialog.showModal()
    document.body.style.overflow='hidden'
    return ()=>{
      dialog.close()
      document.body.style.overflow=overflow
      if(previous?.isConnected)previous.focus({preventScroll:true})
    }
  },[open])
  if (!open) return null
  return <dialog ref={ref} className={`modal ${wide?'wide':''} ${className}`} aria-labelledby={titleId} aria-describedby={subtitle?subtitleId:undefined} onCancel={e=>{e.preventDefault();closeRef.current?.()}} onClick={e=>{
    const r=e.currentTarget.getBoundingClientRect()
    if(e.target===e.currentTarget&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))closeRef.current?.()
  }}>
    <div className="modal-head"><div><h2 id={titleId}>{title}</h2>{subtitle&&<p id={subtitleId}>{subtitle}</p>}</div><button type="button" className="icon-btn" aria-label={`Close ${title}`} onClick={onClose}><Icon name="x" size={19}/></button></div>
    <div className="modal-body">{children}</div>
  </dialog>
}

// Lets a page open shell-owned overlays (for example Notifications) without owning their state.
export const ShellActionsContext=createContext({openNotifications:null})

// Accessible replacement for native window.confirm: names the consequence and starts on the safe action.
export function ConfirmDialog({ open, title, children, confirmLabel='Confirm', cancelLabel='Cancel', onConfirm, onCancel, tone='danger' }) {
  const actions=useRef(null)
  useEffect(()=>{if(open)actions.current?.querySelector('button')?.focus()},[open])
  return <Modal open={open} title={title} onClose={onCancel}>
    <div className="confirm-body">{children}</div>
    <div className="row-actions confirm-actions" ref={actions}><Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button><Button variant={tone==='danger'?'danger':'primary'} onClick={onConfirm}>{confirmLabel}</Button></div>
  </Modal>
}

export function Timeline({ items=[] }) {
  return <div className="timeline">{items.map((i,idx)=><div className="timeline-item" key={i.id||idx}><span className="timeline-dot"/><div><b>{i.title||i.action||i.type}</b><p>{i.detail||i.text||''}</p><small>{i.at||i.createdAt||''}</small></div></div>)}</div>
}

export function MetricRow({ label, value, note, tone }) {
  return <div className="metric-row"><div><span>{label}</span>{note&&<small>{note}</small>}</div><b className={tone||''}>{value}</b></div>
}

export function SectionLabel({ children }) { return <div className="section-label">{children}</div> }

export function SplitBadge({ left, right, tone='neutral' }) {
  return <span className={`split-badge ${tone}`}><b>{left}</b><span>{right}</span></span>
}
