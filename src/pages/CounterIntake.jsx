import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Modal } from '../components.jsx'
import { dentistName } from '../logic.js'
import { branchPosterUrl, cancelIntake, confirmIntake, getPatientRecord, intakeCode, pendingIntake, offerOnlineAccount, refreshIntakeCode, verifyPatientId } from '../api-client.js'

const firstError = r => (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] || r.message : r.message) || 'That did not work. Refresh and try again.'
const FIELDS = [['first_name', 'First name'], ['last_name', 'Last name'], ['date_of_birth', 'Date of birth', 'date'], ['sex', 'Sex'], ['phone', 'Mobile'], ['email', 'Email'], ['address', 'Address']]
const age = dob => { if (!dob) return null; const b = new Date(`${dob}T00:00:00Z`), n = new Date(); let a = n.getUTCFullYear() - b.getUTCFullYear(); if (n.getUTCMonth() < b.getUTCMonth() || (n.getUTCMonth() === b.getUTCMonth() && n.getUTCDate() < b.getUTCDate())) a--; return a }

/** Front desk: today's counter code (for the patients' phones and the kiosk), the poster, and the kiosk link. */
export function CounterCode({ toast = () => {} }) {
  const [data, setData] = useState(null), [busy, setBusy] = useState(false)
  useEffect(() => { intakeCode().then(r => { if (r.ok) setData(r.data) }) }, [])
  if (!data) return null
  const refresh = async () => {
    setBusy(true)
    const r = await refreshIntakeCode(data.branch.id)
    setBusy(false)
    if (r.ok) { setData(d => ({ ...d, ...r.data })); toast('New code. The old one no longer works.', 'success') } else toast(firstError(r), 'warning')
  }
  return <Card className="ci-code" title="Counter registration" subtitle={`${data.branch.name} · patients scan the counter poster`}>
    <p className="ci-code-label">Today’s code</p>
    <p className="ci-code-value" aria-live="polite">{data.code}</p>
    <p className="au-muted">Patients type it to join today’s queue, so nobody can join from home. It changes every day.</p>
    <div className="au-actions">
      <Button size="sm" variant="soft" disabled={busy} onClick={refresh}>New code</Button>
      <a className="btn ghost sm" href={branchPosterUrl(data.branch.id)} target="_blank" rel="noreferrer"><span>Counter poster (PDF)</span></a>
      <a className="btn ghost sm" href={`#kiosk/${data.branch.id}/${data.code}`} target="_blank" rel="noreferrer"><span>Open kiosk mode</span></a>
    </div>
  </Card>
}

/**
 * Self-registered patients waiting for the front desk ("Self-registered: verify ID"), on the Check-In page and the queue.
 * Every field is filled in by the patient; staff check the physical ID, correct anything (audited) and confirm. A possible
 * existing patient from ANY branch is shown ("Record found from Branch X") with "Use this record"; nothing is merged by itself.
 */
export function SelfRegistered({ toast = () => {}, compact = false, onChanged, store }) {
  const [rows, setRows] = useState([]), [idTypes, setIdTypes] = useState({}), [open, setOpen] = useState(null)
  const load = () => pendingIntake().then(r => { if (r.ok) { setRows(r.data || []); setIdTypes(r.meta?.id_types || {}) } })
  useEffect(() => {
    load()
    const t = setInterval(() => { if (document.visibilityState === 'visible') load() }, 15000)
    return () => clearInterval(t)
  }, [])
  if (!rows.length) return null
  const name = s => (s.channel === 'account' ? s.account?.visit_for_name || s.account?.name : `${s.self?.first_name || ''} ${s.self?.last_name || ''}`.trim())
  return <Card className="ci-self" title={`Self-registered: verify ID (${rows.length})`} subtitle="Filled in by the patient on their phone or the kiosk. Check the ID, then confirm.">
    <ul className="fd-list">{rows.map(s => {
      const minorDep = (s.dependents || []).find((d, i) => s.visit_for === `dependent:${i}`)
      return <li key={s.id}>
        <div><b>{name(s)}{s.join_queue && <span className="fd-badge is-info">Joining today’s queue</span>}{s.duplicates?.length > 0 && <span className="fd-badge is-late">Possible existing patient</span>}
          {(minorDep?.minor || s.account?.visit_for_minor) && <span className="fd-badge is-late">Minor: guardian {s.channel === 'account' ? s.account?.name : `${s.self?.first_name} ${s.self?.last_name}`}</span>}</b>
          <span>{s.time} · {s.reference} · {s.channel === 'account' ? 'signed in with their account' : s.channel === 'kiosk' ? 'kiosk' : 'own phone'}{s.id_type ? ` · scanned ${idTypes[s.id_type] || s.id_type}` : ''}{minorDep ? ` · visit for ${minorDep.first_name}` : ''}</span></div>
        {!compact && <Button size="sm" onClick={() => setOpen(s)}>Review and confirm</Button>}
      </li>
    })}</ul>
    {open && <ReviewDialog row={open} idTypes={idTypes} toast={toast} store={store} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); onChanged?.() }}/>}
  </Card>
}

