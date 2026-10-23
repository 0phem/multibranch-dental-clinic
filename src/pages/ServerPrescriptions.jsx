import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader } from '../components.jsx'
import { createPrescription, downloadPrescriptionPdf, issuePrescription, listPrescriptions, prescription, prescriptionVisits, savePrescriptionLicense, updatePrescription, voidPrescription } from '../api-client.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'
const day = d => d ? new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : ''
const EMPTY_LINE = { medicine: '', dosage: '', frequency: '', duration: '', instructions: '' }
const TONE = { Draft: 'is-late', Issued: 'is-ok', Void: 'is-bad' }

const COMMON_PRESETS = [
  { name: 'Amoxicillin 500mg', dosage: '1 capsule (500mg)', frequency: 'Every 8 hours (3x daily)', duration: '7 days', instructions: 'Take with or after meals. Complete the entire course.' },
  { name: 'Mefenamic Acid 500mg', dosage: '1 capsule (500mg)', frequency: 'Every 8 hours as needed', duration: '3 to 5 days', instructions: 'Take with food for pain or swelling.' },
  { name: 'Paracetamol 500mg', dosage: '1 tablet (500mg)', frequency: 'Every 4 to 6 hours as needed', duration: '3 days', instructions: 'For mild to moderate pain. Maximum 4000mg per day.' },
  { name: 'Ibuprofen 400mg', dosage: '1 tablet (400mg)', frequency: 'Every 6 to 8 hours with meals', duration: '3 to 5 days', instructions: 'Take immediately after food or with milk.' },
  { name: 'Co-amoxiclav 625mg', dosage: '1 tablet (625mg)', frequency: 'Every 12 hours (2x daily)', duration: '7 days', instructions: 'Take at the start of a meal. Complete the course.' },
  { name: 'Clindamycin 300mg', dosage: '1 capsule (300mg)', frequency: 'Every 6 to 8 hours', duration: '7 days', instructions: 'Take with a full glass of water. Alternative for penicillin allergy.' },
  { name: 'Tranexamic Acid 500mg', dosage: '1 capsule (500mg)', frequency: 'Every 8 hours', duration: '2 to 3 days', instructions: 'For post-extraction bleeding control.' },
  { name: 'Celecoxib 200mg', dosage: '1 capsule (200mg)', frequency: 'Once or twice daily', duration: '3 to 5 days', instructions: 'Take with food for acute dental pain and inflammation.' },
  { name: 'Chlorhexidine 0.12% Oral Rinse', dosage: '15 mL rinse', frequency: 'Twice daily after brushing', duration: '7 to 14 days', instructions: 'Swish for 30 seconds then expectorate. Do not swallow.' },
]

/**
 * M19 Prescriptions (clinic server). Dentists at the branch write a prescription for a recent visit: free-text lines, no drug list
 * and no interaction checks (the Owner may keep common names for quick selection), then issue it, which locks it and numbers it.
 * A mistake is voided with a reason and a new one is issued. The front desk views and prints issued ones; the Owner sees
 * metadata only.
 */
