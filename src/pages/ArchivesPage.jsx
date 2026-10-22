import React, { useMemo, useState } from 'react'
import { Button, Card, Field, Icon, Notice, PageHeader, Status, Table, Tabs } from '../components.jsx'
import { peso } from '../logic.js'
import { clinicDate } from '../clock.js'

export function ArchivesPage({ store, activeBranch = 'All Branches' }) {
  const { state, toast } = store
  const [tab, setTab] = useState('visits')
  const [query, setQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(activeBranch || 'All Branches')

  const branches = useMemo(() => ['All Branches', ...(state.branches || []).map(b => b.name)], [state.branches])

  // Filter helper
  const branchFilter = item => {
    if (selectedBranch === 'All Branches') return true
    return (item.branch || item.branchName) === selectedBranch
  }

  // 1. Archived completed visits
  const archivedVisits = useMemo(() => {
    const list = (state.appointments || []).filter(a => {
      const isPastOrDone = ['Completed', 'Served', 'Cancelled', 'No-Show'].includes(a.status) || a.date <= clinicDate()
      return isPastOrDone && branchFilter(a)
    })
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(a =>
      (a.patientName || '').toLowerCase().includes(q) ||
      (a.serviceName || a.service?.name || '').toLowerCase().includes(q) ||
      (a.dentistName || a.dentist?.name || '').toLowerCase().includes(q) ||
      (a.code || '').toLowerCase().includes(q)
    )
  }, [state.appointments, selectedBranch, query])

  // 2. Archived prescriptions
  const archivedPrescriptions = useMemo(() => {
    const list = (state.prescriptions || []).filter(branchFilter)
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(p =>
      (p.number || '').toLowerCase().includes(q) ||
      (p.patientName || '').toLowerCase().includes(q) ||
      (p.dentistName || '').toLowerCase().includes(q)
    )
  }, [state.prescriptions, selectedBranch, query])

  // 3. Archived receipts / settled invoices
  const archivedInvoices = useMemo(() => {
    const list = (state.invoices || []).filter(i => {
      const isSettled = ['Paid', 'Closed', 'Archived'].includes(i.status)
      return isSettled && branchFilter(i)
    })
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(i =>
      (i.invoiceNumber || i.invoice_number || '').toLowerCase().includes(q) ||
      (i.patientName || '').toLowerCase().includes(q) ||
      (i.receiptNumber || i.receipt?.number || '').toLowerCase().includes(q)
    )
  }, [state.invoices, selectedBranch, query])

  return (
    <div className="archives-page" aria-label="Archives and Historical Records">
      <PageHeader
        kicker="Module 23 · Compliance & Record Retention"
        title="Archives & Historical Records Management"
        text="Central repository for long-term clinical retention, completed visit logs, past prescription histories, and settled financial records in compliance with medical data privacy regulations."
      />

      <div className="filter-row" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: '16px' }}>
        <Field label="Search archive" style={{ flex: '1 1 240px', minWidth: '200px' }}>
          <input
            type="search"
            placeholder="Search by patient, code, number, dentist…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </Field>
        <Field label="Branch filter" style={{ width: '200px' }}>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}>
            {branches.map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </Field>
        {query && (
          <Button variant="ghost" onClick={() => setQuery('')}>
            Clear
          </Button>
        )}
      </div>

      <Tabs
        tabs={[
          { key: 'visits', label: `Completed Visits (${archivedVisits.length})` },
          { key: 'prescriptions', label: `Prescriptions (${archivedPrescriptions.length})` },
          { key: 'financials', label: `Settled Invoices & Receipts (${archivedInvoices.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'visits' && (
        <Card title="Historical Completed Encounters" subtitle="Visit records preserved indefinitely for patient history and regulatory continuity.">
          <Table
            rows={archivedVisits}
            emptyMessage="No archived visits matching your criteria."
            columns={[
              { key: 'date', label: 'Date', render: r => <b>{r.date}</b> },
              { key: 'code', label: 'Ref Code', render: r => <code>{r.code || r.id}</code> },
              { key: 'patientName', label: 'Patient', render: r => r.patientName || r.patient?.name || 'Patient' },
              { key: 'serviceName', label: 'Service / Procedure', render: r => r.serviceName || r.service?.name || 'General Treatment' },
              { key: 'dentistName', label: 'Attending Dentist', render: r => r.dentistName || r.dentist?.name || 'Dr. Reyes' },
              { key: 'branch', label: 'Branch', render: r => r.branch || r.branchName || 'Main' },
              { key: 'status', label: 'Outcome Status', render: r => <Status tone={r.status === 'Completed' || r.status === 'Served' ? 'success' : 'neutral'}>{r.status}</Status> },
            ]}
          />
        </Card>
      )}

      {tab === 'prescriptions' && (
        <Card title="Archived Digital Prescriptions" subtitle="Historical prescriptions issued to patients, including medication dosages and instructions.">
          <Table
            rows={archivedPrescriptions}
            emptyMessage="No archived prescriptions found."
            columns={[
              { key: 'number', label: 'Rx Number', render: r => <b>{r.number}</b> },
              { key: 'issued_at', label: 'Issued Date', render: r => r.issued_at || r.date || '—' },
              { key: 'patientName', label: 'Patient', render: r => r.patientName || 'Patient' },
              { key: 'dentistName', label: 'Prescribing Doctor', render: r => r.dentistName || 'Dentist' },
              { key: 'medicines', label: 'Medicines', render: r => (r.lines || []).map(l => l.medicine).join(', ') || 'Medication list' },
              { key: 'status', label: 'Status', render: r => <Status tone={r.status === 'Void' ? 'danger' : 'neutral'}>{r.status || 'Issued'}</Status> },
            ]}
          />
        </Card>
      )}

      {tab === 'financials' && (
        <Card title="Settled Billing & Receipt Records" subtitle="Archived invoices and receipts settled via PayMongo or front-desk cash.">
          <Table
            rows={archivedInvoices}
            emptyMessage="No settled financial records matching filter."
            columns={[
              { key: 'invoiceNumber', label: 'Invoice #', render: r => <b>{r.invoiceNumber || r.invoice_number || r.id}</b> },
              { key: 'patientName', label: 'Patient', render: r => r.patientName || 'Patient' },
              { key: 'date', label: 'Issued Date', render: r => r.issued_at || r.date || '—' },
              { key: 'total', label: 'Gross Total', render: r => peso.format(r.gross_amount || r.total || 0) },
              { key: 'paid', label: 'Paid Amount', render: r => peso.format(r.paid_amount || r.total || 0) },
              { key: 'branch', label: 'Branch', render: r => r.branch || 'Main' },
              { key: 'status', label: 'Settlement Status', render: r => <Status tone="success">{r.status || 'Paid'}</Status> },
            ]}
          />
        </Card>
      )}
    </div>
  )
}
export default ArchivesPage
