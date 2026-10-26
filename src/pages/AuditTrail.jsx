import React, { useState, useEffect } from 'react'
import { Brand } from '../Brand.jsx'
import { Button, Card, Field, FilterBar, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { fetchAuditLogs, downloadAuditLogsCsv } from '../audit-api.js'

export function AuditTrailPage({ store }) {
  const { state, toast } = store
  const [logs, setLogs] = useState([])
  const [status, setStatus] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const [nextCursor, setNextCursor] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [severity, setSeverity] = useState('all')
  const [branchId, setBranchId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [inspectLog, setInspectLog] = useState(null)
  const [exporting, setExporting] = useState(false)
  const rangeInvalid = !!(dateFrom && dateTo && dateFrom > dateTo)

  const filters = () => ({
    search: search.trim() || undefined,
    category: category !== 'all' ? category : undefined,
    severity: severity !== 'all' ? severity : undefined,
    branch_id: branchId || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  })

  // Debounced server query. A response for an older filter set is discarded, and a failure is an explicit error with Retry:
  // never an empty list and never browser-held or demo activity.
  useEffect(() => {
    if (rangeInvalid) return undefined
    let live = true
    setStatus('loading')
    setLoadError('')
    const timer = setTimeout(async () => {
      try {
        const page = await fetchAuditLogs({ ...filters(), per_page: 50 })
        if (!live) return
        setLogs(page.rows)
        setNextCursor(page.nextCursor)
        setStatus('ready')
      } catch (err) {
        if (!live) return
        setLogs([])
        setNextCursor(null)
        setLoadError(err.message || 'The audit trail could not be loaded.')
        setStatus('error')
      }
    }, 200)
    return () => { live = false; clearTimeout(timer) }
  }, [search, category, severity, branchId, dateFrom, dateTo, attempt])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await fetchAuditLogs({ ...filters(), per_page: 50, cursor: nextCursor })
      setLogs(previous => [...previous, ...page.rows.filter(row => !previous.some(p => p.id === row.id))])
      setNextCursor(page.nextCursor)
    } catch (err) {
      toast(err.message || 'More audit records could not be loaded.', 'warning')
    } finally {
      setLoadingMore(false)
    }
  }

  const handleExport = async () => {
    try {
      setExporting(true)
      const result = await downloadAuditLogsCsv(filters())
      toast(result.truncated ? `Export generated, but cut at the newest ${result.limit} matching events. Narrow the filters for the rest.` : 'Audit trail export generated.', result.truncated ? 'warning' : 'success')
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
        text="Append-only record of significant events written by the clinic server. The Owner can review and export it; nothing in this screen can change or delete an entry. Details are kept minimal and credentials are redacted."
        aside={
          <div className="row-actions">
            <Button size="sm" variant="soft" onClick={handleExport} disabled={exporting}>
              {exporting ? 'Generating Export...' : 'Export Audit Trail (CSV)'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()} icon="file">
              Download / Print PDF
            </Button>
          </div>
        }
      />

      <div className="audit-print-header" style={{ display: 'none', marginBottom: '20px', paddingBottom: '12px', borderBottom: '2px solid #0f172a' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Brand />
          <div style={{ textAlign: 'right' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800' }}>Official Audit Trail & Compliance Log</h3>
            <span style={{ fontSize: '11px', color: '#64748b' }}>Generated on {new Date().toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <style>{`
        @media print {
          .audit-print-header { display: block !important; }
          .card { border: none !important; box-shadow: none !important; }
        }
      `}</style>
<Card title="Audit Event Filters">
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Action, actor, target ID, IP…"
          filters={[
            {
              key: 'category',
              label: 'Category',
              value: category,
              onChange: setCategory,
              options: [
                { value: 'all', label: 'All Categories' },
                { value: 'security', label: 'Security' },
                { value: 'clinical', label: 'Clinical' },
                { value: 'financial', label: 'Financial' },
                { value: 'administrative', label: 'Administrative' },
                { value: 'automation', label: 'Automation' },
                { value: 'general', label: 'General' },
              ],
            },
            {
              key: 'severity',
              label: 'Severity',
              value: severity,
              onChange: setSeverity,
              options: [
                { value: 'all', label: 'All Severities' },
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'critical', label: 'Critical' },
              ],
            },
            {
              key: 'branch',
              label: 'Branch',
              value: branchId,
              onChange: setBranchId,
              options: [
                { value: '', label: 'All Branches' },
                ...state.branches.map(b => ({ value: b.id, label: b.name })),
              ],
            },
          ]}
          count={logs.length}
          onReset={() => {
            setSearch('')
            setCategory('all')
            setSeverity('all')
            setBranchId('')
            setDateFrom('')
            setDateTo('')
          }}
        />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: '600', color: 'var(--muted)' }}>From:</span>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px' }}/>
          </label>
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: '600', color: 'var(--muted)' }}>To:</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--line)', fontSize: '13px' }}/>
          </label>
          {rangeInvalid && <span style={{ color: '#dc2626', fontSize: '12px', fontWeight: '600' }}>The end date is before the start date.</span>}
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Events loaded</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{logs.length}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Security & warnings (loaded)</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px', color: securityCount > 0 ? '#b91c1c' : 'inherit' }}>{securityCount}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Financial (loaded)</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{financialCount}</b>
        </div>
        <div style={{ padding: '14px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--surface)' }}>
          <span style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '700' }}>Clinical (loaded)</span>
          <b style={{ display: 'block', fontSize: '20px', marginTop: '4px' }}>{clinicalCount}</b>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <Card title="Activity Log" subtitle="Newest first, recorded by the clinic server. Entries cannot be edited or deleted from the application.">
          {rangeInvalid ? (
            <Notice tone="warning">Fix the date range to load audit records.</Notice>
          ) : status === 'loading' ? (
            <Notice>Loading audit records...</Notice>
          ) : status === 'error' ? (
            <Notice tone="warning" title="Audit trail unavailable">{loadError} <Button size="sm" variant="ghost" onClick={() => setAttempt(attempt + 1)}>Retry</Button></Notice>
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
                      <b>{l.actor?.name || 'Anonymous'}</b>
                      <small style={{ display: 'block', color: 'var(--muted)', fontSize: '10px' }}>{l.actor?.role || 'anonymous'}</small>
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
          {status === 'ready' && nextCursor && !rangeInvalid && (
            <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
              <Button variant="soft" onClick={loadMore} disabled={loadingMore}>{loadingMore ? 'Loading…' : 'Load older events'}</Button>
            </div>
          )}
          {status === 'ready' && !nextCursor && logs.length > 0 && <p className="muted" style={{ textAlign: 'center', marginTop: '12px', fontSize: '11px' }}>End of the matching history.</p>}
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