export function PrescriptionsServerPage({ store, role }) {
  const toast = store?.toast || (() => {})
  const [rows, setRows] = useState(null), [error, setError] = useState(''), [openId, setOpenId] = useState(null), [writing, setWriting] = useState(null)
  const [query, setQuery] = useState(''), [statusFilter, setStatusFilter] = useState('all')
  const load = () => listPrescriptions().then(r => { if (r.ok) { setRows(r.data); setError('') } else setError(r.message || 'Prescriptions could not be loaded.') })
  useEffect(() => { load() }, [])
  const dentist = role === 'dentist', owner = role === 'owner'
  const filteredRows = (rows || []).filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (!query.trim()) return true
    const q = query.toLowerCase()
    return (
      (p.number || '').toLowerCase().includes(q) ||
      (p.patient?.name || '').toLowerCase().includes(q) ||
      (p.dentist || '').toLowerCase().includes(q) ||
      (p.branch || '').toLowerCase().includes(q)
    )
  })
  return <div className="st-page">
    <PageHeader kicker={owner ? 'Administration' : 'Clinical'} title="Prescriptions"
      text={owner ? 'Prescriptions issued at the clinic: number, date, dentist and branch. The medicines are visible only to the dentists, the branch front desk and the patient.'
        : dentist ? 'Write a prescription for a recent visit. Issuing locks it; a mistake is voided with a reason and a new one is issued. There is no drug list and no interaction check: you decide what to prescribe.'
          : 'Prescriptions issued at your branch, to view and print. Only a dentist writes or changes them.'}/>
    {dentist && <WriteCard toast={toast} onDone={id => { load(); setOpenId(id) }} editing={writing} onEdited={() => setWriting(null)}/>}
    {dentist && <LicenseCard toast={toast}/>}
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    <Card title={owner ? 'Issued prescriptions' : 'Prescriptions'}>
      {rows && rows.length > 0 && (
        <div className="st-filters" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Field label="Search">
            <input
              type="search"
              placeholder="Search by number, patient, dentist, or branch…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              style={{ minWidth: '240px' }}
            />
          </Field>
          <Field label="Status">
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="all">All statuses</option>
              <option value="Issued">Issued</option>
              <option value="Draft">Draft</option>
              <option value="Void">Void</option>
            </select>
          </Field>
          {(query || statusFilter !== 'all') && (
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <Button size="sm" variant="ghost" onClick={() => { setQuery(''); setStatusFilter('all') }}>Clear</Button>
            </div>
          )}
        </div>
      )}
      {!rows ? <p className="au-muted" role="status">Loading…</p> : !filteredRows.length ? <p className="au-muted">No prescriptions found.</p>
        : <ul className="fd-list">{filteredRows.map(p => <li key={p.id}>
          <div><b>{p.number || 'Draft'}{p.patient ? ` · ${p.patient.name}` : ''}</b>
            <span><span className={`fd-badge ${TONE[p.status]}`}>{p.status === 'Void' ? 'VOID' : p.status}</span> · {p.date ? day(p.date) : 'not issued'} · {p.dentist} · {p.branch}</span></div>
          <div className="ns-actions">
            {p.can_edit && <Button size="sm" variant="soft" onClick={() => setWriting(p.id)}>Edit draft</Button>}
            <Button size="sm" variant={owner ? 'soft' : 'ghost'} onClick={() => setOpenId(p.id)}>{owner ? 'View record' : 'Open'}</Button>
          </div>
        </li>)}</ul>}
    </Card>
    {openId && <PrescriptionDialog id={openId} toast={toast} onClose={() => setOpenId(null)} onChanged={load}/>}
  </div>
}

