import React, { useEffect, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, Modal, Notice, PageHeader } from '../components.jsx'
import { acknowledgeHandover, cancelHandover, createHandover, handover, handovers, listBranches, listDentists, listDocuments } from '../api-client.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'
const when = iso => iso ? new Date(iso).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' }) : ''
const route = h => `${h.from.branch.name}${h.from.dentist ? ` (${h.from.dentist.name})` : ''} → ${h.to.branch.name}${h.to.dentist ? ` (${h.to.dentist.name})` : ''}`

/**
 * M25 Patient handovers inbox. Front desk and dentists see handovers to them (to acknowledge) and the ones they sent; opening one
 * shows the summary, pending treatment, notes and attached document titles. The Owner sees who, when, from and to only: the
 * clinical text stays with the two teams.
 */
export function HandoversPage({ store, role }) {
  const toast = store?.toast || (() => {})
  const [rows, setRows] = useState(null), [error, setError] = useState(''), [tab, setTab] = useState('todo'), [openId, setOpenId] = useState(null)
  const load = () => handovers().then(r => { if (r.ok) { setRows(r.data); setError('') } else setError(r.message || 'Handovers could not be loaded.') })
  useEffect(() => { load() }, [])
  const owner = role === 'owner'
  const todo = (rows || []).filter(h => h.can_acknowledge), shown = owner || tab === 'all' ? rows || [] : todo
  return <div className="st-page">
    <PageHeader kicker={owner ? 'Administration' : 'Patients'} title="Patient handovers"
      text={owner ? 'When a patient’s care moves to another branch or dentist. You see who, when, from and to; the clinical notes are visible only to the sending and receiving teams.'
        : 'When a patient’s care moves to another branch or dentist. Open a handover sent to you, read it and acknowledge it.'}/>
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    {!owner && <div className="st-tabs" role="tablist" aria-label="Handovers">
      <button type="button" role="tab" aria-selected={tab === 'todo'} className={tab === 'todo' ? 'is-on' : ''} onClick={() => setTab('todo')}>To acknowledge ({todo.length})</button>
      <button type="button" role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'is-on' : ''} onClick={() => setTab('all')}>All</button>
    </div>}
    <Card>
      {!rows ? <p className="au-muted" role="status">Loading…</p> : !shown.length ? <p className="au-muted">{tab === 'todo' && !owner ? 'Nothing to acknowledge.' : 'No handovers yet.'}</p>
        : <ul className="fd-list">{shown.map(h => <li key={h.id}>
          <div><b>{h.patient.name} · {h.patient.code}</b><span>{route(h)}</span>
            <span>{h.status}{h.acknowledged ? ` by ${h.acknowledged.by}, ${when(h.acknowledged.at)}` : ''} · sent {when(h.created_at)}{h.from.by ? ` by ${h.from.by}` : ''}</span></div>
          {!owner && <Button size="sm" variant={h.can_acknowledge ? 'primary' : 'soft'} onClick={() => setOpenId(h.id)}>{h.can_acknowledge ? 'Open (Auto-accept)' : 'Open'}</Button>}
        </li>)}</ul>}
    </Card>
    {openId && <HandoverDialog id={openId} toast={toast} onClose={() => setOpenId(null)} onChanged={load}/>}
  </div>
}

export function HandoverDialog({ id, toast, onClose, onChanged }) {
  const [h, setH] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [confirmCancel, setConfirmCancel] = useState(false)
  const ackingRef = React.useRef(false)

  useEffect(() => {
    let active = true
    ackingRef.current = false
    handover(id).then(r => {
      if (!active) return
      if (r.ok) {
        setH(r.data)
        // Auto-accepted handover (STF-06 & DEN-11): receiving staff or dentist immediately auto-accepts on open
        if (r.data.can_acknowledge && !ackingRef.current) {
          ackingRef.current = true
          acknowledgeHandover(id).then(ackRes => {
            if (!active) return
            if (ackRes.ok) {
              setH(ackRes.data)
              toast?.('Handover transferred and auto-accepted.', 'success')
              onChanged?.()
            } else if (ackRes.data?.status === 'Acknowledged') {
              setH(ackRes.data)
              onChanged?.()
            }
          }).catch(() => {
            // Acknowledgment failure does not break viewing of already-loaded record
          })
        }
      } else {
        setError(r.message || 'This handover could not be opened.')
      }
    }).catch(err => {
      if (!active) return
      setError(err?.message || 'This handover could not be opened.')
    })
    return () => { active = false }
  }, [id])

  const cancel = async () => {
    setBusy(true)
    const r = await cancelHandover(id)
    setBusy(false)
    if (!r.ok) return toast(firstError(r), 'warning')
    setH(r.data)
    toast('Handover cancelled.', 'success')
    onChanged?.()
  }

  return <Modal open title={h ? `Handover: ${h.patient.name}` : 'Handover'} onClose={onClose}>
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    {!h ? !error && <p className="au-muted" role="status">Loading…</p> : <div className="st-handover">
      <p className="au-muted">{route(h)} · sent {when(h.created_at)}{h.from.by ? ` by ${h.from.by}` : ''} · {h.status}{h.acknowledged ? ` by ${h.acknowledged.by}` : ''}</p>
      {h.summary !== undefined ? <dl className="st-dl">
        <dt>Summary</dt><dd>{h.summary}</dd>
        {h.pending_treatment && <><dt>Pending treatment</dt><dd>{h.pending_treatment}</dd></>}
        {h.notes && <><dt>Notes for the next dentist</dt><dd>{h.notes}</dd></>}
        <dt>Documents</dt><dd>{h.documents?.length ? <ul>{h.documents.map(d => <li key={d.id}>{d.title} · {d.category} · {d.date}</li>)}</ul> : 'None attached.'}</dd>
      </dl> : <Notice tone="info">The clinical notes are visible only to the sending and receiving teams.</Notice>}
      <div className="ns-actions">
        {h.can_cancel && <Button variant="ghost" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel handover</Button>}
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel patient handover?"
        confirmLabel="Cancel handover"
        onConfirm={() => { setConfirmCancel(false); cancel() }}
        onCancel={() => setConfirmCancel(false)}
      >
        <p>Cancelling withdraws this handover to <b>{h.to?.branch?.name || 'the receiving branch'}</b> and revokes temporary cross-branch handover access.</p>
      </ConfirmDialog>
    </div>}
  </Modal>
}

