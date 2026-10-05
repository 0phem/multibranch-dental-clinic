import React from 'react'
import { Button, Icon } from './components.jsx'
import { ask, MAX_MESSAGE } from './assistant-api.js'

// M7 Patient Clinic Assistant panel.
//   server session  -> every answer comes from the clinic server (approved knowledge + safety checks). Chat text lives only in
//                      React memory: nothing is stored in the browser or sent anywhere except the server message endpoint.
//   no server session (offline demo only) -> three fixed, rule-based navigation answers, labelled as a demo preview.
// The assistant cannot act: it never books, cancels, pays or notifies, and it never shows a diagnosis or a price.
const QUICK = ['How do I book?', 'What do I need for HMO?', 'How does the queue work?']
const DEMO = {
  'How do I book?': 'Open Book, choose Smart Find or Manual booking, then pick any validated available slot. A Dentist is assigned automatically.',
  'What do I need for HMO?': 'Your HMO case lists missing requirements. You can record document metadata; clinic staff checks local requirements. This app does not upload files or contact the provider.',
  'How does the queue work?': 'After Staff records your arrival, your Home shows your position and an estimated wait from this workspace’s current data.',
}
const OUTCOME_LABEL = { refused_clinical: 'Not something I can help with', refused_action: 'I can’t take actions', refused_extraction: 'Out of scope', pricing_not_quoted: 'Prices come from the clinic', unconfirmed_fact: 'Needs clinic confirmation', no_knowledge: 'No confirmed information', output_blocked: 'No safe answer' }

export function ClinicAssistant({ open, onOpenChange, server = false, onContact }) {
  const panel = React.useRef(null)
  const [draft, setDraft] = React.useState('')
  const [turns, setTurns] = React.useState([])          // [{ q, a?:{...}, error?:{...}, pending?:true }]
  const [demoAnswer, setDemoAnswer] = React.useState('')
  const busy = turns.some(t => t.pending)
  React.useEffect(() => { if (open) panel.current?.focus() }, [open])
  const closeToTrigger = () => { onOpenChange(false); document.getElementById('clinic-assistant-fab')?.focus() }

  const send = async (text, replaceIndex = null) => {
    const question = String(text ?? '').trim()
    if (!question || busy) return
    const index = replaceIndex ?? turns.length
    setTurns(previous => (replaceIndex === null ? [...previous, { q: question, pending: true }] : previous.map((t, i) => (i === replaceIndex ? { q: question, pending: true } : t))))
    setDraft('')
    const result = await ask(question)
    setTurns(previous => previous.map((t, i) => (i === index ? (result.ok ? { q: question, a: result } : { q: question, error: result }) : t)))
  }

  return <>
    <button id="clinic-assistant-fab" type="button" className="assistant-fab is-patient" onClick={() => onOpenChange(!open)} aria-expanded={open} aria-controls="clinic-assistant-panel" aria-label={open ? 'Close clinic help' : 'Open clinic help'}>
      <img src="/images/logo.png" alt="" width="26" height="26"/>
    </button>
    {open && <div className="assistant-panel is-sheet" id="clinic-assistant-panel" ref={panel} tabIndex={-1} role="region" aria-label="Clinic Assistant" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); closeToTrigger() } }}>
      <div className="assistant-head"><div className="assistant-avatar"><Icon name="robot" size={19}/></div><div><b>Clinic Assistant</b><small>{server ? 'Clinic navigation & workflow help' : 'Offline demo preview — not the clinic assistant'}</small></div><button className="icon-btn" aria-label="Close clinic help" onClick={closeToTrigger}><Icon name="x" size={16}/></button></div>
      <div className="assistant-body">
        <div className="assistant-bubble">Hi! I can help you find your way around the clinic system. I can’t diagnose, advise on medicines or treatment, quote prices, or take any action for you.</div>
        {!server && demoAnswer && <div className="assistant-bubble answer">{demoAnswer}</div>}
        {server && turns.map((turn, index) => <React.Fragment key={index}>
          <div className="assistant-bubble" style={{ marginLeft: 'auto', background: 'var(--surface-2, #eef3f7)' }}><span className="sr-only">You asked: </span>{turn.q}</div>
          {turn.pending && <div className="assistant-bubble answer" role="status" aria-live="polite">Looking that up…</div>}
          {turn.a && <div className="assistant-bubble answer" role="status">
            {turn.a.outcome !== 'answered' && <b style={{ display: 'block' }}>{OUTCOME_LABEL[turn.a.outcome] || 'Note'}</b>}
            {turn.a.answer}
            {turn.a.handoff && <div style={{ marginTop: 8 }}><small>The assistant has not contacted anyone for you. To reach the clinic, send a message yourself.</small>{onContact && <div><Button size="sm" variant="soft" onClick={() => { onContact(); onOpenChange(false) }}>Open Messages</Button></div>}</div>}
          </div>}
          {turn.error && <div className="assistant-bubble answer" role="alert">
            <b style={{ display: 'block' }}>{turn.error.kind === 'rate_limited' ? 'Please wait a moment' : 'The assistant couldn’t answer'}</b>
            {turn.error.message}{turn.error.kind === 'rate_limited' && turn.error.retryAfter ? ` Try again in about ${turn.error.retryAfter} seconds.` : ''}
            {turn.error.kind !== 'validation' && <div style={{ marginTop: 8 }}><Button size="sm" variant="soft" disabled={busy} onClick={() => send(turn.q, index)}>Try again</Button></div>}
          </div>}
        </React.Fragment>)}
        <div className="assistant-quick">{QUICK.map(q => <button key={q} disabled={busy} onClick={() => (server ? send(q) : setDemoAnswer(DEMO[q]))}>{q}</button>)}</div>
        {server && <form onSubmit={event => { event.preventDefault(); send(draft) }} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <label className="sr-only" htmlFor="assistant-input">Your question</label>
          <input id="assistant-input" value={draft} maxLength={MAX_MESSAGE} autoComplete="off" placeholder="Ask about using the clinic system" onChange={event => setDraft(event.target.value)} style={{ flex: 1, minWidth: 0 }}/>
          <Button type="submit" size="sm" disabled={busy || draft.trim().length < 2}>{busy ? 'Sending…' : 'Send'}</Button>
        </form>}
      </div>
    </div>}
  </>
}
