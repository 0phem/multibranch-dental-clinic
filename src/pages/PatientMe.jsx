import React, { useState, useEffect } from 'react'
import { Button, Field, Modal, Notice, PageHeader, Status } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { patientContext } from '../patient-view.js'
import { DefinitionList, RecordCard } from '../patient-ui.jsx'
import { fetchMyDocuments, fetchMyConsents, submitDocumentUpload, retractDocument, downloadDocumentFile } from '../documents-api.js'

const NO_ACCOUNT = <Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

export function PatientMePage({ store, setPage }) {
  const { state, toast } = store, session = store.session
  const ctx = patientContext(state, session)
  const [docs, setDocs] = useState([])
  const [consents, setConsents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [fileToUpload, setFileToUpload] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('valid_id')
  const [uploading, setUploading] = useState(false)
  const [retractTarget, setRetractTarget] = useState(null)
  const [retractReason, setRetractReason] = useState('')

  const reload = async () => {
    try {
      setLoading(true)
      const [d, c] = await Promise.all([
        fetchMyDocuments().catch(() => []),
        fetchMyConsents().catch(() => []),
      ])
      setDocs(d)
      setConsents(c)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reload()
  }, [])

  if (!ctx) return NO_ACCOUNT
  const branch = state.branches.find(b => b.id === ctx.patient.preferredBranchId)

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!fileToUpload) return toast('Please select a file to upload.', 'warning')
    const formData = new FormData()
    formData.append('file', fileToUpload)
    formData.append('category', uploadCategory)
    if (uploadTitle.trim()) formData.append('title', uploadTitle.trim())

    setUploading(true)
    try {
      await submitDocumentUpload(formData)
      toast('Document uploaded successfully.', 'success')
      setUploadOpen(false)
      setFileToUpload(null)
      setUploadTitle('')
      await reload()
    } catch (err) {
      toast(err.message || 'Upload failed.', 'warning')
    } finally {
      setUploading(false)
    }
  }

  const handleDownload = async (doc) => {
    try {
      await downloadDocumentFile(doc.id, doc.originalFilename)
    } catch (err) {
      toast(err.message || 'Download failed.', 'warning')
    }
  }

  const handleRetract = async () => {
    if (!retractTarget) return
    if (!retractReason.trim()) return toast('Please provide a reason for retraction.', 'warning')
    try {
      await retractDocument(retractTarget.id, retractReason.trim())
      toast('Document retracted.', 'success')
      setRetractTarget(null)
      setRetractReason('')
      await reload()
    } catch (err) {
      toast(err.message || 'Retraction failed.', 'warning')
    }
  }

  return <div className="pt-page">
    <PageHeader kicker="Your account" title="Me" text="Your profile information, documents, and clinic consents."/>

    <section className="pt-record" aria-labelledby="pt-me-profile-title">
      <header><div><h2 id="pt-me-profile-title" className="pt-record-title">Profile</h2><p className="pt-record-sub">This information is read-only for now.</p></div></header>
      <DefinitionList items={[
        { label: 'Name', value: ctx.patient.name },
        { label: 'Email', value: ctx.patient.email },
        { label: 'Phone', value: ctx.patient.phone },
        { label: 'Date of birth', value: ctx.patient.dob ? dateLabel(ctx.patient.dob) : null },
        { label: 'Preferred branch', value: branch?.name },
      ]}/>
      <p className="pt-hint">Editing your profile will be available once secure, verified changes are supported. Contact the clinic if any of this needs to change now.</p>
    </section>

    <section className="pt-record" aria-labelledby="pt-me-consents-title" style={{ marginTop: '20px' }}>
      <header><div><h2 id="pt-me-consents-title" className="pt-record-title">Consents & Agreements</h2><p className="pt-record-sub">Active consent records on file with the clinic.</p></div></header>
      {loading ? <Notice>Loading consents...</Notice> : consents.length === 0 ? (
        <Notice tone="info">No active consent records found.</Notice>
      ) : (
        <div className="pt-list" style={{ marginTop: '12px' }}>
          {consents.map(c => (
            <RecordCard key={c.id} title={c.consentType?.replace(/_/g, ' ')} subtitle={`Version ${c.version} • Signed ${dateLabel(c.signedAt)}`} status={c.status}>
              {c.notes && <p className="pt-hint">{c.notes}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </section>

    <section className="pt-record" aria-labelledby="pt-me-docs-title" style={{ marginTop: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div><h2 id="pt-me-docs-title" className="pt-record-title">My Documents</h2><p className="pt-record-sub">IDs, insurance cards, and medical records stored securely in your private clinic record.</p></div>
        <Button size="sm" onClick={() => setUploadOpen(true)}>Upload Document</Button>
      </header>

      {loading ? <Notice>Loading documents...</Notice> : docs.length === 0 ? (
        <Notice tone="info">You haven't uploaded any documents yet. Use the upload button above to submit your ID or HMO card.</Notice>
      ) : (
        <div className="pt-list" style={{ marginTop: '12px' }}>
          {docs.map(doc => (
            <RecordCard key={doc.id} title={doc.title} subtitle={`${doc.originalFilename} • ${doc.fileSizeFormatted} • ${doc.category?.replace(/_/g, ' ')} • Uploaded ${dateLabel(doc.createdAt)}`} status={doc.status}>
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                {doc.status === 'Active' && <Button size="sm" variant="soft" onClick={() => handleDownload(doc)}>Download</Button>}
                {doc.status === 'Active' && <Button size="sm" variant="ghost" onClick={() => { setRetractTarget(doc); setRetractReason('') }}>Retract</Button>}
              </div>
              {doc.status === 'Retracted' && (
                <Notice tone="warning" style={{ marginTop: '8px' }}>
                  Retracted on {dateLabel(doc.retractedAt)}: {doc.retractionReason}
                </Notice>
              )}
            </RecordCard>
          ))}
        </div>
      )}
    </section>

    <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Upload Document" subtitle="Documents are stored in private clinic storage accessible only to you and authorized clinic staff.">
      <form onSubmit={handleUpload} className="form-grid">
        <Field label="Document File" required hint="PDF, JPG, PNG, or WebP. Max 10MB.">
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={e => {
              const file = e.target.files?.[0]
              setFileToUpload(file || null)
              if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
            }}
            required
          />
        </Field>
        <Field label="Title / Description">
          <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. Driver's License or Maxicare Card" />
        </Field>
        <Field label="Category" required>
          <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
            <option value="valid_id">Valid ID</option>
            <option value="hmo_card">HMO / Insurance Card</option>
            <option value="clinical_attachment">Medical / Dental Record</option>
            <option value="other">Other Document</option>
          </select>
        </Field>
        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
          <Button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload'}</Button>
        </div>
      </form>
    </Modal>

    <Modal open={!!retractTarget} onClose={() => setRetractTarget(null)} title="Retract Document" subtitle="Retracting revokes access to this document.">
      <div className="form-grid">
        <Field label="Reason for Retraction" required hint="Please provide a brief reason (e.g. uploaded outdated card).">
          <textarea value={retractReason} onChange={e => setRetractReason(e.target.value)} rows={3} />
        </Field>
        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={() => setRetractTarget(null)}>Cancel</Button>
          <Button type="button" variant="danger" onClick={handleRetract}>Confirm Retraction</Button>
        </div>
      </div>
    </Modal>
  </div>
}
