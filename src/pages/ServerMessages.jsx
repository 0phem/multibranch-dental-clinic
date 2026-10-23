import React, { useEffect, useReducer, useRef, useState } from 'react'
import { Button, ConfirmDialog, Empty, Field, Icon, Notice, PageHeader, Status } from '../components.jsx'
import { PageHead } from '../patient/ui.jsx'
import { commandKey } from '../appointments-api.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'
import { createDrafts } from '../message-drafts.js'
import { onRealtimeState, startRealtime, subscribe } from '../realtime.js'
import { addDentist, closeConversation, loadConversations, loadDentistOptions, loadMessages, loadNewerMessages, loadStartOptions, markRead, MAX_MESSAGE, sendMessage, startConversation } from '../messaging-api.js'

// M17 conversations for a clinic-server session (Patient, Staff, Dentist). Everything shown is server data; message text is rendered as
// plain text. In-app messages only: the screen never claims SMS/e-mail/social delivery, "seen" or "typing".
//  * Live updates come over private Reverb channels as signals; the screen then re-reads the server (`after=`), exactly what the polling
//    fallback does when the socket is down — the status chip says which mode is active.
//  * Every conversation keeps its OWN thread, draft, pending sends and retry key (message-drafts.js): nothing typed for one Patient can
//    end up in another conversation, and an async result is always written to the conversation it was requested for.
const POLL_MS = 10000
const SAFETY_POLL_MS = 60000
const time = iso => (iso ? iso.slice(11, 16) : '')
const day = iso => (iso ? iso.slice(0, 10) : '')

function LiveStatus({ state }) {
  const label = state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting…' : state === 'disabled' ? `Updates every ${POLL_MS / 1000} s` : `Reconnecting — checking every ${POLL_MS / 1000} s`
  return <span className={`chat-live is-${state}`} role="status" aria-live="polite"><span className="chat-live-dot" aria-hidden="true"/>{label}</span>
}

