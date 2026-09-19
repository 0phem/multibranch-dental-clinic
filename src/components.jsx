import React from 'react'
import { statusTone } from './logic.js'

export function ModuleBadge({ no, pe=false }) {
  return <span className={`module-badge ${pe?'pe':''}`}>M{no}{pe?' • PE':''}</span>
}

export function Status({ children }) {
  return <span className={`status ${statusTone(String(children))}`}>{children}</span>
}

export function Card({ title, subtitle, actions, children, className='' }) {
  return <section className={`card ${className}`}>
    {(title||subtitle||actions) && <div className="card-head">
      <div>{title&&<h3>{title}</h3>}{subtitle&&<p>{subtitle}</p>}</div>
      {actions&&<div className="card-actions">{actions}</div>}
    </div>}
    {children}
  </section>
}

export function StatCard({ label, value, hint, tone='teal', icon }) {
  return <div className={`stat-card ${tone}`}>
    <div className="stat-top"><span className="stat-label">{label}</span>{icon&&<span className="stat-icon">{icon}</span>}</div>
    <div className="stat-value">{value}</div>
    {hint&&<div className="stat-hint">{hint}</div>}
  </div>
}

export function PageHeader({ title, text, modules=[], aside }) {
  return <div className="page-header">
    <div><h1>{title}</h1>{text&&<p>{text}</p>}</div>
    <div className="page-header-right">
      {aside}
      <div className="page-modules">{modules.map(n=><ModuleBadge key={n} no={n} pe={n>=24}/>)}</div>
    </div>
  </div>
}

export function Button({ children, variant='primary', size='md', className='', ...props }) {
  return <button className={`btn ${variant} ${size} ${className}`} {...props}>{children}</button>
}

export function Field({ label, children, hint, required=false }) {
  return <label className="field"><span>{label}{required&&<b className="required">*</b>}</span>{children}{hint&&<small>{hint}</small>}</label>
}

export function Table({ columns, rows, keyField='id', empty='No records found.' }) {
  if (!rows?.length) return <Empty text={empty}/>
  return <div className="table-wrap"><table>
    <thead><tr>{columns.map(c=><th key={c.key}>{c.label}</th>)}</tr></thead>
    <tbody>{rows.map(row=><tr key={row[keyField]}>{columns.map(c=><td key={c.key}>{c.render?c.render(row):row[c.key]}</td>)}</tr>)}</tbody>
  </table></div>
}

export function Empty({ text='No records found.', title='Nothing here yet' }) {
  return <div className="empty-state"><div className="empty-icon">○</div><b>{title}</b><span>{text}</span></div>
}

export function Notice({ tone='info', title, children }) {
  return <div className={`notice ${tone}`}>{title&&<b>{title}</b>}<span>{children}</span></div>
}

export function Tabs({ tabs, active, onChange }) {
  return <div className="tabs">{tabs.map(t=><button key={t.key} className={active===t.key?'active':''} onClick={()=>onChange(t.key)}>{t.label}{t.count!=null&&<span>{t.count}</span>}</button>)}</div>
}

export function Progress({ value=0, label, threshold=100 }) {
  const capped=Math.max(0,Math.min(100,value))
  return <div className="progress-block">
    {label&&<div className="progress-label"><span>{label}</span><b>{value}%</b></div>}
    <div className="progress-track"><span className={value>=threshold?'danger':''} style={{width:`${capped}%`}}/></div>
  </div>
}

export function Modal({ open, title, subtitle, onClose, children, wide=false }) {
  if (!open) return null
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose?.()}}>
    <div className={`modal ${wide?'wide':''}`}>
      <div className="modal-head"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="icon-btn" onClick={onClose}>×</button></div>
      <div className="modal-body">{children}</div>
    </div>
  </div>
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
