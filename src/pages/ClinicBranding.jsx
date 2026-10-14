import React, { useEffect, useState } from 'react'
import { Button, Card, Field, Notice, PageHeader } from '../components.jsx'
import { applyBranding } from '../clinic-config.js'
import { checkLogoFile } from '../logo-check.js'
import { getBrandingSettings, resetBrandingLogo, updateBranchBir, updateBrandingSettings, uploadBrandingLogo } from '../api-client.js'

// White-label settings (decision 12), Owner only. Everything here is stored on the server and applies to every email, PDF and the
// Patient Portal without a code change. The server validates again; these checks only give earlier, friendlier feedback.
const IDENTITY = [['name', 'Clinic name', 'Shown in emails, PDFs and the portal.', 120], ['name_line', 'Name on the logo line', 'Usually the doctor or clinic name.', 80],
  ['subtitle', 'Tagline', 'For example: Dental Clinic.', 80], ['sender_name', 'Email sender name', 'The "From" name patients see in their inbox.', 80]]
const CONTACT = [['address', 'Main address or city', 120], ['phone', 'Phone', 40], ['email', 'Contact email', 255]]
const COLOURS = [['primary', 'Primary'], ['primary_dark', 'Primary (dark)'], ['accent', 'Accent'], ['accent_dark', 'Accent (dark, for buttons)']]
const HEX = /^#[0-9a-fA-F]{6}$/

function fieldsFrom(branding) {
  return { name: branding.name || '', name_line: branding.name_line || '', subtitle: branding.subtitle || '', sender_name: branding.sender_name || '',
    address: branding.address || '', phone: branding.phone || '', email: branding.email || '', design: branding.design || 'fresh', ...branding.colours }
}

