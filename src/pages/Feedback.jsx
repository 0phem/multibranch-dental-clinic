import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, Empty, Field, Notice, PageHeader } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { commandKey } from '../appointments-api.js'
import { loadEligibleVisits, loadMyFeedback, MAX_FEEDBACK, submit } from '../feedback-api.js'

// M26 foundation screen (clinic-server session, Patient only): tell the clinic about one of your own completed visits, and read what you
// sent. There is no reviewer screen (reviewer authority is not approved). The screen promises nothing the product does not do: no reply, no response time, no anonymity, no rating,
// no category and no status — those are not decided yet. Feedback text is shown as plain text.
function usePaged(loader) {
  const [rows, setRows] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const load = async () => {
    setError('')
    const result = await loader()
    if (result.ok) { setRows(result.rows); setCursor(result.nextCursor); setMoreError('') } else setError(result.message || 'This could not be loaded.')
  }
  const more = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true); setMoreError('')
    const result = await loader(cursor)
    setLoadingMore(false)
    if (!result.ok) return setMoreError(result.message || 'More could not be loaded.')
    setRows(previous => [...previous, ...result.rows.filter(r => !previous.some(p => p.id === r.id))]); setCursor(result.nextCursor)
  }
  const prepend = row => setRows(previous => [row, ...(previous || []).filter(r => r.id !== row.id)])
  useEffect(() => { load() }, [])
  return { rows, cursor, error, moreError, loadingMore, load, more, prepend }
}

const when = iso => (iso ? `${dateLabel(iso.slice(0, 10))} ${iso.slice(11, 16)}` : '')
const visitLabel = v => `${dateLabel(v.date)}${v.services.length ? ` • ${v.services.join(', ')}` : ''}`

function MoreControls({ state, noun }) {
  return <div style={{ marginTop: 12, textAlign: 'center' }}>
    <p className="muted" role="status">Showing {state.rows.length} {noun}{state.cursor ? '. Older entries are available.' : '. That is all of them.'}</p>
    {state.moreError && <Notice tone="warning" title={`Older ${noun} unavailable`}>{state.moreError} <Button size="sm" variant="ghost" onClick={state.more}>Retry</Button></Notice>}
    {state.cursor && !state.moreError && <Button variant="soft" disabled={state.loadingMore} onClick={state.more}>{state.loadingMore ? 'Loading…' : `Load older ${noun}`}</Button>}
  </div>
}

export function PatientFeedbackPage({ store }) {
  const { toast } = store
  const visits = usePaged(loadEligibleVisits)
  const mine = usePaged(loadMyFeedback)
  const [visitId, setVisitId] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState(null)
  const key = useRef(commandKey())
  const edit = (setter, value) => { setter(value); if (failure) key.current = commandKey(); setFailure(null) }

  const send = async event => {
    event?.preventDefault()
    if (sending) return
    setSending(true); setFailure(null)
    const result = await submit(visitId, text, key.current)
    setSending(false)
    if (!result.ok) return setFailure(result)         // the text and the key are kept: "Try again" cannot store it twice
    mine.prepend(result.row); setText(''); key.current = commandKey(); toast('Your feedback was saved.', 'success')
  }

  return <div className="pt-page">
    <PageHeader kicker="Your care" title="Share feedback" text="Tell the clinic about one of your completed visits."/>
    <Notice tone="info" title="Before you send">Your feedback is saved with your account — it is not anonymous. The clinic has not set a response time, and this form does not start a conversation. To ask the clinic something, use Messages.</Notice>
    <Card title="Your feedback">
      {visits.error && <Notice tone="warning" title="Your visits could not be loaded">{visits.error} <Button size="sm" onClick={visits.load}>Retry</Button></Notice>}
      {!visits.rows && !visits.error && <Notice>Loading your visits…</Notice>}
      {visits.rows && !visits.rows.length && <Empty title="No completed visits yet" text="You can share feedback after a visit has been completed."/>}
      {visits.rows && visits.rows.length > 0 && <form onSubmit={send} className="form-grid one-col">
        <Field label="Which visit?" required><select value={visitId} onChange={e => edit(setVisitId, e.target.value)}><option value="">Choose a completed visit</option>{visits.rows.map(v => <option key={v.id} value={v.id}>{visitLabel(v)}</option>)}</select></Field>
        {visits.cursor && <Button type="button" size="sm" variant="ghost" onClick={visits.more}>Show older visits</Button>}
        <Field label="Your feedback" required><textarea value={text} maxLength={MAX_FEEDBACK} onChange={e => edit(setText, e.target.value)}/></Field>
        <Button type="submit" disabled={sending || !visitId || !text.trim()}>{sending ? 'Sending…' : 'Send feedback'}</Button>
        {failure && <Notice tone="warning" title={failure.kind === 'rate_limited' ? 'Please wait a moment' : 'Your feedback was not sent'}><span role="alert">{failure.message}{failure.kind === 'rate_limited' && failure.retry_after ? ` Try again in about ${failure.retry_after} seconds.` : ''}</span>{failure.kind !== 'validation' && <> <Button size="sm" variant="soft" disabled={sending} onClick={send}>Try again</Button></>}</Notice>}
      </form>}
    </Card>
    <Card className="top-gap" title="What you have sent">
      {mine.error && <Notice tone="warning" title="Your feedback could not be loaded">{mine.error} <Button size="sm" onClick={mine.load}>Retry</Button></Notice>}
      {!mine.rows && !mine.error && <Notice>Loading…</Notice>}
      {mine.rows && !mine.rows.length && <p className="muted">You have not sent any feedback yet.</p>}
      {mine.rows && mine.rows.length > 0 && <>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{mine.rows.map(f => <li key={f.id} style={{ marginBottom: 12 }}><b>{visitLabel(f.visit)}</b><small className="block-muted">Sent {when(f.submittedAt)}</small><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.body}</p></li>)}</ul>
        <MoreControls state={mine} noun="entries"/>
      </>}
    </Card>
  </div>
}