export function ServerMessagesPage({ store, role, initial = null }) {
  const { toast } = store
  const patient = role === 'patient'
  const staff = role === 'staff'
  const [list, setList] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [channels, setChannels] = useState([])
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [threads, setThreads] = useState({})   // id -> {messages (oldest first), older, error, loadingOlder}
  const [pending, setPending] = useState({})   // id -> [{key, text, status: 'sending'|'failed', message}]
  const [live, setLive] = useState('idle')
  // initial: {compose: true, text} opens the new-message form pre-filled (e.g. "correct my name"); {conversationId} opens a thread.
  const [composing, setComposing] = useState(!!initial?.compose)
  const drafts = useRef(createDrafts())
  const [, redraw] = useReducer(n => n + 1, 0)
  const threadsRef = useRef(threads)
  threadsRef.current = threads
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId
  const logRef = useRef(null)
  const selected = list?.find(c => c.id === selectedId) || null
  const thread = selectedId ? threads[selectedId] : null
  const [confirmClose, setConfirmClose] = useState(false)

  const refreshList = async () => {
    const result = await loadConversations()
    if (!result.ok) { if (!list) setError(result.message || 'Conversations could not be loaded.'); return }
    setError(''); setList(result.rows); setNextCursor(result.nextCursor)
    setChannels(previous => (previous.join() === result.channels.join() ? previous : result.channels))
  }
  useEffect(() => { refreshList().then(() => { if (initial?.conversationId) openThread(initial.conversationId) }) }, [])
  useEffect(() => onRealtimeState(setLive), [])
  useEffect(() => { startRealtime() }, [])

  const loadMore = async () => {
    const result = await loadConversations(nextCursor)
    if (!result.ok) return toast(result.message, 'warning')
    setList(previous => [...previous, ...result.rows.filter(r => !previous.some(p => p.id === r.id))]); setNextCursor(result.nextCursor)
  }

  const patchThread = (id, patch) => setThreads(previous => ({ ...previous, [id]: { ...(previous[id] || {}), ...patch(previous[id] || {}) } }))
  const appendMessages = (id, rows) => patchThread(id, t => {
    const known = new Set((t.messages || []).map(m => m.id))
    return { messages: [...(t.messages || []), ...rows.filter(m => !known.has(m.id))] }
  })

  const openThread = async id => {
    setSelectedId(id); setComposing(false)
    if (threadsRef.current[id]?.messages) return syncNewer(id)
    patchThread(id, () => ({ error: '' }))
    const result = await loadMessages(id)
    if (!result.ok) return patchThread(id, () => ({ error: result.message || 'Messages could not be loaded.' }))
    patchThread(id, () => ({ messages: [...result.rows].reverse(), older: result.nextCursor, error: '' }))
  }

  /** The one sync path: after a realtime signal and on every poll. */
  const syncNewer = async id => {
    const t = threadsRef.current[id]
    if (!t?.messages) return
    const last = t.messages[t.messages.length - 1]?.id
    const result = await loadNewerMessages(id, last)
    if (result.ok && result.rows.length) appendMessages(id, result.rows)
  }

  const loadOlder = async () => {
    const id = selectedId
    const t = threadsRef.current[id]
    if (!t?.older || t.loadingOlder) return
    patchThread(id, () => ({ loadingOlder: true, olderError: '' }))
    const result = await loadMessages(id, t.older)
    if (!result.ok) return patchThread(id, () => ({ loadingOlder: false, olderError: result.message || 'Older messages could not be loaded.' }))
    patchThread(id, cur => {
      const known = new Set((cur.messages || []).map(m => m.id))
      return { loadingOlder: false, older: result.nextCursor, messages: [...[...result.rows].reverse().filter(m => !known.has(m.id)), ...(cur.messages || [])] }
    })
  }

  // Realtime: inbox channels named by the server (branch inboxes for Staff, own channel otherwise) plus the open conversation.
  useEffect(() => {
    const handlers = {
      posted: ({ conversation_id: id }) => { refreshList(); if (id && threadsRef.current[id]?.messages) syncNewer(id) },
      changed: () => refreshList(),
      read: () => refreshList(),
    }
    const off = channels.map(name => subscribe(name, handlers))
    return () => off.forEach(fn => fn())
  }, [channels.join()])
  useEffect(() => {
    if (!selectedId) return undefined
    return subscribe(`conversation.${selectedId.toLowerCase()}`, { posted: () => syncNewer(selectedId), changed: () => refreshList() })
  }, [selectedId])
  // Polling fallback: every 10 s while the socket is not live; a slow safety re-read even when it is.
  useVisibleRefresh(() => { refreshList(); if (selectedRef.current) syncNewer(selectedRef.current) }, { active: !!list, intervalMs: live === 'live' ? SAFETY_POLL_MS : POLL_MS })

  // Read state follows what is on screen: the newest DISPLAYED server message, only while the page is visible. The server only moves the
  // marker forward, so a stale tab cannot make read messages unread.
  const newestShown = thread?.messages?.length ? thread.messages[thread.messages.length - 1].id : null
  useEffect(() => {
    if (!selectedId || !newestShown || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return
    let current = true
    markRead(selectedId, newestShown).then(r => { if (current && r.ok) refreshList() })
    return () => { current = false }
  }, [selectedId, newestShown])
  useEffect(() => { const el = logRef.current; if (el) el.scrollTop = el.scrollHeight }, [selectedId, thread?.messages?.length, (pending[selectedId] || []).length])

  const deliver = async (conversationId, item) => {
    setPending(previous => ({ ...previous, [conversationId]: (previous[conversationId] || []).map(p => (p.key === item.key ? { ...p, status: 'sending', message: '' } : p)) }))
    const result = await sendMessage(conversationId, item.text, item.key)
    if (result.ok) {
      appendMessages(conversationId, [result.message])
      setPending(previous => ({ ...previous, [conversationId]: (previous[conversationId] || []).filter(p => p.key !== item.key) }))
      refreshList()
      return
    }
    const message = result.kind === 'rate_limited' ? `Please wait a moment.${result.retry_after ? ` Try again in about ${result.retry_after} s.` : ''}` : (result.message || 'Not sent.')
    setPending(previous => ({ ...previous, [conversationId]: (previous[conversationId] || []).map(p => (p.key === item.key ? { ...p, status: 'failed', message, final: result.kind === 'validation' } : p)) }))
  }

  const send = event => {
    event?.preventDefault()
    if (!selected || selected.closed) return
    const snapshot = drafts.current.snapshot(selected.id)      // conversation, text and key captured together
    const text = snapshot.text.trim()
    if (!text) return
    if (text.length > MAX_MESSAGE) return toast(`Keep a message under ${MAX_MESSAGE} characters.`, 'warning')
    const item = { key: snapshot.key, text, status: 'sending' }
    setPending(previous => ({ ...previous, [snapshot.conversationId]: [...(previous[snapshot.conversationId] || []), item] }))
    drafts.current.sent(snapshot); redraw()
    deliver(snapshot.conversationId, item)                       // a retry reuses item.key, so it can never post twice
  }
  const discard = (conversationId, key) => setPending(previous => ({ ...previous, [conversationId]: (previous[conversationId] || []).filter(p => p.key !== key) }))

  const close = async () => {
    const result = await closeConversation(selected, commandKey())
    if (!result.ok) { toast(result.message, 'warning'); if (result.code === 'stale_revision') refreshList(); return }
    toast('Conversation closed.', 'success'); await refreshList()
  }

  const title = c => (patient ? `${c.branchName || 'Clinic'} front desk` : `${c.patientName || 'Patient'}${c.patientCode ? ` · ${c.patientCode}` : ''}`)
  const subtitle = c => (patient ? (c.assignedName ? `With ${c.assignedName}` : 'Waiting for the front desk') : `${c.branchName}${c.assignedName ? ` · ${c.assignedToMe ? 'Handled by you' : `Handled by ${c.assignedName}`}` : ' · Not answered yet'}`)

  return <div className={patient ? 'pt-page is-wide' : undefined}>
    {patient
      ? <PageHead eyebrow="Appointments & Care" title="Messages" text="Write to the front desk of any branch. Reminders and updates are in Notifications."
          actions={<div className="chat-head-actions"><LiveStatus state={live}/><Button icon="message" onClick={() => { setComposing(true); setSelectedId(null) }}>New message</Button></div>}/>
      : <PageHeader title="Messages"
          text="Conversations with Patients for the branches you work at. Everyone at the branch front desk can see and reply."
          aside={<div className="chat-head-actions"><LiveStatus state={live}/></div>}/>}
    <p className="muted-copy">These messages stay inside this application. Nothing is sent by SMS or social media, and “unread” only means not yet opened here.{patient ? ' If you are away when the clinic writes, we email you a short alert — never the message itself.' : ''}</p>
    {error && <Notice tone="warning" title="Conversations unavailable">{error} <Button size="sm" onClick={refreshList}>Retry</Button></Notice>}
    {!list && !error && <div className="chat-skeleton" aria-busy="true"><Notice>Loading conversations…</Notice></div>}
    {list && <div className={`chat ${selectedId || composing ? 'has-thread' : ''}`}>
      <section className="chat-list" aria-label="Conversations">
        {!list.length && <Empty title="No conversations yet" text={patient ? 'Start one with “New message”. The front desk usually replies during clinic hours.' : 'New Patient messages for your branch will appear here.'}/>}
        <ul>{list.map(c => <li key={c.id}><button type="button" aria-current={c.id === selectedId ? 'true' : undefined} className={`chat-row ${c.id === selectedId ? 'selected' : ''} ${c.unread ? 'is-unread' : ''}`} onClick={() => openThread(c.id)}>
          <span className="chat-row-main"><b>{title(c)}</b><small>{subtitle(c)}</small></span>
          <span className="chat-row-meta">{c.lastMessageAt && <small>{day(c.lastMessageAt)}</small>}{c.unread > 0 ? <span className="chat-badge"><span aria-hidden="true">{c.unread}</span><span className="sr-only">{c.unread} unread</span></span> : c.closed ? <Status>Closed</Status> : null}</span>
        </button></li>)}</ul>
        {nextCursor && <Button variant="soft" onClick={loadMore}>Load more conversations</Button>}
      </section>

      <section className="chat-thread" aria-label={selected ? `Conversation: ${title(selected)}` : 'Conversation'}>
        {composing && <NewConversation drafts={drafts.current} prefill={initial?.compose ? initial.text : ''} onCancel={() => setComposing(false)} onStarted={async id => { setComposing(false); await refreshList(); openThread(id) }}/>}
        {!composing && !selected && <div className="chat-placeholder"><Icon name="message" size={28}/><p>{list.length ? 'Choose a conversation to read it.' : patient ? 'Your conversations with the clinic will appear here.' : 'Nothing to answer right now.'}</p></div>}
        {!composing && selected && <>
          <header className="chat-thread-head">
            <button type="button" className="chat-back" onClick={() => setSelectedId(null)} aria-label="Back to conversations"><Icon name="chevron" size={18}/></button>
            <div><b>{title(selected)}</b><small>{subtitle(selected)}{selected.participants.some(p => p.role === 'Dentist') ? ` · Dentist: ${selected.participants.filter(p => p.role === 'Dentist').map(p => p.name).join(', ')}` : ''}</small></div>
            <div className="chat-thread-actions">{staff && !selected.closed && <AddDentist conversationId={selected.id} onAdded={refreshList} toast={toast}/>}{!patient && !selected.closed && <Button size="sm" variant="ghost" onClick={() => setConfirmClose(true)}>Close</Button>}</div>
          </header>
          {thread?.error && <Notice tone="warning" title="Messages unavailable">{thread.error} <Button size="sm" onClick={() => openThread(selected.id)}>Retry</Button></Notice>}
          {!thread?.messages && !thread?.error && <Notice>Loading messages…</Notice>}
          {thread?.messages && <div className="chat-log" role="log" aria-label="Messages" ref={logRef}>
            {thread.older && <Button size="sm" variant="soft" disabled={thread.loadingOlder} onClick={loadOlder}>{thread.loadingOlder ? 'Loading…' : 'Load older messages'}</Button>}
            {thread.olderError && <Notice tone="warning" title="Older messages unavailable">{thread.olderError} <Button size="sm" variant="ghost" onClick={loadOlder}>Retry</Button></Notice>}
            {!thread.messages.length && <p className="muted">No messages yet.</p>}
            {thread.messages.map((m, i) => <React.Fragment key={m.id}>
              {day(m.sentAt) !== day(thread.messages[i - 1]?.sentAt) && <div className="chat-day">{day(m.sentAt)}</div>}
              <div className={`chat-bubble ${m.mine ? 'mine' : ''}`}><small>{m.mine ? 'You' : `${m.senderName}${m.senderRole ? ` · ${m.senderRole}` : ''}`}</small><p>{m.body}</p><span className="chat-time">{time(m.sentAt)}</span></div>
            </React.Fragment>)}
            {(pending[selected.id] || []).map(p => <div key={p.key} className={`chat-bubble mine is-${p.status}`}><small>You</small><p>{p.text}</p>
              {p.status === 'sending' ? <span className="chat-time">Sending…</span> : <span className="chat-failed" role="alert">Not sent. {p.message} {!p.final && <button type="button" className="text-link" onClick={() => deliver(selected.id, p)}>Retry</button>} <button type="button" className="text-link" onClick={() => discard(selected.id, p.key)}>Discard</button></span>}
            </div>)}
          </div>}
          {selected.closed ? <Notice>This conversation is closed. You can read it, but it can’t receive new messages.{patient ? ' Use “New message” to write to the front desk again.' : ''}</Notice>
            : <form onSubmit={send} className="chat-compose">
              <label className="sr-only" htmlFor={`compose-${selected.id}`}>Message to {title(selected)}</label>
              <textarea id={`compose-${selected.id}`} key={selected.id} value={drafts.current.text(selected.id)} maxLength={MAX_MESSAGE} rows={2} placeholder="Write a message…"
                onChange={e => { drafts.current.setText(selected.id, e.target.value); redraw() }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e) }}/>
              <Button type="submit" icon="arrow" disabled={!drafts.current.text(selected.id).trim()}>Send</Button>
            </form>}
        </>}
      </section>
    </div>}
    <ConfirmDialog
      open={confirmClose}
      title="Close this conversation?"
      confirmLabel="Close conversation"
      cancelLabel="Keep open"
      tone="danger"
      onConfirm={() => { setConfirmClose(false); close() }}
      onCancel={() => setConfirmClose(false)}
    >
      <p>Are you sure you want to close this conversation? Once closed, neither the clinic nor the patient can post new messages in this thread.</p>
    </ConfirmDialog>
  </div>
}