function WriteCard({ toast, onDone, editing, onEdited }) {
  const [visits, setVisits] = useState(null), [meta, setMeta] = useState({}), [visitId, setVisitId] = useState('')
  const [lines, setLines] = useState([{ ...EMPTY_LINE }]), [note, setNote] = useState(''), [draft, setDraft] = useState(null)
  const [err, setErr] = useState(''), [busy, setBusy] = useState('')
  useEffect(() => { prescriptionVisits().then(r => { if (r.ok) { setVisits(r.data); setMeta(r.meta || {}) } }) }, [])
  useEffect(() => {
    if (!editing) return
    prescription(editing).then(r => { if (r.ok) { setDraft(r.data); setVisitId(r.data.visit); setLines(r.data.lines.map(l => ({ ...EMPTY_LINE, ...l }))); setNote(r.data.note || '') } })
  }, [editing])
  const visit = (visits || []).find(v => v.id === visitId)
  const set = (i, k, v) => setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: v } : l))
  const reset = () => { setDraft(null); setVisitId(''); setLines([{ ...EMPTY_LINE }]); setNote(''); onEdited() }
  const save = async issue => {
    setBusy(issue ? 'issue' : 'save'); setErr('')
    const body = { lines: lines.filter(l => l.medicine.trim()), note: note.trim() || null }
    let r = draft ? await updatePrescription(draft.id, { ...body, expected_revision: draft.revision }) : await createPrescription({ visit_id: visitId, ...body })
    if (r.ok && issue) r = await issuePrescription(r.data.id, r.data.revision)
    setBusy('')
    if (!r.ok) return setErr(firstError(r))
    toast(issue ? `Issued ${r.data.number}. The patient was told it is ready in the portal.` : 'Draft saved. Only dentists at this branch can see it.', 'success')
    reset(); onDone(r.data.id)
  }
  return <Card title={draft ? `Edit draft for ${draft.patient?.name}` : 'Write a prescription'}>
    {!visits ? <p className="au-muted" role="status">Loading visits…</p> : <form className="au-form" onSubmit={e => { e.preventDefault(); save(false) }}>
      {!draft && <Field label="Visit" required hint="Visits at your branches in the last 30 days."><select value={visitId} onChange={e => setVisitId(e.target.value)} required>
        <option value="">Choose a visit…</option>{visits.map(v => <option key={v.id} value={v.id}>{day(v.date)} · {v.patient.name}{v.patient.age !== null ? ` (${v.patient.age})` : ''} · {v.branch}</option>)}</select></Field>}
      {(visit || draft) && <Notice tone="warning" title="Check allergies before prescribing">{meta.allergies?.length ? meta.allergies.join(', ') : meta.allergy_notice}</Notice>}
      <datalist id="rx-common">{[...new Set([...(meta.common_medicines || []), ...COMMON_PRESETS.map(p => p.name)])].map(m => <option key={m} value={m}/>)}</datalist>
      {lines.map((l, i) => <fieldset key={i} className="rx-line"><legend>Medicine {i + 1}</legend>
        <Field label="Quick template (optional)" hint="Choose a dental preset to populate standard dosage & frequency, or enter custom details">
          <select
            value=""
            onChange={e => {
              const found = COMMON_PRESETS.find(p => p.name === e.target.value)
              if (found) {
                setLines(ls => ls.map((line, j) => j === i ? {
                  ...line,
                  medicine: found.name,
                  dosage: found.dosage,
                  frequency: found.frequency,
                  duration: found.duration,
                  instructions: found.instructions
                } : line))
              }
            }}
          >
            <option value="">Choose a common template…</option>
            {COMMON_PRESETS.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Medicine" required><input list="rx-common" value={l.medicine} maxLength={200} onChange={e => set(i, 'medicine', e.target.value)} placeholder="e.g. Amoxicillin 500mg"/></Field>
        <div className="st-pair"><Field label="Dosage"><input value={l.dosage} maxLength={120} onChange={e => set(i, 'dosage', e.target.value)} placeholder="e.g. 1 capsule (500mg)"/></Field>
          <Field label="Frequency"><input value={l.frequency} maxLength={120} onChange={e => set(i, 'frequency', e.target.value)} placeholder="e.g. Every 8 hours"/></Field></div>
        <Field label="Duration"><input value={l.duration} maxLength={120} onChange={e => set(i, 'duration', e.target.value)} placeholder="e.g. 7 days"/></Field>
        <Field label="Instructions"><textarea value={l.instructions} maxLength={500} onChange={e => set(i, 'instructions', e.target.value)} placeholder="e.g. Take with food"/></Field>
        {lines.length > 1 && <Button size="sm" variant="ghost" onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}>Remove medicine {i + 1}</Button>}
      </fieldset>)}
      <Button size="sm" variant="soft" onClick={() => setLines(ls => [...ls, { ...EMPTY_LINE }])}>Add another medicine</Button>
      <Field label="Note (optional)"><textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)}/></Field>
      {err && <p className="au-error" role="alert">{err}</p>}
      <div className="ns-actions">
        <Button type="submit" variant="soft" disabled={!!busy || (!draft && !visitId) || !lines.some(l => l.medicine.trim())}>{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
        <Button disabled={!!busy || (!draft && !visitId) || !lines.some(l => l.medicine.trim())} onClick={() => save(true)}>{busy === 'issue' ? 'Issuing…' : 'Issue prescription'}</Button>
        {draft && <Button variant="ghost" onClick={reset}>Cancel</Button>}
      </div>
      <p className="au-muted">Issuing locks the prescription and gives it a number. It cannot be edited afterwards, only voided.</p>
    </form>}
  </Card>
}

