import React, { useEffect, useRef, useState } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { dateLabel, displayTime, patientName } from '../logic.js'
import { commandKey } from '../appointments-api.js'
import { isServerId } from '../appointments-api.js'
import { captureInquiry, closeInquiry, LIMITS, linkInquiryToAppointment, loadInquiries, respondToInquiry, SOURCES } from '../inquiries-api.js'

// M16 Staff inquiry worklist for a clinic-server session. Everything shown comes from the server; inquiry text is rendered as
// plain text (never HTML). It is truthful about what this module is: Staff type each inquiry in, the source is the channel Staff
// reported, "responded" records that Staff replied outside this system, and nothing is sent, delivered or synchronized.
const emptyForm = branchId => ({ branchId: branchId || '', source: SOURCES[0], name: '', contact: '', topic: '' })
const when = iso => (iso ? `${dateLabel(iso.slice(0, 10))} ${displayTime(iso.slice(11, 16))}` : '—')

export function ServerInquiriesPage({ store }) {
  const { state, toast } = store
  const session = store.session
  const branches = (session?.branchScopes || []).map(id => ({ id, name: state.branches.find(b => b.id === id)?.name || id }))
  const [rows, setRows] = useState(null)
  const [nextCursor, setNextCursor] = useState(null)
  const [error, setError] = useState('')
  const [moreError, setMoreError] = useState('')
  const [loadingMore, setLoadingMore] = useState(false)
  const [form, setForm] = useState(() => emptyForm(branches.length === 1 ? branches[0].id : ''))
  const [busy, setBusy] = useState(false)
  const [linking, setLinking] = useState(null)
  const [appointmentId, setAppointmentId] = useState('')
  const key = useRef(commandKey())
  const edit = patch => { key.current = commandKey(); setForm(previous => ({ ...previous, ...patch })) }

  const load = async () => {
    setError('')
    const result = await loadInquiries()
    if (result.ok) { setRows(result.rows); setNextCursor(result.nextCursor); setMoreError('') } else setError(result.message || 'Inquiries could not be loaded.')
  }
  useEffect(() => { load() }, [])
  const loadOlder = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true); setMoreError('')
    const result = await loadInquiries(nextCursor)
    setLoadingMore(false)
    if (!result.ok) return setMoreError(result.message || 'Older inquiries could not be loaded.')
    setRows(previous => [...previous, ...result.rows.filter(r => !previous.some(p => p.id === r.id))]); setNextCursor(result.nextCursor)
  }

  const replace = row => setRows(previous => (previous || []).map(r => (r.id === row.id ? row : r)))
  const run = async (action, message) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.ok) { toast(result.message, 'warning'); if (result.code === 'stale_revision' || result.kind === 'conflict') load(); return false }
    replace(result.row); toast(message, 'success'); return true
  }
  const add = async () => {
    if (!form.branchId) return toast('Choose the branch this inquiry belongs to.', 'warning')
    setBusy(true)
    const result = await captureInquiry(form, key.current)
    setBusy(false)
    if (!result.ok) return toast(result.message, 'warning')
    setRows(previous => [result.row, ...(previous || []).filter(r => r.id !== result.row.id)])
    setForm(emptyForm(form.branchId)); key.current = commandKey(); toast('Inquiry recorded and assigned to you.', 'success')
  }
  const link = async () => {
    if (!appointmentId) return toast('Choose the appointment that resulted from this inquiry.', 'warning')
    if (await run(() => linkInquiryToAppointment(linking, appointmentId, commandKey()), 'Inquiry linked to the existing appointment.')) { setLinking(null); setAppointmentId('') }
  }
  const linkable = linking ? state.appointments.filter(a => isServerId(a.id) && a.branchId === linking.branchId && a.status !== 'Cancelled') : []

  return <>
    <PageHeader title="Social Media & External Inquiry Management" text="Record inquiries your team receives from social media or the website, track who answered them, and link an inquiry to the appointment that followed."/>
    <Notice tone="info" title="Recorded manually">Staff type each inquiry in. The source is only where Staff say it came from: it does not mean the clinic has an official account there, and this system is not connected to Facebook, Instagram, the website or any other platform, fetches nothing from them and sends no messages. “Responded” only records that you replied outside this system. You see the inquiries assigned to you in your branches.</Notice>
    <Card title="Record an inquiry"><div className="form-grid">
      <Field label="Branch" required><select value={form.branchId} onChange={e => edit({ branchId: e.target.value })}><option value="">Select branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Source reported by Staff" required><select value={form.source} onChange={e => edit({ source: e.target.value })}>{SOURCES.map(s => <option key={s}>{s}</option>)}</select></Field>
      <Field label="Contact name" required><input value={form.name} maxLength={LIMITS.name} onChange={e => edit({ name: e.target.value })}/></Field>
      <Field label="Contact handle or number"><input value={form.contact} maxLength={LIMITS.contact} autoComplete="off" onChange={e => edit({ contact: e.target.value })}/></Field>
      <Field label="What they asked" required><textarea value={form.topic} maxLength={LIMITS.topic} onChange={e => edit({ topic: e.target.value })}/></Field>
      <Button className="span-2" disabled={busy} onClick={add}>Record inquiry</Button>
    </div></Card>
    {error && <Notice tone="warning" title="Inquiries could not be loaded">{error} <Button size="sm" onClick={load}>Retry</Button></Notice>}
    {!rows && !error && <Notice>Loading inquiries…</Notice>}
    {rows && <Card className="top-gap" title="Inquiry worklist" subtitle="Newest first">
      {!rows.length && <Notice>No inquiries are assigned to you yet.</Notice>}
      {rows.length > 0 && <Table rows={rows} columns={[
        { key: 'source', label: 'Reported source', render: i => <div><b>{i.source}</b><small className="block-muted">{i.capture}</small></div> },
        { key: 'name', label: 'Contact', render: i => <div><b>{i.name}</b>{i.contact && <small className="block-muted">{i.contact}</small>}</div> },
        { key: 'topic', label: 'Inquiry', render: i => <span style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{i.topic}</span> },
        { key: 'branch', label: 'Branch', render: i => i.branchName },
        { key: 'receivedAt', label: 'Recorded', render: i => when(i.receivedAt) },
        { key: 'status', label: 'Status', render: i => <div><Status>{i.status}</Status>{i.status === 'Responded' && <small className="block-muted">Replied outside this system {when(i.respondedAt)}</small>}</div> },
        { key: 'link', label: 'Appointment', render: i => (i.appointmentCode ? <div>{i.appointmentCode}{i.patientName && <small className="block-muted">{i.patientName}</small>}</div> : '—') },
        { key: 'actions', label: 'Actions', render: i => <div className="row-actions">
          {i.status === 'Open' && <Button size="sm" disabled={busy} onClick={() => run(() => respondToInquiry(i, commandKey()), 'Recorded that you responded outside this system.')}>Mark responded</Button>}
          {['Open', 'Responded'].includes(i.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => { setLinking(i); setAppointmentId('') }}>Link existing appointment</Button>}
          {['Open', 'Responded'].includes(i.status) && <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => closeInquiry(i, commandKey()), 'Inquiry closed.')}>Close</Button>}
        </div> },
      ]}/>}
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <p className="muted" role="status">Showing {rows.length} inquir{rows.length === 1 ? 'y' : 'ies'}{nextCursor ? '. Older inquiries are available.' : '. That is all of them.'}</p>
        {moreError && <Notice tone="warning" title="Older inquiries unavailable">{moreError} <Button size="sm" variant="ghost" onClick={loadOlder}>Retry</Button></Notice>}
        {nextCursor && !moreError && <Button variant="soft" disabled={loadingMore} onClick={loadOlder}>{loadingMore ? 'Loading…' : 'Load older inquiries'}</Button>}
      </div>
    </Card>}
    <Modal open={!!linking} onClose={() => !busy && setLinking(null)} title="Link an existing appointment" subtitle="Choose an appointment that already exists in this branch. This records the link only; it does not book, change or cancel anything.">
      <Field label="Existing appointment"><select value={appointmentId} onChange={e => setAppointmentId(e.target.value)}><option value="">Select appointment</option>{linkable.map(a => <option key={a.id} value={a.id}>{dateLabel(a.date)} • {displayTime(a.start)} • {patientName(a.patientId, state.patients)} • {a.service}</option>)}</select></Field>
      {!linkable.length && <Notice>No linkable appointments are loaded for this branch.</Notice>}
      <Button className="full" disabled={busy} onClick={link}>Link appointment</Button>
    </Modal>
  </>
}
