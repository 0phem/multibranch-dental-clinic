import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, Empty, Field, Notice, PageHeader, Status } from '../components.jsx'
import { commandKey } from '../appointments-api.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'
import { closeConversation, loadConversations, loadMessages, markRead, MAX_MESSAGE, sendMessage } from '../messaging-api.js'

// M17 conversations for a clinic-server session (Patient, Staff, Dentist). Everything shown is server data; message text is rendered as
// plain text. These are in-app human messages: the screen never claims SMS/e-mail/social delivery, "seen", "online" or "typing", and it
// does not start conversations (the clinic does not create them yet). "Unread" only means not yet opened in this application.
const stamp = iso => (iso ? `${iso.slice(0, 10)} ${iso.slice(11, 16)}` : '')

export function ServerMessagesPage({ store, role }) {
  const { toast } = store
  const [list, setList] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [error, setError] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [thread, setThread] = useState(null)          // chronological messages (oldest first)
  const [older, setOlder] = useState(null)            // cursor to older messages
  const [threadError, setThreadError] = useState('')
  const [olderError, setOlderError] = useState('')
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [text, setText] = useState('')
  const [sendError, setSendError] = useState(null)
  const [sending, setSending] = useState(false)
  const key = useRef(commandKey())
  const patient = role === 'patient'
  const selected = list?.find(c => c.id === selectedId) || null

  const load = async () => {
    setError('')
    const result = await loadConversations()
    if (result.ok) { setList(result.rows); setNextCursor(result.nextCursor) } else setError(result.message || 'Conversations could not be loaded.')
  }
  useEffect(() => { load() }, [])
  const loadMore = async () => {
    const result = await loadConversations(nextCursor)
    if (!result.ok) return toast(result.message, 'warning')
    setList(previous => [...previous, ...result.rows.filter(r => !previous.some(p => p.id === r.id))]); setNextCursor(result.nextCursor)
  }
  const refreshList = async () => { const result = await loadConversations(); if (result.ok) { setList(result.rows); setNextCursor(result.nextCursor) } }

  const openThread = async id => {
    setSelectedId(id); setThread(null); setThreadError(''); setOlderError(''); setText(''); setSendError(null); key.current = commandKey()
    const result = await loadMessages(id)
    if (!result.ok) return setThreadError(result.message || 'Messages could not be loaded.')
    setThread([...result.rows].reverse()); setOlder(result.nextCursor)
  }
  // Read state follows what is actually on screen: the newest DISPLAYED message. A message that arrived after the page loaded stays unread
  // until it is shown, and the server only ever moves the marker forward (a stale tab cannot make read messages unread again).
  const newestShown = thread?.length ? thread[thread.length - 1].id : null
  useEffect(() => {
    if (!selectedId || !newestShown) return
    let live = true
    markRead(selectedId, newestShown).then(r => { if (live && r.ok) refreshList() })
    return () => { live = false }
  }, [selectedId, newestShown])
  const loadOlder = async () => {
    if (!older || loadingOlder) return
    setLoadingOlder(true); setOlderError('')
    const result = await loadMessages(selectedId, older)
    setLoadingOlder(false)
    if (!result.ok) return setOlderError(result.message || 'Older messages could not be loaded.')
    setThread(previous => [...[...result.rows].reverse().filter(r => !previous.some(p => p.id === r.id)), ...previous]); setOlder(result.nextCursor)
  }
  // Periodic check while the tab is visible — a plain re-read of the server, not a live connection.
  useVisibleRefresh(async () => {
    refreshList()
    if (!selectedId || !thread) return
    const result = await loadMessages(selectedId)
    if (result.ok) setThread(previous => { const known = new Set(previous.map(m => m.id)); const fresh = [...result.rows].reverse().filter(m => !known.has(m.id)); return fresh.length ? [...previous, ...fresh] : previous })
  }, { active: !!list })

  const send = async event => {
    event?.preventDefault()
    if (!selected || sending || !text.trim()) return
    setSending(true); setSendError(null)
    const result = await sendMessage(selected.id, text, key.current)
    setSending(false)
    if (!result.ok) return setSendError(result)           // text and key are kept: "Try again" reuses the same key, so it cannot post twice
    setThread(previous => [...(previous || []).filter(m => m.id !== result.message.id), result.message]); setText(''); key.current = commandKey()
    refreshList()
  }
  const close = async () => {
    const result = await closeConversation(selected, commandKey())
    if (!result.ok) { toast(result.message, 'warning'); if (result.code === 'stale_revision') refreshList(); return }
    toast('Conversation closed.', 'success'); await refreshList()
  }
  const title = c => (patient ? (c.participants.map(p => p.name).filter(Boolean).join(', ') || 'Clinic team') : (c.patientName || 'Patient'))

  return <div className={patient ? 'pt-page is-wide' : undefined}>
    <PageHeader kicker={patient ? 'Your care' : undefined} title="Messages" text={patient ? 'Conversations with your clinic team. Reminders and updates are in Notifications.' : 'Two-way conversations with the Patients you are a participant for. Operational notifications remain in the notification bell.'}/>
    <Notice tone="info" title="In-app messages">These messages stay inside this application. Nothing is sent by SMS, e-mail or social media, and “unread” only means not yet opened here. Conversations are started by the clinic.</Notice>
    {error && <Notice tone="warning" title="Conversations unavailable">{error} <Button size="sm" onClick={load}>Retry</Button></Notice>}
    {!list && !error && <Notice>Loading conversations…</Notice>}
    {list && !list.length && <Empty title="No conversations yet" text="A conversation appears here when the clinic starts one with you."/>}
    {list && list.length > 0 && <div className="grid-2">
      <Card title="Conversations">
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{list.map(c => <li key={c.id}><button type="button" aria-current={c.id === selectedId ? 'true' : undefined} className={c.id === selectedId ? 'selected' : ''} onClick={() => openThread(c.id)}>
          <div><b>{title(c)}</b>{c.unread > 0 && <span className="pt-unread"> Unread ({c.unread})</span>}<small className="block-muted">{c.context}</small></div><Status>{c.status}</Status>
        </button></li>)}</ul>
        {nextCursor && <Button variant="soft" onClick={loadMore}>Load more conversations</Button>}
      </Card>
      <Card title={selected ? `${title(selected)} • ${selected.context}` : 'Select a conversation'} actions={selected && !patient && !selected.closed ? <Button size="sm" variant="ghost" onClick={close}>Close conversation</Button> : null}>
        {!selected && <Notice>Choose a conversation to read it.</Notice>}
        {selected && threadError && <Notice tone="warning" title="Messages unavailable">{threadError} <Button size="sm" onClick={() => openThread(selected.id)}>Retry</Button></Notice>}
        {selected && !thread && !threadError && <Notice>Loading messages…</Notice>}
        {selected && thread && <>
          {older && !olderError && <Button size="sm" variant="soft" disabled={loadingOlder} onClick={loadOlder}>{loadingOlder ? 'Loading…' : 'Load older messages'}</Button>}
          {olderError && <Notice tone="warning" title="Older messages unavailable">{olderError} <Button size="sm" variant="ghost" onClick={loadOlder}>Retry</Button></Notice>}
          <div className="message-thread" role="log" aria-label="Messages in this conversation">{!thread.length && <p className="muted">No messages yet.</p>}{thread.map(m => <div className={`bubble ${m.mine ? 'mine' : ''}`} key={m.id}><small>{m.mine ? 'You' : `${m.senderName}${m.senderRole ? ` (${m.senderRole})` : ''}`}</small><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.body}</p><span>{stamp(m.sentAt)}</span></div>)}</div>
          {selected.closed ? <Notice>This conversation is closed. You can read it, but it can’t receive new messages.</Notice> : <form onSubmit={send} className="compose-row">
            <Field label="Your message"><textarea value={text} maxLength={MAX_MESSAGE} placeholder="Write a message…" onChange={event => { setText(event.target.value); if (sendError) key.current = commandKey(); setSendError(null) }}/></Field>
            <Button type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send message'}</Button>
            {sendError && <Notice tone="warning" title={sendError.kind === 'rate_limited' ? 'Please wait a moment' : 'Your message was not sent'}><span role="alert">{sendError.message}{sendError.kind === 'rate_limited' && sendError.retry_after ? ` Try again in about ${sendError.retry_after} seconds.` : ''}</span>{sendError.kind !== 'validation' && <> <Button size="sm" variant="soft" disabled={sending} onClick={send}>Try again</Button></>}</Notice>}
          </form>}
        </>}
      </Card>
    </div>}
  </div>
}