function LicenseCard({ toast }) {
  const [value, setValue] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { prescriptionVisits().then(r => r.ok && setValue(r.meta?.license_no || '')) }, [])
  if (value === null) return null
  return <Card title="License number on my prescriptions" subtitle="Optional. Shown under your name on prescriptions you issue from now on. Never filled in for you.">
    <form className="au-form st-pair" onSubmit={async e => { e.preventDefault(); setBusy(true); const r = await savePrescriptionLicense(value.trim() || null); setBusy(false); toast(r.ok ? 'Saved.' : firstError(r), r.ok ? 'success' : 'warning') }}>
      <Field label="License number"><input value={value} maxLength={40} onChange={e => setValue(e.target.value)}/></Field>
      <div className="au-actions"><Button type="submit" size="sm" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button></div>
    </form>
  </Card>
}

export function PrescriptionDialog({ id, toast, onClose, onChanged }) {
  const [p, setP] = useState(null), [error, setError] = useState(''), [reason, setReason] = useState(''), [voiding, setVoiding] = useState(false), [busy, setBusy] = useState(false)
  useEffect(() => { prescription(id).then(r => (r.ok ? setP(r.data) : setError(r.message || 'This prescription could not be opened.'))) }, [id])
  const doVoid = async () => {
    setBusy(true)
    const r = await voidPrescription(id, reason.trim())
    setBusy(false)
    if (!r.ok) return toast(firstError(r), 'warning')
    setP(r.data); setVoiding(false); toast('Voided. Write a new prescription if one is still needed.', 'success'); onChanged?.()
  }
  return <Modal open title={p ? `${p.number || 'Draft'}${p.patient ? ` · ${p.patient.name}` : ''}` : 'Prescription'} onClose={onClose}>
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    {!p ? !error && <p className="au-muted" role="status">Loading…</p> : <div className="st-handover">
      <p className="au-muted"><span className={`fd-badge ${TONE[p.status]}`}>{p.status === 'Void' ? 'VOID' : p.status}</span> {p.date ? day(p.date) : ''} · {p.dentist} · {p.branch}{p.license_no ? ` · License no. ${p.license_no}` : ''}</p>
      {p.voided && <Notice tone="warning" title="Void">Reason: {p.voided.reason}</Notice>}
      {p.lines && p.lines.length > 0 ? <ol className="rx-view">{p.lines.map((l, i) => <li key={i}><b>{l.medicine}</b>
        <span>{[l.dosage && `Dosage: ${l.dosage}`, l.frequency && `Frequency: ${l.frequency}`, l.duration && `Duration: ${l.duration}`].filter(Boolean).join(' · ')}</span>
        {l.instructions && <span>Instructions: {l.instructions}</span>}</li>)}</ol>
        : !p.lines && <p className="au-muted" style={{ padding: '0.75rem', background: 'var(--surface-muted, #f8fafc)', borderRadius: '6px' }}>Medication details and instructions are private clinical records accessible only to the treating dentist, authorized branch front desk, and the patient.</p>}
      {p.note && <p><b>Note:</b> {p.note}</p>}
      {voiding && <Field label="Reason for voiding" required><input value={reason} maxLength={300} onChange={e => setReason(e.target.value)}/></Field>}
      <div className="ns-actions">
        {p.status !== 'Draft' && <Button variant="soft" icon="download" onClick={async () => { const r = await downloadPrescriptionPdf(p.id, p.number); if (!r.ok) toast(r.message || 'The PDF could not be downloaded.', 'warning') }}>Download PDF</Button>}
        {p.can_void && !voiding && <Button variant="ghost" onClick={() => setVoiding(true)}>Void…</Button>}
        {voiding && <Button disabled={busy || reason.trim().length < 3} onClick={doVoid}>{busy ? 'Voiding…' : 'Void this prescription'}</Button>}
        <Button variant="ghost" onClick={onClose}>Close</Button>
      </div>
    </div>}
  </Modal>
}
