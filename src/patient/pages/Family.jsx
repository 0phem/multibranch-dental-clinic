import React, { useEffect, useState } from 'react'
import { Button, Field } from '../../components.jsx'
import { addDependent, inviteToClaim, myDependents } from '../../api-client.js'

/**
 * Parents and guardians (R2-12): children or others in your care. You book, are reminded and pay for them; they need no ID or
 * email. At 18 you can invite them to claim their own account, and then you no longer manage their record.
 */
export function Family() {
  const [rows, setRows] = useState(null), [adding, setAdding] = useState(false), [note, setNote] = useState(''), [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ first_name: '', last_name: '', date_of_birth: '', relationship: 'Child', consent: false })
  const load = () => myDependents().then(r => { if (r.ok) setRows(r.data || []) })
  useEffect(() => { load() }, [])
  if (!rows) return null
  const add = async e => {
    e.preventDefault()
    setBusy(true); setNote('')
    const r = await addDependent(form)
    setBusy(false)
    if (!r.ok) return setNote((r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message) || 'Not saved.')
    setAdding(false); setForm({ first_name: '', last_name: '', date_of_birth: '', relationship: 'Child', consent: false }); load()
  }
  const invite = async d => {
    const email = window.prompt(`Email for ${d.first_name}'s own account:`)
    if (!email) return
    const r = await inviteToClaim(d.id, email)
    setNote(r.ok ? `Invitation sent to ${email}. Once ${d.first_name} activates the account, you no longer manage their record.` : (r.kind === 'validation' ? Object.values(r.errors || {})[0]?.[0] : r.message))
  }
  return <section className="pp-card pp-fade" aria-labelledby="pp-family">
    <p className="pp-eyebrow" id="pp-family">Family</p>
    <p className="pp-hint">Children or others in your care. You can book, get reminders and pay for them. They need no ID or email; your ID is the one checked at the clinic.</p>
    {rows.length > 0 && <ul className="pp-family-list">{rows.map(d => <li key={d.id}><b>{d.name}</b> · {d.relationship}{d.minor ? ` · ${d.age} years old` : ''}
      {!d.minor && !d.has_account && <button type="button" className="link-button" onClick={() => invite(d)}>Invite to their own account</button>}</li>)}</ul>}
    {adding ? <form onSubmit={add} className="pp-form">
      <Field label="First name" required><input value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}/></Field>
      <Field label="Last name" required><input value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}/></Field>
      <Field label="Date of birth" required><input type="date" value={form.date_of_birth} onChange={e => setForm(f => ({ ...f, date_of_birth: e.target.value }))}/></Field>
      <Field label="Relationship" required><select value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}>{['Child', 'Daughter', 'Son', 'Grandchild', 'Ward', 'Parent', 'Other'].map(r => <option key={r}>{r}</option>)}</select></Field>
      <label className="au-check"><input type="checkbox" checked={form.consent} onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))}/> <span>I am their parent or guardian and agree that the clinic keeps their details for their dental care (<a href="#privacy" target="_blank" rel="noreferrer">Privacy Policy</a>).</span></label>
      <Button type="submit" size="sm" disabled={busy || !form.consent}>{busy ? 'Saving…' : 'Add to my family'}</Button>
    </form> : <Button size="sm" variant="soft" onClick={() => setAdding(true)}>Add a child or dependent</Button>}
    {note && <p className="pp-hint" role="status">{note}</p>}
  </section>
}