export function ClinicBrandingPage() {
  const [data, setData] = useState(null), [loadError, setLoadError] = useState('')
  const [form, setForm] = useState(null), [errors, setErrors] = useState({}), [saving, setSaving] = useState(false), [notice, setNotice] = useState(null)
  const [logoError, setLogoError] = useState(''), [logoBusy, setLogoBusy] = useState(false)
  const [bir, setBir] = useState({}), [birSaving, setBirSaving] = useState(null), [birErrors, setBirErrors] = useState({})

  const adopt = d => {
    setData(d); setForm(fieldsFrom(d.branding)); applyBranding(d.branding)
    setBir(Object.fromEntries((d.branches || []).map(b => [b.id, { registered_name: '', tin: '', registered_address: '', vat_status: '', permit_numbers: '', ...Object.fromEntries(Object.entries(b.bir || {}).map(([k, v]) => [k, v ?? ''])) }])))
  }
  useEffect(() => { getBrandingSettings().then(r => r.ok ? adopt(r.data) : setLoadError(r.message || 'Branding settings could not be loaded.')) }, [])

  if (loadError) return <><PageHeader title="Clinic branding"/><Notice tone="warning" title="Settings unavailable">{loadError}</Notice></>
  if (!data || !form) return <><PageHeader title="Clinic branding"/><Notice>Loading your clinic settings…</Notice></>

  const set = key => event => setForm(f => ({ ...f, [key]: event.target.value }))
  const save = async event => {
    event.preventDefault()
    const local = Object.fromEntries(COLOURS.filter(([k]) => !HEX.test(form[k] || '')).map(([k]) => [k, 'Use a colour like #1865ac.']))
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) local.email = 'Enter a valid email address.'
    setErrors(local)
    if (Object.keys(local).length) return
    setSaving(true); setNotice(null)
    const r = await updateBrandingSettings(form)
    setSaving(false)
    if (r.ok) { adopt(r.data); setNotice({ tone: 'success', text: 'Saved. New emails and PDFs use these settings now.' }) }
    else { setErrors(Object.fromEntries(Object.entries(r.errors || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)]))); setNotice({ tone: 'warning', text: r.message || 'The settings could not be saved.' }) }
  }
  const upload = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    const problem = await checkLogoFile(file)
    setLogoError(problem)
    if (problem) return
    setLogoBusy(true)
    const r = await uploadBrandingLogo(file)
    setLogoBusy(false)
    if (r.ok) { adopt(r.data); setNotice({ tone: 'success', text: 'Logo updated. Emails and PDFs use it now.' }) }
    else setLogoError(r.errors?.logo?.[0] || r.message || 'The logo could not be uploaded.')
  }
  const resetLogo = async () => { setLogoBusy(true); const r = await resetBrandingLogo(); setLogoBusy(false); if (r.ok) adopt(r.data) }
  const saveBir = async branch => {
    setBirSaving(branch.id); setBirErrors(e => ({ ...e, [branch.id]: {} }))
    const r = await updateBranchBir(branch.id, bir[branch.id])
    setBirSaving(null)
    if (r.ok) { adopt(r.data); setNotice({ tone: 'success', text: `BIR details saved for ${branch.name}.` }) }
    else setBirErrors(e => ({ ...e, [branch.id]: Object.fromEntries(Object.entries(r.errors || {}).map(([k, v]) => [k, Array.isArray(v) ? v[0] : String(v)])) }))
  }
  const custom = new Set(data.custom || [])

  return <div className="branding-page">
    <PageHeader kicker="Administration" title="Clinic branding" text="Your clinic's name, contact details, design, colours and logo. Changes apply to every email, PDF and the Patient Portal."/>
    {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
    <form onSubmit={save} noValidate className="branding-grid">
      <Card title="Identity" subtitle="How the clinic is named everywhere.">
        {IDENTITY.map(([key, label, hint, max]) => <Field key={key} label={label} hint={hint} error={errors[key]}><input value={form[key]} onChange={set(key)} maxLength={max}/></Field>)}
      </Card>
      <Card title="Contact" subtitle="Shown in email and PDF footers.">
        {CONTACT.map(([key, label, max]) => <Field key={key} label={label} error={errors[key]}><input value={form[key]} onChange={set(key)} maxLength={max} type={key === 'email' ? 'email' : 'text'} inputMode={key === 'phone' ? 'tel' : undefined}/></Field>)}
      </Card>
      <Card title="Email and PDF design" subtitle="Both designs use your colours and logo.">
        <fieldset className="branding-designs"><legend className="sr-only">Design</legend>
          {data.designs.map(d => <label key={d.key} className={`branding-design ${form.design === d.key ? 'is-selected' : ''}`}>
            <input type="radio" name="design" value={d.key} checked={form.design === d.key} onChange={set('design')}/>
            <span className={`branding-swatch ${d.key}`} aria-hidden="true" style={{ '--sw-primary': form.primary, '--sw-dark': form.primary_dark, '--sw-accent': form.accent }}/>
            <span><b>{d.label}</b><small>{d.key === 'fresh' ? 'White and airy, mint and light-blue, centred logo, wave divider.' : 'Deep brand-blue header, white logo tile, teal buttons.'}</small></span>
          </label>)}
        </fieldset>
        <div className="branding-colours">
          {COLOURS.map(([key, label]) => <Field key={key} label={label} error={errors[key]}>
            <span className="branding-colour"><input type="color" aria-label={`${label} colour picker`} value={HEX.test(form[key] || '') ? form[key] : '#000000'} onChange={set(key)}/><input value={form[key] || ''} onChange={set(key)} maxLength={7} spellCheck={false}/></span>
          </Field>)}
        </div>
      </Card>
      <div className="branding-actions"><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save branding'}</Button>{custom.size > 0 && <small className="muted">Clear a field and save to return it to the default.</small>}</div>
    </form>

    <Card title="Logo" subtitle="A PNG or JPEG, roughly square, at least 128 px and up to 512 KB. It is resized for emails and PDFs.">
      <div className="branding-logo">
        {data.branding.logo_url && <img src={data.branding.logo_url} alt="Current clinic logo" width="88" height="88"/>}
        <div>
          <label className="btn soft md branding-upload"><input type="file" accept="image/png,image/jpeg" onChange={upload} disabled={logoBusy}/><span>{logoBusy ? 'Uploading…' : 'Upload a new logo'}</span></label>
          {data.branding.logo_custom && <Button variant="ghost" onClick={resetLogo} disabled={logoBusy}>Use the original clinic logo</Button>}
          {logoError && <p className="field-error" role="alert">{logoError}</p>}
        </div>
      </div>
    </Card>

    <Card title="BIR registration (optional)" subtitle="Printed on Payment Receipts and Invoices only when filled in. Documents stay titled Payment Receipt and Invoice.">
      {(data.branches || []).map(branch => <details key={branch.id} className="branding-branch">
        <summary><b>{branch.name}</b><span className="muted">{Object.values(branch.bir || {}).some(Boolean) ? 'Filled in' : 'Not filled in'}</span></summary>
        <div className="branding-bir">
          {[['registered_name', 'Registered name'], ['tin', 'TIN'], ['registered_address', 'Registered address'], ['permit_numbers', 'Permit numbers']].map(([key, label]) =>
            <Field key={key} label={label} error={birErrors[branch.id]?.[key]}><input value={bir[branch.id]?.[key] || ''} onChange={e => setBir(b => ({ ...b, [branch.id]: { ...b[branch.id], [key]: e.target.value } }))} inputMode={key === 'tin' ? 'numeric' : undefined}/></Field>)}
          <Field label="VAT status" error={birErrors[branch.id]?.vat_status}><select value={bir[branch.id]?.vat_status || ''} onChange={e => setBir(b => ({ ...b, [branch.id]: { ...b[branch.id], vat_status: e.target.value } }))}>
            <option value="">Not shown</option><option value="vat">VAT-registered</option><option value="non_vat">Non-VAT registered</option></select></Field>
          <Button size="sm" onClick={() => saveBir(branch)} disabled={birSaving === branch.id}>{birSaving === branch.id ? 'Saving…' : `Save ${branch.name}`}</Button>
        </div>
      </details>)}
    </Card>
  </div>
}