/** Patient record panel (front desk): this patient's handovers, and "Hand over care" to another branch or dentist. */
export function HandoverPanel({ patientId, toast }) {
  const [rows, setRows] = useState(null), [creating, setCreating] = useState(false), [openId, setOpenId] = useState(null)
  const load = () => handovers({ patient_id: patientId }).then(r => setRows(r.ok ? r.data : []))
  useEffect(() => { load() }, [patientId])
  return <section className="st-panel" aria-labelledby={`ho-${patientId}`}>
    <h3 id={`ho-${patientId}`} className="st-sub">Handovers</h3>
    {!rows ? <p className="au-muted" role="status">Loading…</p> : !rows.length ? <p className="au-muted">No handovers for this patient.</p>
      : <ul className="fd-list">{rows.map(h => <li key={h.id}><div><b>{route(h)}</b><span>{h.status} · {when(h.created_at)}</span></div>
        <Button size="sm" variant={h.can_acknowledge ? 'primary' : 'soft'} onClick={() => setOpenId(h.id)}>{h.can_acknowledge ? 'Open (Auto-accept)' : 'Open'}</Button></li>)}</ul>}
    {creating ? <HandoverForm patientId={patientId} toast={toast} onCancel={() => setCreating(false)} onDone={() => { setCreating(false); load() }}/>
      : <Button size="sm" variant="soft" onClick={() => setCreating(true)}>Hand over care</Button>}
    {openId && <HandoverDialog id={openId} toast={toast} onClose={() => setOpenId(null)} onChanged={load}/>}
  </section>
}

function HandoverForm({ patientId, toast, onCancel, onDone }) {
  const [branches, setBranches] = useState([]), [dentists, setDentists] = useState([]), [docs, setDocs] = useState([]), [picked, setPicked] = useState([])
  const [f, setF] = useState({ from_branch_ref: '', to_branch_ref: '', to_dentist_ref: '', summary: '', pending_treatment: '', notes: '' })
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => { listBranches().then(r => r.ok && setBranches((r.data || []).filter(b => b.status !== 'Closed'))); listDentists().then(r => r.ok && setDentists(r.data || [])); listDocuments({ patient_id: patientId }).then(r => r.ok && setDocs((r.data || []).filter(d => d.status === 'Active'))) }, [patientId])
  const set = (k, v) => setF(x => ({ ...x, [k]: v, ...(k === 'to_branch_ref' ? { to_dentist_ref: '' } : {}) }))
  const submit = async e => {
    e.preventDefault(); setBusy(true); setErr('')
    const r = await createHandover({ patient_id: patientId, ...f, document_ids: picked, to_dentist_ref: f.to_dentist_ref || null, pending_treatment: f.pending_treatment || null, notes: f.notes || null })
    setBusy(false)
    if (!r.ok) return setErr(firstError(r))
    toast('Handover sent. The receiving team was told.', 'success'); onDone()
  }
  const atTarget = dentists.filter(d => (d.branch_ids || []).includes(f.to_branch_ref))
  return <form className="au-form st-handover-form" onSubmit={submit}>
    <div className="st-pair">
      <Field label="From branch" required><select value={f.from_branch_ref} onChange={e => set('from_branch_ref', e.target.value)} required><option value="">Choose…</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
      <Field label="To branch" required><select value={f.to_branch_ref} onChange={e => set('to_branch_ref', e.target.value)} required><option value="">Choose…</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
    </div>
    <Field label="Receiving dentist" hint="Optional. Without one, the receiving front desk acknowledges it."><select value={f.to_dentist_ref} onChange={e => set('to_dentist_ref', e.target.value)} disabled={!f.to_branch_ref}>
      <option value="">Any dentist there</option>{atTarget.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}</select></Field>
    <Field label="Summary" required hint="Visible only to the sending and receiving teams, never to the patient."><textarea maxLength={2000} value={f.summary} onChange={e => set('summary', e.target.value)} required/></Field>
    <Field label="Pending treatment"><textarea maxLength={2000} value={f.pending_treatment} onChange={e => set('pending_treatment', e.target.value)}/></Field>
    <Field label="Notes for the next dentist"><textarea maxLength={2000} value={f.notes} onChange={e => set('notes', e.target.value)}/></Field>
    {docs.length > 0 && <fieldset className="st-docs"><legend>Attach existing documents (the receiving team sees their titles)</legend>
      {docs.map(d => <label key={d.id} className="au-check"><input type="checkbox" checked={picked.includes(d.id)} onChange={e => setPicked(p => e.target.checked ? [...p, d.id] : p.filter(x => x !== d.id))}/> {d.title} <small>{d.category}</small></label>)}
    </fieldset>}
    {err && <p className="au-error" role="alert">{err}</p>}
    <div className="ns-actions"><Button type="submit" disabled={busy || !f.summary.trim() || !f.from_branch_ref || !f.to_branch_ref}>{busy ? 'Sending…' : 'Send handover'}</Button>
      <Button variant="ghost" onClick={onCancel}>Cancel</Button></div>
  </form>
}