function ReviewDialog({ row, idTypes, toast, onClose, onDone, store }) {
  const account = row.channel === 'account'
  const [fields, setFields] = useState(() => ({ ...(row.self || {}) }))
  const [use, setUse] = useState(''), [idType, setIdType] = useState(row.id_type || 'philid'), [idChecked, setIdChecked] = useState(false), [busy, setBusy] = useState(''), [err, setErr] = useState('')
  // A walk-in enters a Dentist's queue only with a responsible Dentist (existing rule): choose the service and the Dentist.
  const state = store?.state || {}
  const services = (state.services || []).filter(sv => sv.status === 'Active' && (state.branchServices || []).some(bs => bs.branchId === row.branch_ref && bs.serviceId === sv.id && bs.active !== false))
  const [serviceId, setServiceId] = useState(''), [dentistId, setDentistId] = useState('')
  const dentists = (state.dentists || []).filter(d => (d.branchIds || []).includes(row.branch_ref) && (!serviceId || (d.serviceIds || []).includes(serviceId)) && d.available !== false)
  const corrections = Object.fromEntries(FIELDS.map(([k]) => k).filter(k => (fields[k] ?? '') !== (row.self?.[k] ?? '')).map(k => [k, fields[k] || null]))
  const confirm = async () => {
    setBusy('confirm'); setErr('')
    const r = await confirmIntake(row.id, { use_patient: use || null, corrections: use ? {} : corrections, id_verified: idChecked, id_type: idType,
      ...(row.join_queue && serviceId ? { service_ref: serviceId } : {}), ...(row.join_queue && serviceId && dentistId ? { dentist_ref: dentistId } : {}) })
    setBusy('')
    if (!r.ok) return setErr(firstError(r))
    toast(`${r.data.patient.name} (${r.data.patient.code}) confirmed${r.data.visit_id ? ' and added to today’s queue' : ''}.`, 'success'); onDone()
  }
  const cancel = async () => {
    setBusy('cancel')
    const r = await cancelIntake(row.id)
    setBusy('')
    if (!r.ok) return setErr(firstError(r))
    toast('Registration removed.', 'success'); onDone()
  }
  const holder = account ? row.account?.name : `${row.self?.first_name} ${row.self?.last_name}`
  return <Modal open wide title={`Confirm ${row.reference}`} subtitle={account ? `${holder} signed in with their account` : 'Check the details against the ID. Correct anything here instead of retyping.'} onClose={onClose}>
    {!account && row.duplicates?.length > 0 && <div className="ci-dupes" role="region" aria-label="Possible existing patient">
      <p><b>Possible existing patient</b> (same name and birth date, and the same phone or email). Nothing is merged automatically.</p>
      {row.duplicates.map(d => <label key={d.patient_id} className="ci-dupe"><input type="radio" name="use" checked={use === d.patient_id} onChange={() => setUse(d.patient_id)}/>
        <span><b>{d.name}</b> · {d.code} · <b>Record found from {d.found_from || 'this clinic'}</b>{d.has_account ? ' · has an online account' : ''}{d.id_verified ? ' · ID checked before' : ''}</span></label>)}
      <label className="ci-dupe"><input type="radio" name="use" checked={use === ''} onChange={() => setUse('')}/><span>Create a new patient record</span></label>
    </div>}
    {!account && <div className="ci-fields">{FIELDS.map(([k, label, type]) => <Field key={k} label={label} hint={row.scanned_fields?.includes(k) ? 'Read from the patient’s ID on their phone' : null}>
      <input type={type || 'text'} value={fields[k] || ''} disabled={!!use} className={row.scanned_fields?.includes(k) ? 'from-id' : ''} onChange={e => setFields(f => ({ ...f, [k]: e.target.value }))}/>
    </Field>)}
      <p className="au-muted">Emergency contact: {row.self?.emergency_contact?.name} · {row.self?.emergency_contact?.phone}</p>
      {(row.dependents || []).map((d, i) => <p key={i} className="au-muted">Dependent: <b>{d.first_name} {d.last_name}</b> · born {d.date_of_birth}{d.minor ? ` · minor (age ${age(d.date_of_birth)}), guardian ${holder}` : ''} · {d.relationship}</p>)}
      {Object.keys(corrections).length > 0 && !use && <p className="au-muted">You changed: {Object.keys(corrections).join(', ')} (recorded in the audit trail, field names only).</p>}
    </div>}
    {row.join_queue && <p className="au-muted">If the patient already has a booking today at this branch, that booking is checked in (its Dentist’s queue) and the choice below is not used.</p>}
    {row.join_queue && <div className="ci-fields">
      <Field label="Service today" hint="Optional"><select value={serviceId} onChange={e => { setServiceId(e.target.value); setDentistId('') }}><option value="">Not chosen yet</option>{services.map(sv => <option key={sv.id} value={sv.id}>{sv.name}</option>)}</select></Field>
      <Field label="Dentist" hint="Any available: the Dentist for this service with the shortest queue now"><select value={dentistId} disabled={!serviceId} onChange={e => setDentistId(e.target.value)}><option value="">Any available (shortest queue)</option>{dentists.map(d => <option key={d.id} value={d.id}>{dentistName(d.id, state.dentists)}</option>)}</select></Field>
    </div>}
    <div className="ci-id">
      <Field label="ID shown"><select value={idType} onChange={e => setIdType(e.target.value)}>{Object.entries(idTypes).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <label className="au-check"><input type="checkbox" checked={idChecked} onChange={e => setIdChecked(e.target.checked)}/> I checked this ID in person (only the type, your name and the time are saved; never the number or a photo)</label>
    </div>
    {err && <p className="au-error" role="alert">{err}</p>}
    <div className="form-actions">
      <Button variant="ghost" disabled={!!busy} onClick={cancel}>Remove</Button>
      <Button disabled={!!busy} onClick={confirm}>{busy === 'confirm' ? 'Confirming…' : row.join_queue ? 'Confirm and add to today’s queue' : 'Confirm'}</Button>
    </div>
  </Modal>
}

const ID_TYPES = { philid: 'PhilID / ePhilID', drivers_license: 'Driver’s license', umid: 'UMID', passport: 'Passport', postal: 'Postal ID', prc: 'PRC ID', voters: 'Voter’s ID', senior: 'Senior citizen ID', other: 'Other valid ID' }

/** One click at Check-In: the patient's physical ID was checked (first visit). Only the type, who and when are saved. */
/**
 * "Offer online account": after the ID check, staff confirm the patient's email with them and a one-time link is emailed (works
 * once, expires). This is the only way a record registered without an email gets an online account.
 */
function OfferAccount({ patientId, email: stored, toast }) {
  const [open, setOpen] = useState(false), [email, setEmail] = useState(stored || ''), [busy, setBusy] = useState(false), [sent, setSent] = useState(false)
  if (sent) return <p className="au-muted">Online account offered: a one-time link was emailed.</p>
  if (!open) return <Button size="sm" variant="soft" onClick={() => setOpen(true)}>Offer online account</Button>
  const go = async () => {
    setBusy(true)
    const r = await offerOnlineAccount(patientId, { email })
    setBusy(false)
    if (!r.ok) return toast(firstError(r), 'warning')
    setSent(true)
    toast(r.data?.message || 'A one-time link was emailed.', 'success')
  }
  return <div className="au-actions"><label className="sr-only" htmlFor={`offer-${patientId}`}>Patient’s email (confirm it with them)</label>
    <input id={`offer-${patientId}`} type="email" placeholder="Confirm the patient’s email with them" value={email} onChange={e => setEmail(e.target.value)}/>
    <Button size="sm" disabled={busy || !email} onClick={go}>Email a one-time link</Button></div>
}

export function IdCheck({ patientId, toast = () => {} }) {
  const [record, setRecord] = useState(null), [type, setType] = useState('philid'), [busy, setBusy] = useState(false)
  useEffect(() => { setRecord(null); getPatientRecord(patientId).then(r => { if (r.ok) setRecord(r.data) }) }, [patientId])
  if (!record) return null
  const minor = record.minor ? <p className="fd-badge is-late">Minor{record.guardians?.length ? `: guardian ${record.guardians.map(g => g.name).join(', ')}` : ': no guardian linked yet'}</p> : null
  if (record.id_check) return <div className="ci-idcheck">{minor}<p className="au-muted">ID checked: {ID_TYPES[record.id_check.type] || record.id_check.type}{record.id_check.by ? ` by ${record.id_check.by}` : ''}.</p>
    {!record.has_online_account && !record.minor && <OfferAccount patientId={patientId} email={record.email} toast={toast}/>}</div>
  const go = async () => {
    setBusy(true)
    const r = await verifyPatientId(patientId, { id_type: type })
    setBusy(false)
    if (!r.ok) return toast(firstError(r), 'warning')
    toast('ID check recorded (type only).', 'success')
    setRecord(x => ({ ...x, id_check: { type, by: 'you' } }))
  }
  return <div className="ci-idcheck">{minor}
    <p><b>First visit: check the ID.</b> {record.minor ? 'For a minor, check the guardian’s ID.' : ''}</p>
    <div className="au-actions"><select aria-label="ID shown" value={type} onChange={e => setType(e.target.value)}>{Object.entries(ID_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <Button size="sm" variant="soft" disabled={busy} onClick={go}>ID checked</Button></div>
  </div>
}
