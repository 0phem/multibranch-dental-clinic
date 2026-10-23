import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../components.jsx'

/** Loads server data: {status: 'loading'|'ready'|'error', data, error, reload}. Never fabricates a result. */
export function useLoad(load, deps = []) {
  const [state, setState] = useState({ status: 'loading', data: null, error: '' })
  const seq = useRef(0)
  const run = useCallback(async ({ quiet = false } = {}) => {
    const id = ++seq.current
    if (!quiet) setState(s => ({ ...s, status: s.data ? s.status : 'loading', error: '' }))
    const result = await load()
    if (id !== seq.current) return
    setState(result?.ok ? { status: 'ready', data: result.data, error: '', meta: result.meta } : { status: 'error', data: null, error: result?.message || 'This could not be loaded.' })
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

export function Skeleton({ lines = 3, card = true, label = 'Loading' }) {
  return <div className={`pp-skeleton ${card ? 'pp-card' : ''}`} role="status" aria-label={label}>
    {Array.from({ length: lines }, (_, i) => <span key={i} className="pp-shimmer" style={{ width: `${[72, 92, 56, 84, 64][i % 5]}%` }}/>)}
  </div>
}

export function EmptyState({ icon = 'sparkles', title, text, children }) {
  return <div className="pp-empty pp-card pp-fade">
    <span className="pp-empty-icon" aria-hidden="true"><Icon name={icon} size={26}/></span>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {children && <div className="pp-empty-actions">{children}</div>}
  </div>
}

export function ErrorState({ text, onRetry }) {
  return <div className="pp-error pp-card pp-fade" role="alert">
    <Icon name="alert" size={20}/>
    <div><b>Something went wrong</b><p>{text || 'This could not be loaded.'}</p></div>
    {onRetry && <Button size="sm" variant="soft" onClick={() => onRetry()}>Try again</Button>}
  </div>
}

export function PageHead({ eyebrow, title, text, actions }) {
  return <header className="pp-head pp-head-compact pp-fade">
    <div className="pp-head-title">{eyebrow && <p className="pp-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{text && <p className="pp-lead sr-only">{text}</p>}</div>
    {actions && <div className="pp-head-actions">{actions}</div>}
  </header>
}

const TONES = { Confirmed: 'ok', Completed: 'ok', Paid: 'ok', Pending: 'wait', Issued: 'due', Cancelled: 'off', 'No-show': 'off' }
export function Pill({ children, tone }) {
  return <span className={`pp-pill ${tone || TONES[children] || 'info'}`}>{children === 'Issued' ? 'Payment due' : children}</span>
}
