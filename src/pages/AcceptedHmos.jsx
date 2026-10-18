import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Notice, PageHeader } from '../components.jsx'
import { addAcceptedHmo, listAcceptedHmos, updateAcceptedHmo } from '../api-client.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work.'

/**
 * F8 Accepted HMOs (Owner), information only: no claims and no coverage calculation. Only HMOs marked "verified by the clinic"
 * and switched on appear on the website, the FAQ and in the assistant. The list the clinic sent (R2-16) contained web-citation
 * markers, so it was loaded unverified: confirm each one with the clinic before verifying it.
 */
export function AcceptedHmosPage({ store }) {
  const toast = store?.toast || (() => {})
  const branches = store?.state?.branches || []
  const [rows, setRows] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState('')
  const [form, setForm] = useState({ name: '', note: '', branch_ref: '' }), [formError, setFormError] = useState('')
  const load = () => listAcceptedHmos().then(r => { if (r.ok) setRows(r.data || []); else setError(r.message || 'The HMO list could not be loaded.') })
  useEffect(() => { load() }, [])
  const add = async e => {
    e.preventDefault()
    setBusy('add'); setFormError('')
    const r = await addAcceptedHmo({ name: form.name.trim(), note: form.note.trim() || null, branch_ref: form.branch_ref || null })
    setBusy('')
    if (!r.ok) return setFormError(firstError(r))
    setForm({ name: '', note: '', branch_ref: '' }); toast('Added as not verified.', 'success'); load()
  }
  const update = async (row, body, done) => {
    setBusy(row.id)
    const r = await updateAcceptedHmo(row.id, { ...body, expected_revision: row.revision })
    setBusy('')
    if (!r.ok) { toast(firstError(r), 'warning'); return load() }
    toast(done, 'success'); load()
  }
  const shown = (rows || []).filter(h => h.verified && h.active).length
  return <div className="cd-page">
    <PageHeader kicker="Administration" title="Accepted HMOs" text="Which HMOs the clinic accepts, for patients to see before their visit. Information only: coverage is still checked at the clinic, and no claims are made here."/>
    {error && <Notice tone="warning" title="Unavailable">{error}</Notice>}
    <Notice tone="info" title={`${shown} shown to patients`}>Only HMOs you mark as verified by the clinic (and keep switched on) appear on the website, in the FAQ and in the assistant. Patients can add their HMO provider and member number to their profile for the front desk to check.</Notice>
    <Card title="Add an HMO">
      <form className="au-form cd-form" onSubmit={add}>
        <Field label="HMO name" required><input value={form.name} maxLength={120} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required/></Field>
        <Field label="Note (shown to patients)" hint="Optional, for example “selected dental plans only”."><input value={form.note} maxLength={200} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}/></Field>
        <Field label="Branch"><select value={form.branch_ref} onChange={e => setForm(f => ({ ...f, branch_ref: e.target.value }))}>
          <option value="">All branches</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select></Field>
        {formError && <p className="au-error" role="alert">{formError}</p>}
        <div className="au-actions"><Button type="submit" disabled={busy === 'add' || !form.name.trim()}>Add</Button></div>
      </form>
    </Card>
    <Card title={`HMO list (${(rows || []).length})`}>
      {!rows ? <p className="au-muted" role="status">Loading…</p> : !rows.length ? <p className="au-muted">No HMOs yet.</p> : <ul className="fd-list">{rows.map(h => <li key={h.id}>
        <div><b>{h.name}<span className={`fd-badge ${h.verified ? 'is-ok' : 'is-late'}`}>{h.verified ? 'Verified by the clinic' : 'Not verified'}</span>{!h.active && <span className="fd-badge is-info">Off</span>}</b>
          <span>{h.branch?.name || 'All branches'}{h.note ? ` · ${h.note}` : ''}{h.verified && h.active ? ' · shown to patients' : ' · hidden from patients'}</span></div>
        <div className="ns-actions">
          <Button size="sm" variant={h.verified ? 'ghost' : 'primary'} disabled={busy === h.id} onClick={() => update(h, { verified: !h.verified }, h.verified ? 'Marked not verified.' : 'Verified. Patients can see it now.')}>{h.verified ? 'Mark not verified' : 'Verify'}</Button>
          <Button size="sm" variant="ghost" disabled={busy === h.id} onClick={() => update(h, { active: !h.active }, h.active ? 'Switched off.' : 'Switched on.')}>{h.active ? 'Switch off' : 'Switch on'}</Button>
        </div>
      </li>)}</ul>}
    </Card>
  </div>
}
