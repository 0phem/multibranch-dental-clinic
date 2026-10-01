import React, { useState, useEffect } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { fetchAuditLogs, downloadAuditLogsCsv } from '../audit-api.js'

export function AuditTrailPage({ store }) {
  const { state, toast } = store
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [branchId, setBranchId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [inspectLog, setInspectLog] = useState(null)
  const [exporting, setExporting] = useState(false)

  const reload = async () => {
    try {
      setLoading(true)
      const data = await fetchAuditLogs({
        search: search.trim() || undefined,
        category: category !== 'all' ? category : undefined,
        severity: severity !== 'all' ? severity : undefined,
        branch_id: branchId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        limit: 100,
      })
      setLogs(data)
    } catch (err) {
      toast(err.message || 'Failed to load audit trail.', 'warning')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      reload()
    }, 200)
    return () => clearTimeout(timer)
  }, [search, category, severity, branchId, dateFrom, dateTo])

  const handleExport = async () => {
    try {
      setExporting(true)
      await downloadAuditLogsCsv({
        search: search.trim() || undefined,
        category: category !== 'all' ? category : undefined,
        severity: severity !== 'all' ? severity : undefined,
        branch_id: branchId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      })
      toast('Audit trail export generated.', 'success')
    } catch (err) {
      toast(err.message || 'Failed to export audit logs.', 'warning')
    } finally {
      setExporting(false)
    }
  }

  const securityCount = logs.filter(l => l.severity === 'warning' || l.severity === 'critical' || l.category === 'security').length
  const financialCount = logs.filter(l => l.category === 'financial').length
  const clinicalCount = logs.filter(l => l.category === 'clinical').length

  const severityTone = (sev) => {
    if (sev === 'critical') return 'danger'
    if (sev === 'warning') return 'warning'
    return 'default'
  }

  return (
    <>
      <PageHeader
        title="Audit Trail & Activity Monitoring"
        text="Append-only, tamper-resistant system activity audit log with credential sanitization and forensic inspection."
        aside={
          <Button size="sm" variant="soft" onClick={handleExport} disabled={exporting}>
            {exporting ? 'Generating Export...' : 'Export Audit Trail (CSV)'}
          </Button>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Total Events</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{logs.length}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Security & Warnings</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px', color: securityCount > 0 ? '#b91c1c' : 'inherit' }}>{securityCount}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Financial Actions</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{financialCount}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Clinical Events</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{clinicalCount}</b>
        </div>
      </div>

      <Card title="Audit Event Filters">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <Field label="Search">
            <input
              type="search"
              placeholder="Action, actor, target ID, IP..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All Categories</option>
              <option value="security">Security</option>
              <option value="clinical">Clinical</option>
              <option value="financial">Financial</option>
              <option value="administrative">Administrative</option>
              <option value="automation">Automation</option>
              <option value="general">General</option>
            </select>
          </Field>
          <Field label="Severity">
            <select value={severity} onChange={e => setSeverity(e.target.value)}>
              <option value="all">All Severities</option>
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </Field>
          <Field label="Branch">
            <select value={branchId} onChange={e => setBranchId(e.target.value)}>
              <option value="">All Branches</option>
              {state.branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </Field>
          <Field label="From Date">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </Field>
          <Field label="To Date">
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </Field>
        </div>
      </Card>

      <div style={{ marginTop: '20px' }}>
        <Card title="Activity Log" subtitle="Chronological server-recorded events. Immutable and tamper-resistant.">
          {loading ? (
            <Notice>Loading audit records...</Notice>
          ) : logs.length === 0 ? (
            <Notice tone="info">No audit records match the current filter criteria.</Notice>
          ) : (
            <Table
              rows={logs}
              columns={[
                {
                  key: 'createdAt',
                  label: 'Timestamp',
                  render: l => (
                    <div>
                      <b>{dateLabel(l.createdAt)}</b>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>
                        {l.createdAt ? new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                      </small>
                    </div>
                  ),
                },
                {
                  key: 'severity',
                  label: 'Severity',
                  render: l => <Status tone={severityTone(l.severity)}>{l.severity}</Status>,
                },
                {
                  key: 'category',
                  label: 'Category',
                  render: l => <span style={{ textTransform: 'capitalize', fontSize: '11px', fontWeight: '600' }}>{l.category}</span>,
                },
                {
                  key: 'action',
                  label: 'Action',
                  render: l => <code style={{ fontSize: '11px', padding: '2px 4px', background: '#f1f5f9', borderRadius: '4px' }}>{l.action}</code>,
                },
                {
                  key: 'actor',
                  label: 'Actor',
                  render: l => (
                    <div>
                      <b>{l.actor?.name || 'System'}</b>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>{l.actor?.role || 'system'}</small>
                    </div>
                  ),
                },
                {
                  key: 'branch',
                  label: 'Branch',
                  render: l => l.branch?.name || 'All Branches',
                },
                {
                  key: 'target',
                  label: 'Target',
                  render: l => l.auditableType ? (
                    <small style={{ fontSize: '10px' }}>
                      <b>{l.auditableType}</b>: {l.auditableId || '—'}
                    </small>
                  ) : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>—</span>,
                },
                {
                  key: 'actions',
                  label: 'Details',
                  render: l => (
                    <Button size="sm" variant="ghost" onClick={() => setInspectLog(l)}>
                      Inspect
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <Modal open={!!inspectLog} onClose={() => setInspectLog(null)} title="Audit Event Inspection" subtitle={inspectLog?.id} wide>
        {inspectLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Action</small>
                <b>{inspectLog.action}</b>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Category & Severity</small>
                <span>{inspectLog.category} • <Status tone={severityTone(inspectLog.severity)}>{inspectLog.severity}</Status></span>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Actor</small>
                <b>{inspectLog.actor?.name}</b> ({inspectLog.actor?.role})
              </div>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Branch</small>
                <span>{inspectLog.branch?.name || 'All Branches'}</span>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Timestamp</small>
                <span>{inspectLog.createdAt}</span>
              </div>
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>Client IP</small>
                <code>{inspectLog.ipAddress || '—'}</code>
              </div>
            </div>

            {inspectLog.userAgent && (
              <div>
                <small style={{ color: 'var(--muted)', display: 'block' }}>User Agent</small>
                <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{inspectLog.userAgent}</code>
              </div>
            )}

            <div>
              <small style={{ color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>Event Payload (Sanitized)</small>
              <pre
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--line)',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '11px',
                  maxHeight: '260px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {JSON.stringify(inspectLog.payload, null, 2)}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button onClick={() => setInspectLog(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
