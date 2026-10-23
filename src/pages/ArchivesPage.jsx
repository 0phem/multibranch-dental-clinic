import React, { useMemo, useState } from 'react'
import { Button, Card, Field, FilterBar, Icon, Modal, Notice, PageHeader, Status, Table, Tabs } from '../components.jsx'
import { makeCsv, peso } from '../logic.js'
import { clinicDate } from '../clock.js'
import { inScope, sessionForRole } from '../contracts.js'

export function ArchivesPage({ store, role: propRole, activeBranch = 'All Branches' }) {
  const { state, actions, toast } = store
  const role = propRole || store.session?.role || 'owner'
  const session = store.session || sessionForRole(role, state)
  const [tab, setTab] = useState('visits')
  const [query, setQuery] = useState('')
  const [selectedBranch, setSelectedBranch] = useState(
    role === 'owner' ? (activeBranch || 'All Branches') : (activeBranch && activeBranch !== 'All Branches' ? activeBranch : 'All Branches')
  )
  const [viewRecord, setViewRecord] = useState(null)
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoreReason, setRestoreReason] = useState('')

  // Authorized branches by role and branch access policy
  const branches = useMemo(() => {
    const allBranches = state.branches || []
    if (role === 'owner') {
      return ['All Branches', ...allBranches.map(b => b.name)]
    }
    if (role === 'staff') {
      const scopedIds = Array.isArray(session?.branchScopes) && session.branchScopes.length
        ? session.branchScopes
        : (session?.branchId ? [session.branchId] : [])
      const allowed = allBranches.filter(b => scopedIds.includes(b.id) || b.name === session?.branch).map(b => b.name)
      return allowed.length > 1 ? ['All Branches', ...allowed] : (allowed.length ? allowed : [activeBranch || 'All Branches'])
    }
    if (role === 'dentist') {
      const dentist = (state.dentists || []).find(d => d.id === session?.dentistId || d.userId === session?.userId)
      const allowed = dentist?.branches?.length ? dentist.branches : (activeBranch && activeBranch !== 'All Branches' ? [activeBranch] : allBranches.map(b => b.name))
      return allowed.length > 1 ? ['All Branches', ...allowed] : allowed
    }
    return ['All Branches']
  }, [state.branches, state.dentists, role, session, activeBranch])

  const effectiveBranch = branches.includes(selectedBranch) ? selectedBranch : (branches[0] || 'All Branches')

  // Filter helper enforcing both role/branch access scope and the selected branch dropdown
  const branchAndRoleFilter = item => {
    const bName = typeof item.branch === 'object' && item.branch !== null
      ? (item.branch.name || item.branch.id)
      : (item.branch || item.branchName)
    const bId = typeof item.branch === 'object' && item.branch !== null
      ? item.branch.id
      : item.branchId
    if (role === 'staff') {
      const scopedIds = Array.isArray(session?.branchScopes) && session.branchScopes.length
        ? session.branchScopes
        : (session?.branchId ? [session.branchId] : [])
      const inStaffBranch = (bId && scopedIds.includes(bId)) || (bName && branches.includes(bName)) || inScope(item, session, state)
      if (!inStaffBranch) return false
    } else if (role === 'dentist') {
      const inDentistBranch = (bName && branches.includes(bName)) || inScope(item, session, state)
      if (!inDentistBranch) return false
    }
    if (effectiveBranch === 'All Branches') return true
    return bName === effectiveBranch
  }

  // 1. Archived completed visits
  const archivedVisits = useMemo(() => {
    const list = (state.appointments || []).filter(a => {
      const isPastOrDone = ['Completed', 'Served', 'Cancelled', 'No-Show'].includes(a.status) || a.date <= clinicDate()
      return isPastOrDone && branchAndRoleFilter(a)
    })
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(a =>
      (a.patientName || '').toLowerCase().includes(q) ||
      (a.serviceName || a.service?.name || a.service || '').toLowerCase().includes(q) ||
      (a.dentistName || a.dentist?.name || '').toLowerCase().includes(q) ||
      (a.code || '').toLowerCase().includes(q)
    )
  }, [state.appointments, effectiveBranch, query, role, branches])

  // 2. Archived prescriptions
  const archivedPrescriptions = useMemo(() => {
    const list = (state.prescriptions || []).filter(branchAndRoleFilter)
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(p =>
      (p.number || '').toLowerCase().includes(q) ||
      (p.patientName || '').toLowerCase().includes(q) ||
      (p.dentistName || '').toLowerCase().includes(q)
    )
  }, [state.prescriptions, effectiveBranch, query, role, branches])

  // 3. Archived receipts / settled invoices (Staff and Owner only; Dentists do not view financial records)
  const canViewFinancials = role !== 'dentist'
  const archivedInvoices = useMemo(() => {
    if (!canViewFinancials) return []
    const list = (state.invoices || []).filter(i => {
      const isSettled = ['Paid', 'Closed', 'Archived'].includes(i.status)
      return isSettled && branchAndRoleFilter(i)
    })
    if (!query.trim()) return list
    const q = query.toLowerCase()
    return list.filter(i =>
      (i.invoiceNumber || i.invoice_number || '').toLowerCase().includes(q) ||
      (i.patientName || '').toLowerCase().includes(q) ||
      (i.receiptNumber || i.receipt?.number || '').toLowerCase().includes(q)
    )
  }, [state.invoices, effectiveBranch, query, canViewFinancials, role, branches])

  const logArchiveAudit = (actionName, targetId, detail) => {
    actions?.logAudit?.({
      action: actionName,
      module: 'Archives & Records',
      targetId: targetId || 'archive',
      detail,
    })
  }

  const handleExportCsv = () => {
    const scopeSlug = effectiveBranch.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    if (tab === 'visits') {
      const rows = archivedVisits.map(v => ({
        'Visit Date': v.date || '',
        'Reference Code': v.code || v.id || '',
        'Patient Name': v.patientName || v.patient?.name || 'Patient',
        'Service': v.serviceName || v.service?.name || v.service || 'General Treatment',
        'Dentist': v.dentistName || v.dentist?.name || '',
        'Branch': typeof v.branch === 'object' && v.branch ? v.branch.name : (v.branch || v.branchName || 'Main'),
        'Outcome Status': v.status || 'Completed',
      }))
      makeCsv(`archives-completed-visits-${scopeSlug}.csv`, rows)
      logArchiveAudit('archive.exported', `visits:${scopeSlug}`, `Exported ${rows.length} archived visit(s) for ${effectiveBranch}`)
      toast?.('Completed visits archive exported to CSV.', 'success')
    } else if (tab === 'prescriptions') {
      const rows = archivedPrescriptions.map(p => ({
        'Rx Number': p.number || '',
        'Issued Date': p.issued_at || p.date || '',
        'Patient Name': p.patientName || (typeof p.patient === 'object' ? p.patient?.name : p.patient) || '',
        'Prescribing Doctor': p.dentistName || (typeof p.dentist === 'object' ? p.dentist?.name : p.dentist) || '',
        'Branch': typeof p.branch === 'object' && p.branch ? p.branch.name : (p.branch || p.branchName || 'Main'),
        'Medicines': role === 'owner'
          ? 'Protected clinical details (Dentist/Staff/Patient only)'
          : (p.lines || []).map(l => `${l.medicine || ''} (${[l.dosage, l.frequency, l.duration].filter(Boolean).join(', ')})`).join('; '),
        'Status': p.status || 'Issued',
      }))
      makeCsv(`archives-prescriptions-${scopeSlug}.csv`, rows)
      logArchiveAudit('archive.exported', `prescriptions:${scopeSlug}`, `Exported ${rows.length} archived prescription(s) for ${effectiveBranch}`)
      toast?.('Archived prescriptions exported to CSV.', 'success')
    } else if (tab === 'financials' && canViewFinancials) {
      const rows = archivedInvoices.map(i => ({
        'Invoice Number': i.invoiceNumber || i.invoice_number || i.id || '',
        'Receipt Number': i.receiptNumber || i.receipt?.number || '',
        'Patient Name': i.patientName || '',
        'Issued Date': i.issued_at || i.date || '',
        'Gross Amount': i.gross_amount || i.total || 0,
        'Paid Amount': i.paid_amount || i.total || 0,
        'Branch': typeof i.branch === 'object' && i.branch ? i.branch.name : (i.branch || 'Main'),
        'Settlement Status': i.status || 'Paid',
      }))
      makeCsv(`archives-financial-receipts-${scopeSlug}.csv`, rows)
      logArchiveAudit('archive.exported', `financials:${scopeSlug}`, `Exported ${rows.length} archived financial record(s) for ${effectiveBranch}`)
      toast?.('Settled financial records exported to CSV.', 'success')
    }
  }

  const handleConfirmRestore = e => {
    e.preventDefault()
    if (!restoreTarget || restoreReason.trim().length < 3) return
    const ref = restoreTarget.code || restoreTarget.number || restoreTarget.invoiceNumber || restoreTarget.id
    logArchiveAudit(
      'archive.restored_for_followup',
      ref,
      `Retrieved/restored archived ${restoreTarget.kind} (${ref}) — Reason: ${restoreReason.trim()}`
    )
    toast?.(`Archived record ${ref} retrieved for active follow-up (reason logged in Audit Trail).`, 'success')
    setRestoreTarget(null)
    setRestoreReason('')
  }

  const availableTabs = [
    { key: 'visits', label: `Completed Visits (${archivedVisits.length})` },
    { key: 'prescriptions', label: `Prescriptions (${archivedPrescriptions.length})` },
    ...(canViewFinancials ? [{ key: 'financials', label: `Settled Invoices & Receipts (${archivedInvoices.length})` }] : []),
  ]

  return (
    <div className="archives-page" aria-label="Archives and Historical Records">
      <PageHeader
        kicker="Compliance & Record Retention"
        title="Archives & Historical Records Management"
        text="Role- and branch-scoped repository for completed visit logs, past prescriptions, and settled financial records."
      />

      <Notice tone="info" title="Retention, viewing, retrieval, and non-deletion policy">
        <b>Viewing</b> inspects historical records read-only within your role and branch scope. <b>Retrieving / Restoring</b> flags a historical record for active follow-up and requires a mandatory audit reason. <b>Permanent deletion</b> of clinical, prescription, or financial records is prohibited by clinic retention and medical data regulations.
      </Notice>

      <FilterBar
        search={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search by patient, code, number, dentist…"
        onClear={(query || effectiveBranch !== (branches[0] || 'All Branches')) ? () => { setQuery(''); setSelectedBranch(branches[0] || 'All Branches') } : null}
      >
        <select
          className="filter-select"
          aria-label="Filter archive by branch"
          value={effectiveBranch}
          disabled={branches.length <= 1}
          onChange={e => setSelectedBranch(e.target.value)}
        >
          {branches.map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <Button size="sm" variant="secondary" icon="download" onClick={handleExportCsv}>
          Export Archive CSV
        </Button>
      </FilterBar>

      <Tabs
        tabs={availableTabs}
        active={tab}
        onChange={setTab}
      />

      {tab === 'visits' && (
        <Card title="Historical Completed Encounters" subtitle="Visit records preserved for patient history and regulatory continuity.">
          <Table
            rows={archivedVisits}
            emptyMessage="No archived visits matching your criteria."
            columns={[
              { key: 'date', label: 'Date', render: r => <b>{r.date}</b> },
              { key: 'code', label: 'Ref Code', render: r => <code>{r.code || r.id}</code> },
              { key: 'patientName', label: 'Patient', render: r => r.patientName || r.patient?.name || 'Patient' },
              { key: 'serviceName', label: 'Service / Procedure', render: r => r.serviceName || r.service?.name || r.service || 'General Treatment' },
              { key: 'dentistName', label: 'Attending Dentist', render: r => r.dentistName || r.dentist?.name || 'Dr. Reyes' },
              { key: 'branch', label: 'Branch', render: r => (typeof r.branch === 'object' && r.branch ? r.branch.name : (r.branch || r.branchName || 'Main')) },
              { key: 'status', label: 'Outcome Status', render: r => <Status tone={r.status === 'Completed' || r.status === 'Served' ? 'success' : 'neutral'}>{r.status}</Status> },
              { key: 'actions', label: 'Actions', render: r => (
                <div className="row-actions">
                  <Button size="sm" variant="ghost" onClick={() => {
                    logArchiveAudit('archive.viewed', r.code || r.id, `Viewed archived visit ${r.code || r.id}`)
                    setViewRecord({ kind: 'visit', record: r })
                  }}>View</Button>
                  <Button size="sm" variant="soft" onClick={() => {
                    setRestoreTarget({ kind: 'visit', ...r })
                    setRestoreReason('')
                  }}>Retrieve / Restore</Button>
                </div>
              ) },
            ]}
          />
        </Card>
      )}

      {tab === 'prescriptions' && (
        <Card title="Archived Digital Prescriptions" subtitle="Historical prescriptions issued to patients, scoped by role and branch.">
          <Table
            rows={archivedPrescriptions}
            emptyMessage="No archived prescriptions found."
            columns={[
              { key: 'number', label: 'Rx Number', render: r => <b>{r.number}</b> },
              { key: 'issued_at', label: 'Issued Date', render: r => r.issued_at || r.date || '—' },
              { key: 'patientName', label: 'Patient', render: r => r.patientName || (typeof r.patient === 'object' ? r.patient?.name : r.patient) || 'Patient' },
              { key: 'dentistName', label: 'Prescribing Doctor', render: r => r.dentistName || (typeof r.dentist === 'object' ? r.dentist?.name : r.dentist) || 'Dentist' },
              { key: 'branch', label: 'Branch', render: r => (typeof r.branch === 'object' && r.branch ? r.branch.name : (r.branch || r.branchName || 'Main')) },
              { key: 'medicines', label: 'Medicines', render: r => role === 'owner' ? <span className="au-muted">Metadata only (clinical privacy)</span> : ((r.lines || []).map(l => l.medicine).join(', ') || 'Medication list') },
              { key: 'status', label: 'Status', render: r => <Status tone={r.status === 'Void' ? 'danger' : 'neutral'}>{r.status || 'Issued'}</Status> },
              { key: 'actions', label: 'Actions', render: r => (
                <div className="row-actions">
                  <Button size="sm" variant="ghost" onClick={() => {
                    logArchiveAudit('archive.viewed', r.number || r.id, `Viewed archived prescription ${r.number || r.id}`)
                    setViewRecord({ kind: 'prescription', record: r })
                  }}>View</Button>
                </div>
              ) },
            ]}
          />
        </Card>
      )}

      {tab === 'financials' && canViewFinancials && (
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
              { key: 'branch', label: 'Branch', render: r => (typeof r.branch === 'object' && r.branch ? r.branch.name : (r.branch || 'Main')) },
              { key: 'status', label: 'Settlement Status', render: r => <Status tone="success">{r.status || 'Paid'}</Status> },
              { key: 'actions', label: 'Actions', render: r => (
                <div className="row-actions">
                  <Button size="sm" variant="ghost" onClick={() => {
                    logArchiveAudit('archive.viewed', r.invoiceNumber || r.id, `Viewed archived financial record ${r.invoiceNumber || r.id}`)
                    setViewRecord({ kind: 'financial', record: r })
                  }}>View</Button>
                </div>
              ) },
            ]}
          />
        </Card>
      )}

      {viewRecord && (
        <Modal
          open
          title="Archived Record Details (Read-Only)"
          subtitle="Historical archive inspection. Permanent deletion is disabled under clinic retention rules."
          onClose={() => setViewRecord(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p><b>Record Type:</b> {viewRecord.kind.toUpperCase()}</p>
            <p><b>Reference:</b> <code>{viewRecord.record.code || viewRecord.record.number || viewRecord.record.invoiceNumber || viewRecord.record.id}</code></p>
            <p><b>Patient:</b> {viewRecord.record.patientName || viewRecord.record.patient?.name || 'Patient'}</p>
            <p><b>Branch:</b> {typeof viewRecord.record.branch === 'object' && viewRecord.record.branch ? viewRecord.record.branch.name : (viewRecord.record.branch || viewRecord.record.branchName || 'Main')}</p>
            <p><b>Date:</b> {viewRecord.record.date || viewRecord.record.issued_at || '—'}</p>
            <p><b>Status:</b> {viewRecord.record.status || 'Archived'}</p>
          </div>
          <div className="row-actions" style={{ marginTop: '16px' }}>
            <Button variant="ghost" onClick={() => setViewRecord(null)}>Close</Button>
          </div>
        </Modal>
      )}

      {restoreTarget && (
        <Modal
          open
          title="Retrieve / Restore Archived Record"
          subtitle="Retrieving a record for active follow-up requires a documented reason and is logged in the Audit Trail."
          onClose={() => setRestoreTarget(null)}
        >
          <form onSubmit={handleConfirmRestore}>
            <Notice tone="info">
              Restoring flags <b>{restoreTarget.code || restoreTarget.number || restoreTarget.id}</b> for active operational follow-up without altering or deleting original historical records.
            </Notice>
            <div style={{ marginTop: '12px' }}>
              <Field label="Reason for retrieval / restoration" required hint="Minimum 3 characters. Recorded in the clinic audit trail.">
                <input
                  type="text"
                  required
                  minLength={3}
                  value={restoreReason}
                  onChange={e => setRestoreReason(e.target.value)}
                  placeholder="e.g. Patient requested follow-up continuity review"
                  autoFocus
                />
              </Field>
            </div>
            <div className="row-actions" style={{ marginTop: '16px' }}>
              <Button variant="ghost" onClick={() => setRestoreTarget(null)}>Cancel</Button>
              <Button type="submit" disabled={restoreReason.trim().length < 3}>Confirm Retrieval</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
export default ArchivesPage