function NewConversation({ drafts, prefill = '', onCancel, onStarted }) {
  const [options, setOptions] = useState(null)
  const [branchId, setBranchId] = useState('')
  const [changing, setChanging] = useState(false)
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [, redraw] = useReducer(n => n + 1, 0)
  useEffect(() => {
    loadStartOptions().then(r => {
      if (!r.ok) return setError(r.message || 'Branches could not be loaded.')
      setOptions(r); setBranchId(r.defaultBranchId || '')
    })
  }, [])
  const draftId = 'new-conversation'
  useEffect(() => { if (prefill && !drafts.text(draftId).trim()) { drafts.setText(draftId, prefill); redraw() } }, [prefill])
  const chosen = options?.branches.find(b => b.id === branchId)
  const submit = async event => {
    event.preventDefault()
    if (sending) return
    const snapshot = drafts.snapshot(draftId)
    setSending(true); setError('')
    const result = await startConversation(branchId, snapshot.text, snapshot.key)
    setSending(false)
    if (!result.ok) return setError(result.message || 'Your message was not sent. Try again.') // text and key are kept: a retry cannot post twice
    drafts.sent(snapshot)
    onStarted(result.conversationId)
  }
  return <form className="chat-new" onSubmit={submit} aria-busy={sending}>
    <h2>New message</h2>
    {!options && !error && <Notice>Loading branches…</Notice>}
    {options && <>
      {/* Decision 6: no required branch step. The front desk is suggested (next appointment, latest visit, preferred, first branch)
          and shown as one line; the Patient may change it. */}
      {chosen && !changing ? <p className="chat-to">To: <b>{chosen.name} front desk</b>{chosen.address ? <span> · {chosen.address}</span> : null} · <button type="button" className="link-button" onClick={() => setChanging(true)}>Change</button></p>
        : <Field label="Send to" required hint="The front desk of the branch you choose will reply here.">
          <select value={branchId} onChange={e => { setBranchId(e.target.value); if (e.target.value) setChanging(false) }}><option value="">Choose a branch</option>{options.branches.map(b => <option key={b.id} value={b.id}>{b.name} front desk</option>)}</select>
        </Field>}
      <Field label="Message" required hint="The front desk of that branch will reply here. Please don’t include card numbers or passwords.">
        <textarea rows={4} maxLength={MAX_MESSAGE} value={drafts.text(draftId)} onChange={e => { drafts.setText(draftId, e.target.value); redraw() }}/>
      </Field>
    </>}
    {error && <Notice tone="warning" title="Not sent">{error}</Notice>}
    <div className="form-actions"><Button variant="ghost" onClick={onCancel}>Cancel</Button><Button type="submit" icon="arrow" disabled={sending || !branchId || !drafts.text(draftId).trim()}>{sending ? 'Sending…' : 'Send'}</Button></div>
  </form>
}

