import React, { useId, useRef, useState } from 'react'
import { Button, Field, Modal, Notice, PageHeader, Status } from '../components.jsx'
import { patientName } from '../logic.js'
import { visibleHmo, HMO_PROVIDERS, pendingHmo } from '../phase3-contracts.js'
import { sessionForRole } from '../contracts.js'
import { commandKey } from '../appointments-api.js'
import { formatAmount } from '../pricing-api.js'
import { getHmoAttention, hmoCasesForView } from '../hmo-presentation.js'
import * as hmoApi from '../hmo-api.js'
import { PatientHmoPage } from './PatientCare.jsx'

// M12 HMO workspace (minimal server foundation). Staff operate SERVER cases for Visits in their branch scope and keep
// Patient HMO memberships; the Owner has read-only oversight. Every change is a server command followed by a refresh;
// browser HMO records appear only as read-only history. No provider is contacted, no file is stored (M14), nothing is
// sent (M18) and nothing runs on a timer (M23): the follow-up due time is derived by the server for display.
const METHODS = ['Portal', 'Email', 'Phone', 'In person']
const RULES = [['hmo-card', 'HMO Card'], ['valid-id', 'Valid ID'], ['treatment-request', 'Dentist treatment request']]
const stamp = value => (value ? String(value).replace('T', ' ').slice(0, 16) : '—')
const label = h => (h.legacy && ['Approved', 'Rejected', 'Returned'].includes(h.status) ? `Historical recorded ${h.status}` : ['Approved', 'Rejected', 'Returned'].includes(h.status) ? `Provider ${h.status}` : h.status === 'Withdrawn' ? 'Withdrawn — self-pay' : h.status)
const providerOf = h => h.providerName || HMO_PROVIDERS.find(p => p.id === h.providerId)?.name || 'Provider not recorded'
const EVENT_LABEL = { created: 'Case opened', requirement: 'Requirement checked at the clinic', submission: 'Submission recorded', contact: 'Contact attempt recorded', escalation: 'Case escalated', response: 'Provider response recorded', withdrawal: 'Withdrawn — no HMO claim (self-pay)' }

