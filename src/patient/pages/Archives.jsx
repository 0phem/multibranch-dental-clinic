import React, { useEffect, useState } from 'react'
import { Button, Icon } from '../../components.jsx'
import { downloadBillingPdf, downloadPrescriptionPdf, listAppointments, myBillingInvoices, myPrescriptions } from '../../api-client.js'
import { dateLong, money, time12, todayManila } from '../format.js'
import { EmptyState, ErrorState, PageHead, Pill, Skeleton } from '../ui.jsx'

const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

export function ArchivesPage({ toast = () => {} }) {
  const [tab, setTab] = useState('visits') // visits | prescriptions | receipts
  const [visits, setVisits] = useState({ loading: true, data: [], error: '' })
  const [prescriptions, setPrescriptions] = useState({ loading: true, data: [], error: '' })
  const [invoices, setInvoices] = useState({ loading: true, data: [], error: '' })
  const [downloading, setDownloading] = useState('')

  useEffect(() => {
    const today = todayManila()
    // Load completed past visits
    listAppointments({ from: addDays(today, -180), to: today, per_page: 50 }).then(r => {
      if (r.ok && Array.isArray(r.data)) {
        const completed = r.data.filter(a => ['Completed', 'Served'].includes(a.status) || a.date < today)
        setVisits({ loading: false, data: completed, error: '' })
      } else {
        setVisits({ loading: false, data: [], error: r.message || 'Could not load past visits.' })
      }
    }).catch(() => setVisits({ loading: false, data: [], error: 'Could not load past visits.' }))

    // Load past prescriptions
    myPrescriptions().then(r => {
      if (r.ok && Array.isArray(r.data)) {
        setPrescriptions({ loading: false, data: r.data, error: '' })
      } else {
        setPrescriptions({ loading: false, data: [], error: r.message || 'Could not load prescriptions.' })
      }
    }).catch(() => setPrescriptions({ loading: false, data: [], error: 'Could not load prescriptions.' }))

    // Load archived invoices & receipts
    myBillingInvoices({ per_page: 50 }).then(r => {
      if (r.ok && Array.isArray(r.data)) {
        setInvoices({ loading: false, data: r.data, error: '' })
      } else {
        setInvoices({ loading: false, data: [], error: r.message || 'Could not load billing archives.' })
      }
    }).catch(() => setInvoices({ loading: false, data: [], error: 'Could not load billing archives.' }))
  }, [])

  const handleDownloadPdf = async (id, kind) => {
    setDownloading(`${id}:${kind}`)
    const r = await downloadBillingPdf(id, kind)
    setDownloading('')
    if (!r.ok) toast(r.message || 'The PDF could not be downloaded.', 'warning')
  }

  const handleDownloadRx = async (id, number) => {
    setDownloading(`rx:${id}`)
    const r = await downloadPrescriptionPdf(id, number)
    setDownloading('')
    if (!r.ok) toast(r.message || 'The prescription PDF could not be downloaded.', 'warning')
  }

  return (
    <div className="pp-page pp-fade" aria-label="Archives & Historical Records">
      <PageHead
        eyebrow="Medical Records"
        title="Archives"
        hint="Historical records of your care, past completed appointments, digital prescriptions, and settled receipts."
      />

      <div className="pp-tabs" role="tablist" aria-label="Archive categories">
        {[
          ['visits', `Completed Visits (${visits.data.length})`],
          ['prescriptions', `Past Prescriptions (${prescriptions.data.length})`],
          ['receipts', `Archived Receipts (${invoices.data.filter(i => i.receipt).length})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={tab === key ? 'is-active' : ''}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'visits' && (
        <section aria-labelledby="archive-visits-heading">
          <h2 id="archive-visits-heading" className="sr-only">Completed Visits Archive</h2>
          {visits.loading && <Skeleton lines={4} label="Loading visit records"/>}
          {visits.error && <ErrorState text={visits.error} />}
          {!visits.loading && !visits.error && !visits.data.length && (
            <EmptyState icon="calendar" title="No archived visits" text="Completed and past visits will be safely preserved here."/>
          )}
          {!visits.loading && visits.data.length > 0 && (
            <ul className="pp-list" aria-label="Completed visits archive">
              {visits.data.map(v => (
                <li key={v.id} className="pp-card pp-visit pp-fade">
                  <div className="pp-visit-date" aria-hidden="true">
                    <b>{v.date ? Number(v.date.slice(8)) : '—'}</b>
                    <span>{v.date ? new Date(`${v.date}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', timeZone: 'UTC' }) : ''}</span>
                  </div>
                  <div className="pp-visit-body">
                    <h3>{v.service?.name || 'Dental Treatment'}</h3>
                    <p>{dateLong(v.date)} · {time12(v.start_time)}</p>
                    <p className="pp-muted"><Icon name="pin" size={14}/> {v.branch?.name}{v.dentist?.name ? ` · Dr. ${v.dentist.name}` : ''}</p>
                    <p className="pp-muted">Ref. {v.code} <Pill tone="neutral">{v.status}</Pill></p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'prescriptions' && (
        <section aria-labelledby="archive-rx-heading">
          <h2 id="archive-rx-heading" className="sr-only">Prescriptions Archive</h2>
          {prescriptions.loading && <Skeleton lines={4} label="Loading prescriptions"/>}
          {prescriptions.error && <ErrorState text={prescriptions.error} />}
          {!prescriptions.loading && !prescriptions.error && !prescriptions.data.length && (
            <EmptyState icon="pill" title="No archived prescriptions" text="Past prescriptions issued by your dentist appear here."/>
          )}
          {!prescriptions.loading && prescriptions.data.length > 0 && (
            <ul className="pp-rx-list" aria-label="Prescriptions archive">
              {prescriptions.data.map(p => (
                <li key={p.id} className={`pp-card ${p.status === 'Void' ? 'is-void' : ''}`}>
                  <p>
                    <b>{p.number}</b> · {p.issued_at ? dateLong(p.issued_at.slice(0, 10)) : ''}
                    {p.status === 'Void' && <span className="pp-void"> VOID</span>}
                  </p>
                  <p className="pp-hint">{p.dentist} · {p.branch}</p>
                  <ol>
                    {(p.lines || []).map((l, i) => (
                      <li key={i}>
                        <b>{l.medicine}</b>
                        {[l.dosage, l.frequency, l.duration].filter(Boolean).length ? ` — ${[l.dosage, l.frequency, l.duration].filter(Boolean).join(', ')}` : ''}
                        {l.instructions ? `. ${l.instructions}` : ''}
                      </li>
                    ))}
                  </ol>
                  <Button
                    size="sm"
                    variant="soft"
                    icon="download"
                    disabled={downloading === `rx:${p.id}`}
                    onClick={() => handleDownloadRx(p.id, p.number)}
                  >
                    {downloading === `rx:${p.id}` ? 'Downloading…' : 'Download Prescription PDF'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === 'receipts' && (
        <section aria-labelledby="archive-receipts-heading">
          <h2 id="archive-receipts-heading" className="sr-only">Receipts Archive</h2>
          {invoices.loading && <Skeleton lines={4} label="Loading receipts"/>}
          {invoices.error && <ErrorState text={invoices.error} />}
          {!invoices.loading && !invoices.error && !invoices.data.filter(i => i.receipt).length && (
            <EmptyState icon="receipt" title="No archived receipts" text="Official receipts and settled invoices are recorded here."/>
          )}
          {!invoices.loading && invoices.data.filter(i => i.receipt).length > 0 && (
            <ul className="pp-list" aria-label="Archived receipts">
              {invoices.data.filter(i => i.receipt).map(inv => (
                <li key={inv.id} className="pp-card pp-fade">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <p className="pp-eyebrow">Receipt {inv.receipt.number}</p>
                      <h3>Invoice #{inv.invoice_number}</h3>
                      <p className="pp-muted">{inv.receipt.issued_at ? dateLong(inv.receipt.issued_at.slice(0, 10)) : ''} · {inv.branch?.name}</p>
                      <p><b>Paid: {money(inv.receipt.amount)}</b> · Via {inv.receipt.method || 'Cash / Online'}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <Button
                        size="sm"
                        variant="soft"
                        icon="download"
                        disabled={downloading === `${inv.id}:receipt`}
                        onClick={() => handleDownloadPdf(inv.id, 'receipt')}
                      >
                        {downloading === `${inv.id}:receipt` ? 'Downloading…' : 'Download Receipt'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon="file"
                        disabled={downloading === `${inv.id}:invoice`}
                        onClick={() => handleDownloadPdf(inv.id, 'invoice')}
                      >
                        Invoice PDF
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
export default ArchivesPage
