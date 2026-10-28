import React, { useEffect, useState } from 'react'
import { Button, Field, SelectWithOther } from '../../components.jsx'
import { addDependent, inviteToClaim, myDependents } from '../../api-client.js'

/**
 * Parents and guardians (R2-12): children or others in your care. You book, are reminded and pay for them; they need no ID or
 * email. At 18 you can invite them to claim their own account, and then you no longer manage their record.
 */
/** The Family page of the portal (reachable from the navigation). */
export function FamilyPage() {
  return <div className="pp-page"><Family/></div>
}

export function Family() {
  const [rows, setRows] = useState(null), [adding, setAdding] = useState(false), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', relationship: 'Child', relationship_other: '', consent: false })
  const [inviting, setInviting] = useState(null), [inviteEmail, setInviteEmail] = useState('')
  const load = () => myDependents().then(r => { if (r.ok) setRows(r.data || []) })
  useEffect(() => { load() }, [])
  if (!rows) return null
  const add = async e => {
    e.preventDefault()
    setBusy(true); setNote('')
    const r = await addDependent(form)
    setBusy(false)
    if (!r.ok) return setNote((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'Not saved.')
    setAdding(false); setForm({ first_name: '', last_name: '', date_of_birth: '', relationship: 'Child', relationship_other: '', consent: false }); load()
  }
  const invite = async (e, d) => {
    e.preventDefault()
    setBusy(true); setNote('')
    const r = await inviteToClaim(d.id, inviteEmail)
    setBusy(false)
    if (!r.ok) return setNote((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'Not sent.')
    setInviting(null); setInviteEmail('')
    // The email may be suppressed (a test address) or fail: say what the server reports, not "sent".
    const outcome = r.data?.status === 'transport_accepted' ? `A one-time link was emailed to ${inviteEmail}. It works once and expires.` : `${r.data?.message || 'The email was not sent.'} Check the email address and try again.`
    setNote(`${outcome} You keep managing ${d.first_name}’s record until they activate their own account.`)
  }
  return <section className="pp-card pp-fade" aria-labelledby="pp-family">
    <p className="pp-eyebrow" id="pp-family">Family</p>
    <p className="pp-hint">Children or others in your care. You can book, get reminders and pay for them. They need no ID or email; your ID is the one checked at the clinic.</p>
    {rows.length > 0 && <ul className="pp-family-list">{rows.map(d => <li key={d.id}><span><b>{d.name}</b> · {d.relationship}{d.relationship_other ? ` (${d.relationship_other})` : ''}{d.age !== null && d.age !== undefined ? ` · ${d.age} years old` : ''}</span>
      {!d.minor && !d.has_account && inviting !== d.id && <button type="button" className="link-button" onClick={() => { setInviting(d.id); setInviteEmail(''); setNote('') }}>Invite to their own account</button>}
      {inviting === d.id && <form className="pp-family-invite" onSubmit={e => invite(e, d)}>
        <Field label={`${d.first_name}’s own email`} hint="We email a one-time link there. Only they can then set the password."><input type="email" autoComplete="off" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}/></Field>
        <div className="pp-row-actions"><Button type="submit" size="sm" disabled={busy || !inviteEmail}>{busy ? 'Sending…' : 'Send the link'}</Button><button type="button" className="link-button" onClick={() => setInviting(null)}>Cancel</button></div>
      </form>}</li>)}</ul>}
    {adding ? <form onSubmit={add} className="pp-form">
      <Field label="First name" required><input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}/></Field>
      <Field label="Last name" required><input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}/></Field>
      <Field label="Date of birth" required><input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}/></Field>
      <SelectWithOther label="Relationship" required value={form.relationship} onChange={v => setForm(f => ({ ...f, relationship: v }))} options={['Child', 'Daughter', 'Son', 'Grandchild', 'Ward', 'Parent', 'Other']} otherValue={form.relationship_other} onOtherChange={v => setForm(f => ({ ...f, relationship_other: v }))} placeholder="e.g., Niece, Nephew, Cousin"/>
      <label className="au-check"><input type="checkbox" checked={form.consent} onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}/> <span>I am their parent or guardian and agree that the clinic keeps their details for their dental care (<a href="#privacy" target="_blank" rel="noreferrer">Privacy Policy</a>).</span></label>
      <Button type="submit" size="sm" disabled={busy || !form.consent || (form.relationship === 'Other' && !(form.relationship_other || '').trim())}>{busy ? 'Saving…' : 'Add to my family'}</Button>
    </form> : <Button size="sm" variant="soft" onClick={() => setAdding(true)}>Add a child or dependent</Button>}
    {note && <p className="pp-hint" role="status">{note}</p>}
  </section>
}