function AddDentist({ conversationId, onAdded, toast }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(null)
  const [choice, setChoice] = useState('')
  useEffect(() => { setOpen(false); setRows(null); setChoice('') }, [conversationId])
  const show = async () => {
    setOpen(true)
    const result = await loadDentistOptions(conversationId)
    if (!result.ok) { setOpen(false); return toast(result.message, 'warning') }
    setRows(result.rows)
  }
  const add = async () => {
    const result = await addDentist(conversationId, choice)
    if (!result.ok) return toast(result.message, 'warning')
    toast(result.added ? 'Dentist added to the conversation.' : 'That Dentist is already in this conversation.', 'success')
    setOpen(false); onAdded()
  }
  if (!open) return <Button size="sm" variant="soft" onClick={show}>Add dentist</Button>
  return <span className="chat-add-dentist">
    <label className="sr-only" htmlFor={`dentist-${conversationId}`}>Dentist to add</label>
    <select id={`dentist-${conversationId}`} value={choice} onChange={e => setChoice(e.target.value)} disabled={!rows}>
      <option value="">{rows ? 'Choose a dentist' : 'Loading…'}</option>
      {(rows || []).map(d => <option key={d.id} value={d.id} disabled={d.participant}>{d.name}{d.participant ? ' (already added)' : ''}</option>)}
    </select>
    <Button size="sm" disabled={!choice} onClick={add}>Add</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
  </span>
}
