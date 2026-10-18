import React, { useEffect, useState } from 'react'
import { Button, Field, Notice } from '../components.jsx'
import { clinic } from '../clinic-config.js'
import { dateLabel } from '../logic.js'
import { money } from '../patient-view.js'
import { createPayMongoCheckout, getPaymentOptions } from '../api-client.js'
import { ADDRESS_LABELS as LABELS, billingAddressErrors } from '../billing-address.js'


/**
 * M11 Review and Pay: the Patient checks the itemized invoice, optionally gives a billing address, and is sent to PayMongo's hosted
 * checkout. The server builds the amount, the line items and the return URLs; this page only displays what the server returned.
 */
export function ReviewAndPay({ invoice, onBack }) {
  const [options, setOptions] = useState(null), [optionsError, setOptionsError] = useState('')
  const [address, setAddress] = useState(null), [save, setSave] = useState(false)
  const [errors, setErrors] = useState({}), [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let live = true
    getPaymentOptions(invoice.id).then(r => {
      if (!live) return
      if (r.ok && r.data) { setOptions(r.data); setAddress(r.data.billing_address || { country: 'PH' }) }
      else setOptionsError(r.message || 'Online payment options could not be loaded.')
    })
    return () => { live = false }
  }, [invoice.id])

  const set = key => event => setAddress(previous => ({ ...previous, [key]: event.target.value }))
  const pay = async event => {
    event.preventDefault()
    if (busy) return
    const checked = billingAddressErrors(address)
    setErrors(checked.errors)
    if (Object.keys(checked.errors).length) return
    setBusy(true); setError('')
    const result = await createPayMongoCheckout(invoice.id, checked.address ? { billing_address: checked.address, save_billing_address: save } : {})
    if (result.ok && result.data?.checkout_url) { window.location.href = result.data.checkout_url; return }
    if (result.kind === 'validation') setErrors(Object.fromEntries(Object.entries(result.errors || {}).map(([k, v]) => [k.replace('billing_address.', ''), Array.isArray(v) ? v[0] : String(v)])))
    setError(result.message || 'The payment could not be started. No payment was made.')
    setBusy(false)
  }

  const methods = options?.methods || []
  const hmo = Number(invoice.hmoCoverage || 0) > 0
  return <section className="rp" aria-labelledby="rp-title">
    <header className="rp-band">
      <span className="rp-logo"><img src={clinic.logo} alt="" width="40" height="40"/></span>
      <span className="rp-name"><strong>{clinic.nameLine}</strong><small>{clinic.subtitle}</small></span>
      {invoice.branch && <span className="rp-branch">{invoice.branch}</span>}
    </header>
    <div className="rp-body">
      <p className="rp-eyebrow"><span className="rp-badge">Payment due</span></p>
      <h1 id="rp-title" className="rp-title">Review and pay</h1>
      <p className="rp-sub">Invoice <b>{invoice.invoiceNo}</b>{invoice.date ? ` · Issued ${dateLabel(invoice.date)}` : ''}{invoice.branch ? ` · ${invoice.branch}` : ''}</p>

      <div className="rp-hero"><span>Amount due</span><b>{money(invoice.balance)}</b></div>

      <ul className="rp-items" aria-label="Itemized charges">
        {invoice.items.map(item => <li key={item.key}><span><b>{item.name}</b><small>{item.quantity} × {money(item.unit)}</small></span><span>{money(item.amount)}</span></li>)}
        <li className="rp-sum"><span>Subtotal</span><span>{money(invoice.total)}</span></li>
        {hmo && <li className="rp-sum"><span>Less: coverage</span><span>−{money(invoice.hmoCoverage)}</span></li>}
        <li className="rp-total"><span>Total</span><span>{money(invoice.patientResponsibility ?? invoice.total)}</span></li>
      </ul>

      {optionsError ? <Notice tone="warning" title="Online payment unavailable">{optionsError}</Notice> : !options ? <Notice>Loading payment options…</Notice> : methods.length === 0
        ? <Notice tone="warning" title="Online payment is not set up">The clinic has not turned on online payment. You can pay at the clinic front desk.</Notice>
        : <form className="rp-form" onSubmit={pay} noValidate>
          <fieldset>
            <legend>Billing address <small>(optional)</small></legend>
            <p className="rp-hint">Fill this in now to save time, or leave it empty and PayMongo will ask for it on the next page.</p>
            <Field label={LABELS.line1} error={errors.line1}><input value={address?.line1 || ''} onChange={set('line1')} autoComplete="address-line1" maxLength={255}/></Field>
            <Field label={LABELS.line2} error={errors.line2}><input value={address?.line2 || ''} onChange={set('line2')} autoComplete="address-line2" maxLength={255}/></Field>
            <div className="rp-grid">
              <Field label={LABELS.city} error={errors.city}><input value={address?.city || ''} onChange={set('city')} autoComplete="address-level2" maxLength={100}/></Field>
              <Field label={LABELS.state} error={errors.state}><input value={address?.state || ''} onChange={set('state')} autoComplete="address-level1" maxLength={100}/></Field>
              <Field label={LABELS.postal_code} error={errors.postal_code}><input value={address?.postal_code || ''} onChange={set('postal_code')} autoComplete="postal-code" inputMode="numeric" maxLength={20}/></Field>
              <Field label={LABELS.country} hint="PH for the Philippines" error={errors.country}><input value={address?.country || ''} onChange={set('country')} autoComplete="country" maxLength={2}/></Field>
            </div>
            {options.can_save_billing_address && <label className="rp-check"><input type="checkbox" checked={save} onChange={e => setSave(e.target.checked)}/> Save this address to my profile for next time</label>}
          </fieldset>
          {error && <Notice tone="warning" title="Payment not started">{error}</Notice>}
          <Button type="submit" variant="primary" width="full" className="rp-pay" disabled={busy}>{busy ? 'Opening PayMongo…' : <>🔒&nbsp; Pay {money(invoice.balance)} securely with PayMongo</>}</Button>
          <p className="rp-note">You finish on PayMongo’s secure page. Accepted: {methods.join(', ')}. Your card or wallet details are entered on PayMongo, never on this site.</p>
        </form>}
      <Button variant="ghost" onClick={onBack}>Back to invoices</Button>
    </div>
  </section>
}
