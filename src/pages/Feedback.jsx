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

export function PatientFeedbackPage({ role, store }) {
  if (role === 'owner') return <OwnerFeedbackReviewPage store={store}/>
  const { toast } = store
  const visits = usePaged(loadEligibleVisits)
  const mine = usePaged(loadMyFeedback)
  const [visitId, setVisitId] = useState('')
  const [rating, setRating] = useState('5')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [failure, setFailure] = useState(null)
  const key = useRef(commandKey())
  const edit = (setter, value) => { setter(value); if (failure) key.current = commandKey(); setFailure(null) }

  const send = async event => {
    event?.preventDefault()
    if (sending) return
    setSending(true); setFailure(null)
    const result = await submit(visitId, text, key.current, rating ? Number(rating) : null)
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
        <Field label="Rating (1–5 Stars)"><select value={rating} onChange={e => edit(setRating, e.target.value)}><option value="5">⭐⭐⭐⭐⭐ 5 Stars - Excellent</option><option value="4">⭐⭐⭐⭐ 4 Stars - Very Good</option><option value="3">⭐⭐⭐ 3 Stars - Average</option><option value="2">⭐⭐ 2 Stars - Needs Improvement</option><option value="1">⭐ 1 Star - Poor</option><option value="">No star rating (Text only)</option></select></Field>
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
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>{mine.rows.map(f => <li key={f.id} style={{ marginBottom: 12 }}><b>{visitLabel(f.visit)}</b>{f.rating ? ` • ${'★'.repeat(f.rating)}${'☆'.repeat(5 - f.rating)} (${f.rating}/5)` : ''}<small className="block-muted">Sent {when(f.submittedAt)}</small><p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{f.body}</p></li>)}</ul>
        <MoreControls state={mine} noun="entries"/>
      </>}
    </Card>
  </div>
}

export function OwnerFeedbackReviewPage({ store }) {
  const { state } = store
  const [rows, setRows] = useState(null)
  const [cursor, setCursor] = useState(null)
  const [branchFilter, setBranchFilter] = useState('')
  const [dentistFilter, setDentistFilter] = useState('')
  const [ratingFilter, setRatingFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchFeedback = async (isMore = false) => {
    setLoading(true)
    setError('')
    const params = { per_page: 25 }
    if (branchFilter) params.branch_id = branchFilter
    if (dentistFilter) params.dentist_id = dentistFilter
    if (ratingFilter) params.rating = Number(ratingFilter)
    if (isMore && cursor) params.cursor = cursor

    const res = await (await import('../feedback-api.js')).loadFeedbackReview(params)
    setLoading(false)
    if (res.ok) {
      const data = Array.isArray(res.data) ? res.data : []
      setRows(prev => isMore ? [...(prev || []), ...data] : data)
      setCursor(res.meta?.next_cursor || null)
    } else {
      setError(res.message || 'Could not load feedback reviews.')
    }
  }

  useEffect(() => {
    fetchFeedback(false)
  }, [branchFilter, dentistFilter, ratingFilter])

  const totalCount = rows?.length || 0
  const ratedRows = (rows || []).filter(r => r.rating)
  const avgRating = ratedRows.length > 0 ? (ratedRows.reduce((acc, r) => acc + r.rating, 0) / ratedRows.length).toFixed(1) : 'N/A'

  return <div className="admin-page">
    <PageHeader kicker="Governance & Quality" title="Patient Feedback Review" text="Review patient satisfaction ratings and comments across all branches and dentists. Low ratings (1–2 stars) automatically create front-desk follow-up tasks."/>
    
    <div style={{display:'flex',gap:'12px',flexWrap:'wrap',marginBottom:'16px'}}>
      <Field label="Filter by Branch">
        <select value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {(state.branches || []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </Field>
      <Field label="Filter by Dentist">
        <select value={dentistFilter} onChange={e => setDentistFilter(e.target.value)}>
          <option value="">All Dentists</option>
          {(state.dentists || []).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="Filter by Star Rating">
        <select value={ratingFilter} onChange={e => setRatingFilter(e.target.value)}>
          <option value="">All Ratings</option>
          <option value="5">⭐⭐⭐⭐⭐ 5 Stars</option>
          <option value="4">⭐⭐⭐⭐ 4 Stars</option>
          <option value="3">⭐⭐⭐ 3 Stars</option>
          <option value="2">⭐⭐ 2 Stars (Auto-Task)</option>
          <option value="1">⭐ 1 Star (Auto-Task)</option>
        </select>
      </Field>
    </div>

    <div style={{display:'flex',gap:'16px',marginBottom:'16px'}}>
      <Card title="Average Rating" subtitle={ratedRows.length ? `Based on ${ratedRows.length} rated visits` : 'No ratings in selection'}>
        <h2 style={{margin:0,fontSize:'2rem',color:'var(--color-primary,#10b981)'}}>{avgRating} {avgRating !== 'N/A' ? '★' : ''}</h2>
      </Card>
      <Card title="Feedback Records" subtitle="Matching active filters">
        <h2 style={{margin:0,fontSize:'2rem'}}>{totalCount}</h2>
      </Card>
    </div>

    <Card title="Patient Reviews">
      {error && <Notice tone="warning" title="Could not load reviews">{error} <Button size="sm" onClick={() => fetchFeedback(false)}>Retry</Button></Notice>}
      {!rows && !error && <Notice>Loading feedback records…</Notice>}
      {rows && !rows.length && <Empty title="No feedback entries found" text="No patient feedback matches the current branch, dentist, or rating filter."/>}
      {rows && rows.length > 0 && <>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {rows.map(item => (
            <div key={item.id} style={{padding:'12px',border:'1px solid var(--border-color,#e5e7eb)',borderRadius:'8px',background:'var(--bg-card,#fff)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'6px'}}>
                <div>
                  <strong>{item.patient?.name || 'Patient'}</strong>
                  <span className="muted" style={{marginLeft:'8px',fontSize:'0.85rem'}}>
                    {item.visit?.branch?.name ? `${item.visit.branch.name} • ` : ''}
                    {item.visit?.dentist?.name ? `Dr. ${item.visit.dentist.name} • ` : ''}
                    {item.visit?.date || ''}
                  </span>
                </div>
                <div>
                  {item.rating ? (
                    <span style={{fontWeight:'bold',color:item.rating <= 2 ? '#dc2626' : '#f59e0b',fontSize:'1.1rem'}}>
                      {'★'.repeat(item.rating)}{'☆'.repeat(5 - item.rating)}
                      <small style={{marginLeft:'4px',fontSize:'0.85rem',color:'inherit'}}>({item.rating}/5)</small>
                    </span>
                  ) : <span className="muted">No rating</span>}
                </div>
              </div>
              <p style={{margin:'6px 0',whiteSpace:'pre-wrap',color:'var(--text-main,#111827)'}}>{item.body}</p>
              {item.rating && item.rating <= 2 && (
                <div style={{marginTop:'8px',padding:'6px 10px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'4px',fontSize:'0.85rem',color:'#991b1b',display:'inline-flex',alignItems:'center',gap:'6px'}}>
                  <span>⚠️</span>
                  <span><strong>Low satisfaction alert:</strong> An automatic follow-up task has been scheduled for front desk staff.</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {cursor && (
          <div style={{marginTop:'16px',textAlign:'center'}}>
            <Button variant="soft" disabled={loading} onClick={() => fetchFeedback(true)}>
              {loading ? 'Loading…' : 'Load older reviews'}
            </Button>
          </div>
        )}
      </>}
    </Card>
  </div>
}