export function HmoPage({ role, activeBranch, store, context }) {
  const { state, toast } = store
  const session = store.session || sessionForRole(role, state)
  const flow = store.appointmentFlow
  const staff = role === 'staff'
  const all = visibleHmo(state, session).filter(h => role !== 'owner' || !activeBranch || activeBranch === 'All Branches' || h.branch === activeBranch || h.branchName === activeBranch)
  const live = all.filter(h => h.server)
  const history = all.filter(h => !h.server)
  const [selectedId, setSelectedId] = useState(context?.hmoCaseId || '')
  React.useEffect(() => { if (context?.hmoCaseId) setSelectedId(context.hmoCaseId) }, [context?.hmoCaseId])
  const selected = all.find(h => h.id === selectedId) || null
  const [tab, setTab] = useState(role === 'owner' ? 'action' : 'all')
  const [search, setSearch] = useState('')
  const viewId = useId(), detailHeading = useRef(null)
  const attention = h => getHmoAttention(h, state.clock)
  const shown = hmoCasesForView(live, tab, state.clock).filter(h => (h.patientName || patientName(h.patientId, state.patients)).toLowerCase().includes(search.trim().toLowerCase()))
  const [busy, setBusy] = useState(false)
  const [operation, setOperation] = useState(null)
  const [form, setForm] = useState({})
  const [decision, setDecision] = useState(null)

  // One Idempotency-Key per confirm attempt; a retry of the same dialog reuses it.
  const run = async (command, message, after) => {
    setBusy(true)
    const result = await command()
    setBusy(false)
    if (!result.ok) { toast(result.message, 'warning'); if (['conflict', 'validation'].includes(result.kind)) await flow?.refresh?.(); return false }
    await flow?.refresh?.()
    toast(message, 'success'); after?.(result); return true
  }
  const operate = (mode, h, extra = {}) => { setOperation({ mode, caseId: h.id, key: commandKey() }); setForm({ method: '', note: '', nextAction: '', outcome: '', approvedAmount: '', providerReference: '', returned: [], documentLabel: '', reason: '', rule: '', ...extra }) }
  const current = () => live.find(h => h.id === operation?.caseId)
  const confirmOperation = () => {
    const h = current(); if (!h) return
    const { mode, key } = operation
    const commands = {
      submit: () => hmoApi.submitCase(h, { method: form.method, note: form.note }, key),
      contact: () => hmoApi.recordContact(h, { method: form.method, note: form.note, nextAction: form.nextAction }, key),
      response: () => hmoApi.recordResponse(h, { outcome: form.outcome, method: form.method, note: form.note, providerReference: form.providerReference, approvedAmount: form.approvedAmount, returnedRequirements: form.returned }, key),
      withdraw: () => hmoApi.withdrawCase(h, form.reason, key),
      requirement: () => hmoApi.validateRequirement(h, form.rule, form.documentLabel.trim(), key),
    }
    const messages = { submit: 'External submission recorded.', contact: 'Contact attempt recorded.', response: 'Externally received provider response recorded.', withdraw: 'HMO claim withdrawn; the visit continues as self-pay.', requirement: 'Requirement checked at the clinic.' }
    run(commands[mode], messages[mode], () => setOperation(null))
  }

  if (role === 'patient') return <PatientHmoPage store={store} context={context}/>
  return <>
    <PageHeader title="HMO Management" text={staff ? 'Server HMO cases for visits in your branches: memberships, requirements, external submission, provider responses and follow-up.' : 'Clinic-wide HMO case oversight (read-only).'}/>
    <Notice tone="info">No provider is contacted by this application. Staff record what happened outside it; a provider decision exists only once Staff record the response received from the provider.</Notice>

    {staff && <ClaimDecisions state={state} busy={busy} onOpen={d => run(() => hmoApi.openCase(d.visitId, commandKey()), 'HMO case opened.', r => setSelectedId(r.row?.data?.id || ''))} onSelfPay={d => setDecision({ ...d, reason: '', key: commandKey() })}/>}
    {staff && <MembershipPanel store={store} busy={busy} setBusy={setBusy}/>}

    {role === 'owner' && <div className="hmo-metrics">{[
      ['Pending', live.filter(h => pendingHmo(h)).length],
      ['Missing requirements', live.filter(h => attention(h).label === 'Missing requirements').length],
      ['Approved', live.filter(h => h.status === 'Approved').length],
      ['Needs attention', live.filter(h => attention(h).needsAction).length],
    ].map(([name, count]) => <div className="mini-stat" key={name}><span>{name}</span><b>{count}</b></div>)}</div>}
    <div className="hmo-tabs" role="group" aria-label="HMO case views">{(staff ? [['all', 'All Cases'], ['action', 'Needs Action'], ['followups', 'Follow-Ups']] : [['action', 'Needs Attention'], ['all', 'All Cases']]).map(([key, name]) => {
      const count = hmoCasesForView(live, key, state.clock).length
      return <button type="button" aria-pressed={tab === key} key={key} aria-describedby={`${viewId}-${key}`} onClick={() => { setTab(key); setSelectedId('') }}>{name}<span aria-hidden="true">{count}</span><span hidden id={`${viewId}-${key}`}>{count} {count === 1 ? 'case' : 'cases'}</span></button>
    })}</div>
    <div className="hmo-filters"><label>Search patient<input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Patient name"/></label></div>
    <div className="hmo-workspace">
      <section className="hmo-case-list" aria-label="HMO cases">
        {!shown.length && <Notice>{live.length ? 'No cases match this view.' : 'No server HMO cases are available in your scope.'}</Notice>}
        {shown.map(h => <button type="button" className={`hmo-case-row${selectedId === h.id ? ' selected' : ''}`} key={h.id} onClick={() => setSelectedId(h.id)} aria-pressed={selectedId === h.id}>
          <span className="hmo-case-identity"><b>{h.patientName || patientName(h.patientId, state.patients)}</b><small>{h.branch} • visit {h.clinicDate}</small></span>
          <span>{providerOf(h)}</span>
          <Status>{label(h)}</Status>
          <span className="hmo-case-age">{attention(h).elapsed !== null ? `${Math.floor(attention(h).elapsed)}h pending` : ''}</span>
          <span className="hmo-case-attention">{attention(h).label}</span><span aria-hidden="true">›</span>
        </button>)}
        {history.length > 0 && <details className="hmo-history"><summary>Earlier browser records ({history.length}) — read-only history, not used for billing</summary>
          {history.map(h => <button type="button" className={`hmo-case-row${selectedId === h.id ? ' selected' : ''}`} key={h.id} onClick={() => setSelectedId(h.id)}>
            <span className="hmo-case-identity"><b>{patientName(h.patientId, state.patients)}</b><small>Historical record</small></span><span>{providerOf(h)}</span><Status>{label(h)}</Status>
          </button>)}
        </details>}
      </section>
      {selected && <CaseDetail h={selected} staff={staff && selected.server} busy={busy} state={state} headingRef={detailHeading} onClose={() => setSelectedId('')} operate={operate}
        onEscalate={h => run(() => hmoApi.escalateCase(h, commandKey()), 'Case escalated for clinic attention.')}/>}
    </div>

    <Modal open={!!operation} onClose={() => !busy && setOperation(null)} title={{ submit: 'Record external submission', contact: 'Record clinic contact attempt', response: 'Record externally received provider response', withdraw: 'Withdraw HMO claim (self-pay)', requirement: 'Check requirement at the clinic' }[operation?.mode] || ''}>
      {operation && <>
        {operation.mode === 'requirement' && <><p>{RULES.find(([id]) => id === form.rule)?.[1]}</p><Field label="Document reference (optional)" hint="A label only — no file is stored."><input value={form.documentLabel} onChange={e => setForm({ ...form, documentLabel: e.target.value })}/></Field></>}
        {operation.mode === 'withdraw' && <><Notice tone="warning">Only before the first submission. The visit then continues as self-pay; this cannot be undone here.</Notice><Field label="Reason" required><textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}/></Field></>}
        {['submit', 'contact', 'response'].includes(operation.mode) && <Field label="Channel" required><select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}><option value="">Select channel</option>{METHODS.map(m => <option key={m}>{m}</option>)}</select></Field>}
        {operation.mode === 'response' && <>
          <Field label="Provider outcome received" required><select value={form.outcome} onChange={e => setForm({ ...form, outcome: e.target.value, approvedAmount: '', returned: [] })}><option value="">Select received outcome</option><option>Approved</option><option>Rejected</option><option>Returned</option></select></Field>
          {form.outcome === 'Approved' && <Field label="Approved amount (₱)" required hint="As stated by the provider, e.g. 1200.00. Billing caps it at the invoice amount."><input inputMode="decimal" value={form.approvedAmount} onChange={e => setForm({ ...form, approvedAmount: e.target.value })}/></Field>}
          {form.outcome === 'Returned' && <fieldset><legend>Requirements returned for correction</legend>{RULES.map(([id, name]) => <label className="check-control" key={id}><input type="checkbox" checked={form.returned.includes(id)} onChange={e => setForm({ ...form, returned: e.target.checked ? [...form.returned, id] : form.returned.filter(x => x !== id) })}/><span>{name}</span></label>)}</fieldset>}
          <Field label="Provider reference (optional)"><input value={form.providerReference} onChange={e => setForm({ ...form, providerReference: e.target.value })}/></Field>
        </>}
        {['submit', 'contact', 'response'].includes(operation.mode) && <Field label={operation.mode === 'response' ? 'Response details / pasted source text' : 'Internal tracking note / result'} required><textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })}/></Field>}
        {operation.mode === 'contact' && <Field label="Next action" required><input value={form.nextAction} onChange={e => setForm({ ...form, nextAction: e.target.value })}/></Field>}
        <div className="form-actions"><Button variant="ghost" disabled={busy} onClick={() => setOperation(null)}>Cancel</Button><Button disabled={busy} onClick={confirmOperation}>Save</Button></div>
      </>}
    </Modal>

    <Modal open={!!decision} onClose={() => !busy && setDecision(null)} title="Proceed as self-pay">{decision && <>
      <p><b>{decision.patientName}</b> • visit {decision.clinicDate} • {decision.branchName}</p>
      <Notice tone="warning">This records that no HMO claim will be made for this visit (a final Withdrawn decision). Billing can then continue as self-pay.</Notice>
      <Field label="Reason" required><textarea value={decision.reason} onChange={e => setDecision({ ...decision, reason: e.target.value })}/></Field>
      <div className="form-actions"><Button variant="ghost" disabled={busy} onClick={() => setDecision(null)}>Cancel</Button><Button disabled={busy} onClick={() => run(() => hmoApi.recordSelfPay(decision.visitId, decision.reason.trim(), decision.key), 'Self-pay decision recorded.', () => setDecision(null))}>Record self-pay decision</Button></div>
    </>}</Modal>
  </>
}

