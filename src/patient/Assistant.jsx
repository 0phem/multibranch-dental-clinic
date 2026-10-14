import React, { useEffect, useRef, useState } from 'react'
import { Button, Icon } from '../components.jsx'
import { assistantInfo, streamAssistant } from '../api-client.js'
import { clinic } from '../clinic-config.js'

const MAX = 500, HISTORY = 6

/**
 * M7 Clinic Assistant (Patient only). The answer comes from the clinic server: AI mode streams from Anthropic through the server
 * (the key never reaches the browser); fallback mode answers from clinic data. The assistant never books, cancels or pays: its
 * actions are buttons that open the Patient's own screens. Nothing typed here is stored by the clinic server.
 */
export function AssistantLauncher({ onNavigate }) {
  const [open, setOpen] = useState(false)
  const launcher = useRef(null)
  const close = () => { setOpen(false); requestAnimationFrame(() => launcher.current?.focus()) }
  return <>
    {!open && <button ref={launcher} type="button" className="pp-ai-launch pp-press" aria-label="Open clinic help" onClick={() => setOpen(true)}>
      <img src={clinic.logo} alt="" width="28" height="28"/><span>Ask us</span>
    </button>}
    {open && <AssistantPanel onClose={close} onNavigate={(page, ctx) => { close(); onNavigate(page, ctx) }}/>}
  </>
}

function AssistantPanel({ onClose, onNavigate }) {
  const [info, setInfo] = useState(null)
  const [turns, setTurns] = useState([]) // {role: 'user'|'assistant', text, actions, streaming, outcome}
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const log = useRef(null), input = useRef(null), panel = useRef(null)
  useEffect(() => { assistantInfo().then(r => setInfo(r.ok ? r.data : { mode: 'unavailable', starters: [] })) }, [])
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' }) }, [turns])
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])

  const ask = async question => {
    const message = question.trim().slice(0, MAX)
    if (!message || busy) return
    const history = turns.filter(t => t.text && !t.streaming).slice(-HISTORY).map(t => ({ role: t.role, text: t.text.slice(0, MAX) }))
    setTurns(t => [...t, { role: 'user', text: message }, { role: 'assistant', text: '', streaming: true }])
    setText(''); setBusy(true); setError('')
    const update = patch => setTurns(t => t.map((x, i) => i === t.length - 1 ? { ...x, ...patch(x) } : x))
    const result = await streamAssistant(message, history, (event, data) => {
      if (event === 'delta') update(x => ({ text: x.text + (data.text || '') }))
      if (event === 'replace') update(() => ({ text: data.text || '' }))
    })
    setBusy(false)
    if (result.ok) update(() => ({ text: result.data.answer, actions: result.data.actions || [], suggestions: result.data.suggestions || [], streaming: false, outcome: result.data.outcome }))
    else { setTurns(t => t.slice(0, -1)); setError(result.code === 'assistant_daily_cap' ? 'You’ve reached today’s limit for the assistant. The front desk can still help.' : result.message || 'The assistant could not answer. Try again.') }
    requestAnimationFrame(() => input.current?.focus())
  }

  const act = a => {
    if (a.type === 'open_booking') onNavigate('book', { service: a.service || null, branch: a.branch || null })
    else if (a.type === 'open_billing') onNavigate('billing')
    else if (a.type === 'open_visits') onNavigate('visits')
    else if (a.type === 'contact_front_desk') onNavigate('messages', { compose: true, text: '' })
    else if (a.type === 'call_clinic' && a.phone) window.location.href = `tel:${a.phone}`
  }

  return <section ref={panel} className="pp-ai pp-pop" role="dialog" aria-modal="false" aria-labelledby="pp-ai-title">
    <header className="pp-ai-head">
      <img src={clinic.logo} alt="" width="34" height="34" className="pp-ai-avatar"/>
      <div><h2 id="pp-ai-title">Clinic help</h2><p>{info?.mode === 'ai' ? 'AI assistant' : info?.mode === 'knowledge' ? 'Automated assistant' : 'Connecting…'}</p></div>
      <button type="button" className="pp-icon-btn" aria-label="Close clinic help" onClick={onClose}><Icon name="x" size={20}/></button>
    </header>
    <div className="pp-ai-log" ref={log} aria-live="polite">
      {!turns.length && <div className="pp-ai-welcome">
        <p>Hi! I can help with our services, branches and hours, open times, and your own appointments and balance. I can’t give medical advice.</p>
        <div className="pp-chips">{(info?.starters || []).map(s => <button key={s} type="button" className="pp-chip" onClick={() => ask(s)}>{s}</button>)}</div>
      </div>}
      {turns.map((t, i) => <div key={i} className={`pp-bubble ${t.role}`}>
        {t.role === 'assistant' && <img src={clinic.logo} alt="" width="24" height="24" className="pp-ai-avatar"/>}
        <div>
          {t.streaming && !t.text ? <span className="pp-typing" role="status" aria-label="The assistant is typing"><i/><i/><i/></span> : <p>{t.text}</p>}
          {!!t.actions?.length && <div className="pp-ai-actions">{t.actions.map((a, j) => <Button key={j} size="sm" variant={a.type === 'call_clinic' ? 'primary' : 'soft'} icon={a.type === 'call_clinic' ? 'phone' : a.type === 'open_billing' ? 'wallet' : a.type === 'open_booking' ? 'plusCalendar' : a.type === 'open_visits' ? 'calendar' : 'message'} onClick={() => act(a)}>{a.label}</Button>)}</div>}
          {!!t.suggestions?.length && i === turns.length - 1 && <div className="pp-chips pp-ai-suggest" aria-label="Suggested questions">{t.suggestions.map(q => <button key={q} type="button" className="pp-chip" onClick={() => ask(q)}>{q}</button>)}</div>}
        </div>
      </div>)}
      {error && <p className="pp-error-text" role="alert">{error}</p>}
    </div>
    <form className="pp-ai-form" onSubmit={e => { e.preventDefault(); ask(text) }}>
      <label className="sr-only" htmlFor="pp-ai-input">Your question</label>
      <input id="pp-ai-input" ref={input} value={text} maxLength={MAX} placeholder="Ask about visits, hours, billing…" onChange={e => setText(e.target.value)} disabled={info?.mode === 'unavailable'}/>
      <button type="submit" className="pp-icon-btn pp-send" aria-label="Send" disabled={busy || !text.trim()}><Icon name="arrow" size={18}/></button>
    </form>
    <p className="pp-ai-note">{info?.mode === 'ai' ? 'AI-generated answers can be wrong. Not medical advice. ' : 'Automated assistant. For anything not covered, '}<button type="button" className="link-button" onClick={() => act({ type: 'contact_front_desk' })}>{info?.mode === 'ai' ? 'Talk to the front desk' : 'talk to the front desk'}</button>. Don’t share passwords or card numbers.</p>
  </section>
}
