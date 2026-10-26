import React, { useEffect, useState } from 'react'
import { Button, Card, ConfirmDialog, Field, Notice, Status, Table } from '../components.jsx'
import { DEFAULT_COUNTRY, normalizePhoneNumber } from '../phone.js'
import { INVITABLE_ROLES, cancelInvitation, deliveryLabel, deliveryNotice, fetchInvitations, resendInvitation, sendInvitation } from '../employee-invitations.js'

// M1 employee provisioning (Owner). The Owner invites a Staff member or Dentist by email (PI-01, PI-02). The invited
// person chooses their own password through the emailed link; nobody else ever sets or sees it. Every send outcome is shown
// exactly as the server reported it (M18): "accepted by the mail transport" is not "delivered".

const EMPTY = { role: 'staff', firstName: '', lastName: '', email: '', title: '', branchId: '', shiftStart: '', shiftEnd: '', licenseNo: '', specialty: '' }
const when = iso => (iso ? new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) : '—')

export function EmployeeInvitations({ store }) {
  const branches = store.state.branches || []
  const [form, setForm] = useState(EMPTY)
  const [phoneLocal, setPhoneLocal] = useState('')
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState(null)
  const [rows, setRows] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  const load = async () => {
    setStatus('loading'); setLoadError('')
    const result = await fetchInvitations()
    if (result.ok) { setRows(result.records); setStatus('ready') } else { setLoadError(result.message || 'Could not load invitations.'); setStatus('error') }
  }
  useEffect(() => { load() }, [])
  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors(e => ({ ...e, [key]: undefined })) }
  const fieldError = key => errors[key]?.[0]

  const submit = async () => {
    const phone = phoneLocal ? normalizePhoneNumber(DEFAULT_COUNTRY.dial, phoneLocal) : { ok: true, e164: '' }
    if (!phone.ok) { setErrors({ phone: [phone.reason] }); return }
    setSubmitting(true); setOutcome(null)
    const result = await sendInvitation({ ...form, phone: phone.e164 })
    setSubmitting(false)
    if (!result.ok) {
      const e = result.errors || {}
      setErrors({ ...e, firstName: e.first_name, lastName: e.last_name, branchId: e.branch_ref, shiftStart: e.shift_start, shiftEnd: e.shift_end, licenseNo: e.license_no })
      setOutcome({ tone: 'warning', title: 'Invitation not created', message: result.message || 'Check the highlighted fields.' })
      return
    }
    setRows(r => [result.record, ...r.filter(x => x.id !== result.record.id)])
    setForm(EMPTY); setPhoneLocal(''); setErrors({})
    setOutcome(deliveryNotice(result.delivery))
  }
  const resend = async row => {
    setBusy(row.id)
    const result = await resendInvitation(row.id)
    setBusy(null)
    if (!result.ok) return setOutcome({ tone: 'warning', title: 'Could not resend', message: result.message || 'Try again.' })
    setRows(r => r.map(x => x.id === row.id ? result.record : x))
    setOutcome({ ...deliveryNotice(result.delivery), title: `Resent to ${row.name}: ${deliveryNotice(result.delivery).title.toLowerCase()}` })
  }
  const cancel = async () => {
    const row = cancelTarget; setCancelTarget(null); setBusy(row.id)
    const result = await cancelInvitation(row.id)
    setBusy(null)
    if (!result.ok) return setOutcome({ tone: 'warning', title: 'Could not cancel', message: result.message || 'Try again.' })
    setRows(r => r.map(x => x.id === row.id ? result.record : x))
    setOutcome({ tone: 'info', title: 'Invitation cancelled', message: `${row.name}’s link no longer works. Resend reopens it with a new link.` })
  }

  return <>
    <Card className="top-gap" title="Invite an employee" subtitle="Staff and Dentists choose their own password from an emailed link. Only the Owner can invite.">
      <div className="form-grid">
        <Field label="Role" required><select value={form.role} onChange={e => set('role', e.target.value)}>{INVITABLE_ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
        <Field label="Email" required error={fieldError('email')}><input type="email" autoComplete="off" value={form.email} onChange={e => set('email', e.target.value)}/></Field>
        <Field label="First name" required error={fieldError('firstName')}><input value={form.firstName} onChange={e => set('firstName', e.target.value)}/></Field>
        <Field label="Last name" required error={fieldError('lastName')}><input value={form.lastName} onChange={e => set('lastName', e.target.value)}/></Field>
        {form.role === 'staff'
          ? <Field label="Job title" required hint="Shown on the profile. A title never grants a permission." error={fieldError('title')}><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Receptionist"/></Field>
          : <><Field label="License number" error={fieldError('licenseNo')}><input value={form.licenseNo} onChange={e => set('licenseNo', e.target.value)}/></Field>
            <Field label="Specialty"><input value={form.specialty} onChange={e => set('specialty', e.target.value)}/></Field></>}
        <Field label="Mobile number" hint={`Optional. 10 digits after ${DEFAULT_COUNTRY.dial}.`} error={fieldError('phone')}><div className="phone-field"><span className="phone-field-code" aria-hidden="true">{DEFAULT_COUNTRY.dial}</span><input type="tel" inputMode="numeric" aria-label="Mobile number" value={phoneLocal} onChange={e => setPhoneLocal(e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, DEFAULT_COUNTRY.digits))}/></div></Field>
        <Field label="Branch" required hint="Where they will work. Branch access for Staff is granted separately." error={fieldError('branchId')}><select value={form.branchId} onChange={e => set('branchId', e.target.value)}><option value="">Choose a branch</option>{branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Shift starts" required error={fieldError('shiftStart')}><input type="time" value={form.shiftStart} onChange={e => set('shiftStart', e.target.value)}/></Field>
        <Field label="Shift ends" required error={fieldError('shiftEnd')}><input type="time" value={form.shiftEnd} onChange={e => set('shiftEnd', e.target.value)}/></Field>
        <Button className="span-2" onClick={submit} disabled={submitting}>{submitting ? 'Sending invitation…' : 'Send invitation'}</Button>
      </div>
      <p className="muted-copy top-gap">New employees start as not available for scheduling and with no services assigned; set those after they join.</p>
    </Card>
    {outcome && <div className="top-gap" aria-live="polite"><Notice tone={outcome.tone} title={outcome.title}>{outcome.message}</Notice></div>}
    <Card className="top-gap" title="Open invitations" subtitle="Invited and cancelled invitations that have not been accepted.">
      {status === 'loading' ? <p className="muted-copy" role="status">Loading invitations…</p>
        : status === 'error' ? <Notice tone="warning" title="Couldn’t load invitations">{loadError} <Button size="sm" variant="ghost" onClick={load}>Try again</Button></Notice>
        : <Table rows={rows} empty="No open invitations." columns={[
          { key: 'name', label: 'Name', render: r => <div><b>{r.name}</b><small className="block-muted">{r.email}</small></div> },
          { key: 'role', label: 'Role', render: r => `${r.role === 'dentist' ? 'Dentist' : 'Staff'}${r.title ? ` · ${r.title}` : ''}${r.branchName ? ` · ${r.branchName}` : ''}` },
          { key: 'status', label: 'Status', render: r => <Status>{r.status === 'Revoked' ? 'Cancelled' : r.expired ? 'Expired' : 'Invited'}</Status> },
          { key: 'expires', label: 'Link valid until', render: r => (r.status === 'Invited' ? when(r.expiresAt) : '—') },
          { key: 'delivery', label: 'Last send', render: r => deliveryLabel(r.lastDelivery) },
          { key: 'actions', label: 'Actions', render: r => <div className="row-actions">
            <Button size="sm" variant="soft" disabled={busy === r.id} onClick={() => resend(r)}>{r.status === 'Revoked' ? 'Reopen and send' : 'Resend'}</Button>
            {r.status === 'Invited' && <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => setCancelTarget(r)}>Cancel</Button>}
          </div> },
        ]}/>}
    </Card>
    <ConfirmDialog open={!!cancelTarget} title="Cancel this invitation?" confirmLabel="Cancel invitation" cancelLabel="Keep invitation" onConfirm={cancel} onCancel={() => setCancelTarget(null)}>
      <p>{cancelTarget?.name}’s link will stop working. You can reopen it later with a new link.</p>
    </ConfirmDialog>
  </>
}