function ClaimDecisions({ state, busy, onOpen, onSelfPay }) {
  const rows = state.claimDecisions || []
  return <section className="hmo-case-detail" aria-label="Claim decisions needed">
    <h2 className="hmo-section-title">Claim decisions needed</h2>
    <p className="block-muted">Visits whose Patient has an HMO membership on file but no HMO case yet. Billing is held until you open a case or record self-pay.</p>
    {!rows.length ? <Notice>No visits need a claim decision.</Notice> : rows.map(d => <div className="clinical-history" key={d.visitId}>
      <div><b>{d.patientName}</b><small className="block-muted">Visit {d.clinicDate} • {d.branchName}{d.appointmentCode ? ` • ${d.appointmentCode}` : ' • Walk-in'}</small></div>
      <div className="row-actions"><Button size="sm" disabled={busy} onClick={() => onOpen(d)}>Open HMO case</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => onSelfPay(d)}>Proceed self-pay</Button></div>
    </div>)}
  </section>
}

function MembershipPanel({ store, busy, setBusy }) {
  const { toast, state } = store
  // Only server Visits in this Staff member's branch scope are offered; the server derives the Patient from the Visit.
  const visits = (state.visits || []).filter(v => v.server).slice().sort((a, b) => String(b.arrivedAt || '').localeCompare(String(a.arrivedAt || '')))
  const [visitId, setVisitId] = useState('')
  const visit = visits.find(v => v.id === visitId) || null
  const [membership, setMembership] = useState(null)
  const [form, setForm] = useState({ providerName: '', memberNumber: '' })
  const [key, setKey] = useState(null)
  const load = async v => {
    setVisitId(v?.id || ''); setMembership(null); setForm({ providerName: '', memberNumber: '' }); setKey(commandKey())
    if (!v) return
    const result = await hmoApi.loadMembership(v.patientPublicId)
    if (!result.ok) return toast(result.message, 'warning')
    setMembership(result.membership)
  }
  const save = async end => {
    setBusy(true)
    const active = membership?.active?.id ?? null
    const result = end ? await hmoApi.endMembership(visit.id, active, key) : await hmoApi.setMembership(visit.id, { providerName: form.providerName.trim(), memberNumber: form.memberNumber.trim(), expectedActiveId: active }, key)
    setBusy(false)
    if (!result.ok) { toast(result.message, 'warning'); if (result.code === 'stale_membership') await load(visit); return }
    setMembership(result.membership); setForm({ providerName: '', memberNumber: '' }); setKey(commandKey())
    await store.appointmentFlow?.refresh?.()
    toast(end ? 'HMO membership ended.' : 'HMO membership saved.', 'success')
  }
  return <details className="hmo-case-detail hmo-membership"><summary><b>Patient HMO membership</b></summary>
    <p className="block-muted">Recorded on the clinic server for the Patient of a visit in your branches. The provider name and member number are entered by Staff; changing them keeps the earlier record in the history.</p>
    {visits.length ? <Field label="Visit"><select value={visitId} onChange={e => load(visits.find(v => v.id === e.target.value))}><option value="">Select a visit</option>{visits.map(v => <option key={v.id} value={v.id}>{v.patientName} ({v.patientCode}) • visit {v.clinicDate}</option>)}</select></Field>
      : <Notice>No visits in your branches right now. A membership is recorded from the Patient's visit.</Notice>}
    {visit && membership && <>
      <p><b>{visit.patientName}</b> — {membership.active ? <>Active: {membership.active.provider_name} • {membership.active.member_number}</> : 'No active HMO membership'}</p>
      <div className="form-grid">
        <Field label="Provider name" required><input value={form.providerName} onChange={e => setForm({ ...form, providerName: e.target.value })}/></Field>
        <Field label="Member number" required><input value={form.memberNumber} onChange={e => setForm({ ...form, memberNumber: e.target.value })}/></Field>
        <div className="form-actions span-2"><Button disabled={busy || !form.providerName.trim() || !form.memberNumber.trim()} onClick={() => save(false)}>{membership.active ? 'Replace membership' : 'Save membership'}</Button>{membership.active && <Button variant="ghost" disabled={busy} onClick={() => save(true)}>End membership</Button>}</div>
      </div>
      {membership.history.length > 0 && <ul className="hmo-timeline">{membership.history.map(m => <li key={m.id}><b>{m.provider_name} • {m.member_number}</b><time>{m.status === 'active' ? `Active since ${stamp(m.created_at)}` : `Ended ${stamp(m.ended_at)}`}</time></li>)}</ul>}
    </>}
  </details>
}

function CaseDetail({ h, staff, busy, state, headingRef, onClose, operate, onEscalate }) {
  const requirements = h.requirements || []
  const events = h.events || []
  const contacted = (h.contacts || []).some(c => c.submissionCycle === h.submissionCycle)
  const due = h.followUpDueAt && Date.parse(h.followUpDueAt) <= Date.parse(state.clock.timestamp)
  return <section className="hmo-case-detail" aria-label="HMO case detail">
    <div className="hmo-detail-head"><div><small>{h.server ? 'Case detail' : 'Historical browser record (read-only)'}</small><h2 ref={headingRef} tabIndex={-1}>{h.patientName || patientName(h.patientId, state.patients)}</h2><Status>{label(h)}</Status></div><button type="button" onClick={onClose} aria-label="Close case detail">×</button></div>
    {!h.server && <Notice tone="info">Recorded in an earlier browser-only version. It is not a server HMO case and never affects billing.</Notice>}
    <div className="hmo-detail-grid">
      <section><h3>Visit</h3><p>{h.branch} • {h.clinicDate || '—'}{h.appointmentCode ? ` • ${h.appointmentCode}` : ''}</p></section>
      <section><h3>HMO Provider</h3><p>{providerOf(h)}</p>{h.memberId && <p>Member ID: {h.memberId}</p>}</section>
      <section><h3>Requirements</h3><ul className="hmo-checklist">{requirements.map(r => <li key={r.id}><span aria-hidden="true">{r.state === 'Validated locally' ? '✓' : '!'}</span><div><b>{r.label}</b><small>{r.state}{r.documentLabel ? ` • ${r.documentLabel}` : ''}</small></div>
        {staff && ['Missing Requirements', 'Ready for Submission', 'Returned'].includes(h.status) && r.state !== 'Validated locally' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => operate('requirement', h, { rule: r.ruleId })}>Check {r.label}</Button>}</li>)}</ul></section>
      <section><h3>Request status</h3><p>Current status: <b>{label(h)}</b></p><p>Submitted: {h.submittedAt ? stamp(h.submittedAt) : 'Not submitted'}{h.submissionCycle > 1 ? ` (submission ${h.submissionCycle})` : ''}</p>
        {h.status === 'Approved' && <p>Approved amount: <b>{formatAmount(h.approvedAmount)}</b></p>}
        {(h.responses || []).map(r => <p key={r.id}><b>Provider response: {r.outcome}</b>{r.approvedAmount ? ` • ${formatAmount(r.approvedAmount)}` : ''}<br/>{stamp(r.recordedAt)} · {r.method}{r.providerReference ? ` · Ref ${r.providerReference}` : ''}<br/>{r.note}</p>)}
        {staff && <div className="row-actions">
          {h.status === 'Ready for Submission' && <Button size="sm" disabled={busy} onClick={() => operate('submit', h)}>{h.submissionCycle ? 'Record Resubmission' : 'Record External Submission'}</Button>}
          {pendingHmo(h) && <Button size="sm" disabled={busy} onClick={() => operate('response', h)}>Record Provider Response</Button>}
          {['Missing Requirements', 'Ready for Submission'].includes(h.status) && !h.submissionCycle && <Button size="sm" variant="ghost" disabled={busy} onClick={() => operate('withdraw', h)}>Withdraw (self-pay)</Button>}
        </div>}
      </section>
      <section><h3>Follow-Up</h3>
        {pendingHmo(h) && <p>Follow-up due: {stamp(h.followUpDueAt)}{due ? ' — due now' : ''}</p>}
        <p className="block-muted">Project follow-up threshold: 12 hours after submission. This is a clinic-side project setting, not a provider promise; nothing is sent or escalated automatically.</p>
        {(h.contacts || []).map(c => <p key={c.id}><b>{stamp(c.at)} · {c.method}</b><br/>{c.note}<br/>Next action: {c.nextAction}</p>)}
        {staff && pendingHmo(h) && <div className="row-actions"><Button size="sm" variant="ghost" disabled={busy} onClick={() => operate('contact', h)}>Record Contact Attempt</Button>{h.status === 'Pending' && due && contacted && <Button size="sm" variant="danger" disabled={busy} onClick={() => onEscalate(h)}>Escalate Case</Button>}</div>}
      </section>
      {h.server && <section><h3>Case history</h3>{events.length ? <ol className="hmo-timeline">{events.map((e, i) => <li key={i}><b>{EVENT_LABEL[e.kind] || e.kind}{e.outcome ? `: ${e.outcome}` : ''}</b><time>{stamp(e.occurred_at)}{e.actor?.name ? ` • ${e.actor.name}` : ''}</time>{e.kind === 'withdrawal' && e.note && <small className="block-muted">Reason: {e.note}</small>}</li>)}</ol> : <p>{h.summaryOnly ? 'History is visible to clinic Staff.' : 'No events.'}</p>}</section>}
    </div>
  </section>
}
