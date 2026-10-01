import React, { useState } from 'react'
import { ROLE_INFO } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table, Tabs } from '../components.jsx'
import { dateLabel, dentistName, displayTime, patientName } from '../logic.js'
import { AppointmentForm } from './Scheduling.jsx'
import { PatientPrescriptionsPage } from './PatientCare.jsx'
import { PatientFollowupsPage } from './PatientVisits.jsx'

import { visibleHmo } from '../phase3-contracts.js'
import { visiblePrescriptions, prescriptionTasks, linkedTreatment, followupDisplayState } from '../phase2.js'
import { inScope, isTodayQueue, patientInScope, sessionForRole } from '../contracts.js'
import { fetchDocuments, submitDocumentUpload, retractDocument, fetchPatientConsents, grantConsent, withdrawConsent, downloadDocumentFile } from '../documents-api.js'

export function PatientsPage({ role, store, context, setPage }) {
  const { state, actions, toast, log }=store
  const session=store.session||sessionForRole(role,state)
  const availablePatients=state.patients.filter(p=>patientInScope(p,state,session))
  const [selected,setSelected]=useState(context?.patientId||availablePatients[0]?.id||'')
  React.useEffect(()=>{if(context?.patientId)setSelected(context.patientId)},[context?.patientId])
  const [tab,setTab]=useState('summary')
  const [search,setSearch]=useState('')
  const [newOpen,setNewOpen]=useState(false)
  const [newPatient,setNewPatient]=useState({firstName:'',lastName:'',dob:'',sex:'Female',phone:'',email:'',address:'',preferredBranch:'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false,createPortalAccount:false})
  const patient=availablePatients.find(p=>p.id===selected)
  const visits=state.appointments.filter(a=>a.patientId===selected&&inScope(a,session,state)).sort((a,b)=>`${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
  // M5: server Treatments (already scoped by the server) first, then read-only pre-server history.
  const treatments=state.treatments.filter(t=>t.patientId===selected).sort((a,b)=>Number(!!b.server)-Number(!!a.server)||String(b.date).localeCompare(String(a.date)))
  const hmo=visibleHmo(state,session).filter(h=>h.patientId===selected)
  const encounter=state.queue.find(q=>q.id===context?.queueEntryId&&q.patientId===selected&&inScope(q,session,state)&&isTodayQueue(q))
  const saveRecord=({person,patient:patientPatch})=>{
    const result=actions.updatePatientRecord(selected,{person,patient:patientPatch})
    if(!result.ok)return toast(result.message,'warning')
    log(role==='dentist'?ROLE_INFO.dentist.name:ROLE_INFO.staff.name,`Updated permitted patient record fields ${selected}`,'patient')
    toast('Patient record updated.','success')
  }
  const createPatient=()=>{
    if(role!=='staff')return
    const result=actions.createPatientRecord({
      person:{firstName:newPatient.firstName,lastName:newPatient.lastName,dob:newPatient.dob,sex:newPatient.sex,phone:newPatient.phone,email:newPatient.email,address:newPatient.address},
      patient:{preferredBranch:newPatient.preferredBranch,allergies:newPatient.allergies,medicalHistory:newPatient.medicalHistory,dentalHistory:newPatient.dentalHistory,emergencyContact:newPatient.emergencyContact,consent:newPatient.consent},
      createPortalAccount:newPatient.createPortalAccount
    })
    if(!result.ok)return toast(result.message,'warning')
    toast(result.record.userId?'Patient record and portal account created.':'Centralized patient record created.','success')
    setSelected(result.record.id);setNewOpen(false)
    setNewPatient({firstName:'',lastName:'',dob:'',sex:'Female',phone:'',email:'',address:'',preferredBranch:'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false,createPortalAccount:false})
  }
  const tabs=[{key:'summary',label:'Summary'},{key:'visits',label:'Visit history',count:visits.length},{key:'clinical',label:'Clinical',count:treatments.length},{key:'hmo',label:'HMO',count:hmo.length},{key:'documents',label:'Documents'}]
  return <>
    <PageHeader title="Centralized Patient Records" text="Identity and contact details are shared across the patient record. Staff may maintain approved demographics; dentists see those fields read-only and edit only clinical information." aside={role==='dentist'&&encounter&&(['Called','Treatment Ready'].includes(encounter.status)||encounter.status==='Served'&&encounter.visitStatus==='In Treatment')?<Button onClick={()=>setPage('treatment',context)}>{encounter.treatmentId?'Continue Treatment':'Open Treatment'}</Button>:null}/>
    {!patient?<Notice>The selected patient is unavailable in your current scope. {availablePatients.length>0&&<Button onClick={()=>setSelected(availablePatients[0].id)}>Open an available patient</Button>}{role==='staff'&&<Button onClick={()=>setNewOpen(true)}>New Patient</Button>}</Notice>:<div className="records-layout">
      <Card className="patient-list" title="Patients" actions={role==='staff'?<Button size="sm" onClick={()=>setNewOpen(true)}>New Patient</Button>:null}><input className="search-input" aria-label="Search patients" placeholder="Search patient..." value={search} onChange={e=>setSearch(e.target.value)}/><div className="patient-list-scroll">{availablePatients.filter(p=>`${p.name} ${p.patientCode||''}`.toLowerCase().includes(search.trim().toLowerCase())).map(p=><button key={p.id} className={selected===p.id?'selected':''} onClick={()=>{setSelected(p.id);setTab('summary')}}><span className="avatar">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><b>{p.name}</b><small>{p.patientCode||p.id} • {p.preferredBranch} • {p.hmo}</small></div></button>)}</div></Card>
      <div>
        <Card className="patient-header-card"><div className="patient-record-head"><div className="avatar xl">{patient.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>{patient.name}</h2><p>{patient.patientCode||patient.id} • {patient.dob||'DOB not set'} • {patient.sex||'—'} • {patient.preferredBranch}</p><div className="chip-row"><span className="mini-chip">Allergies: {patient.allergies}</span>{patient.consent&&<span className="mini-chip success">Consent on file</span>}</div></div></div></Card>
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
        {tab==='summary'&&<SummaryTab key={patient.id} patient={patient} role={role} onSave={saveRecord}/>}
        {tab==='visits'&&<Card title="Cross-branch visit history"><Table rows={visits} columns={[{key:'date',label:'Date',render:a=>dateLabel(a.date)},{key:'branch',label:'Branch'},{key:'service',label:'Service'},{key:'dentist',label:'Dentist',render:a=>dentistName(a.dentistId,state.dentists)},{key:'status',label:'Status',render:a=><Status>{a.status}</Status>}]} /></Card>}
        {tab==='clinical'&&<Card title="Treatment history" subtitle={role==='dentist'?'Clinic server records you may read: your own treatments and, while you treat this patient, their earlier completed treatments. Read-only unless you are the treating Dentist.':'Staff read-only clinical record'}>{treatments.length?treatments.map(t=><div className="clinical-history" key={t.id}><div><b>{dateLabel(t.date)} • {t.procedure||t.plan||'Treatment in progress'}</b>{t.complaint&&<p>Complaint: {t.complaint}</p>}{t.plan&&<p>Plan: {t.plan}</p>}{t.notes&&<p>{t.notes}</p>}{Array.isArray(t.procedures)&&t.procedures.length>0&&<p>{t.procedures.map(p=>`${p.serviceName||state.services.find(s=>s.id===p.serviceId)?.name||'Service'} × ${p.quantity}`).join(', ')}</p>}<small>{t.dentistName||dentistName(t.dentistId,state.dentists)} • {t.status}</small>{!t.server&&<small className="block-muted">{t.legacyAppointment?'Historical demo record':'Recorded before server treatment records'} — read-only</small>}</div><Status>{t.status}</Status></div>):<Notice>No treatment history recorded.</Notice>}</Card>}
        {tab==='hmo'&&<Card title="HMO record" subtitle="Server HMO cases for this patient's visits; earlier browser records are marked as history. Membership is recorded in HMO Management."><Table rows={hmo} columns={[{key:'provider',label:'Provider'},{key:'memberId',label:'Member ID'},{key:'clinicDate',label:'Visit',render:h=>h.clinicDate?dateLabel(h.clinicDate):h.legacy?'Earlier record':'—'},{key:'eligibility',label:'Eligibility',render:h=><Status>{h.eligibility}</Status>},{key:'status',label:'Status',render:h=><Status>{h.status}</Status>}]} /></Card>}
        {tab==='documents'&&<PatientDocumentsTab patient={patient} role={role} store={store}/>}
      </div>
    </div>}
    <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="Create patient record" subtitle="Identity/contact fields create one PERSON record; PATIENTS stores only patient-specific information." wide><div className="form-grid">
      <Field label="First name" required><input value={newPatient.firstName} onChange={e=>setNewPatient({...newPatient,firstName:e.target.value})}/></Field>
      <Field label="Last name" required><input value={newPatient.lastName} onChange={e=>setNewPatient({...newPatient,lastName:e.target.value})}/></Field>
      <Field label="Phone" required><input value={newPatient.phone} onChange={e=>setNewPatient({...newPatient,phone:e.target.value})}/></Field>
      <Field label="Date of birth"><input type="date" value={newPatient.dob} onChange={e=>setNewPatient({...newPatient,dob:e.target.value})}/></Field>
      <Field label="Sex"><select value={newPatient.sex} onChange={e=>setNewPatient({...newPatient,sex:e.target.value})}><option>Female</option><option>Male</option><option>Other</option></select></Field>
      <Field label="Email"><input type="email" value={newPatient.email} onChange={e=>setNewPatient({...newPatient,email:e.target.value})}/></Field>
      <Field label="Preferred branch"><select value={newPatient.preferredBranch} onChange={e=>setNewPatient({...newPatient,preferredBranch:e.target.value})}>{state.branches.filter(b=>role==='owner'||b.id===session.branchId).map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
      <Field label="Address"><textarea value={newPatient.address} onChange={e=>setNewPatient({...newPatient,address:e.target.value})}/></Field>
      <Field label="Emergency contact"><textarea value={newPatient.emergencyContact} onChange={e=>setNewPatient({...newPatient,emergencyContact:e.target.value})}/></Field>
      <label className="check-control"><input type="checkbox" checked={newPatient.consent} onChange={e=>setNewPatient({...newPatient,consent:e.target.checked})}/><span><b>Consent recorded</b><small>Frontend marker only; real consent evidence is stored separately.</small></span></label>
      <label className="check-control"><input type="checkbox" checked={newPatient.createPortalAccount} onChange={e=>setNewPatient({...newPatient,createPortalAccount:e.target.checked})}/><span><b>Create patient portal account</b><small>Optional. A patient record may exist without a login.</small></span></label>
      <Button className="span-2" onClick={createPatient}>Create Central Patient Record</Button>
    </div></Modal>
  </>
}

function SummaryTab({ patient, role, onSave }) {
  const [form,setForm]=useState(patient)
  React.useEffect(()=>setForm(patient),[patient.id,patient.firstName,patient.lastName,patient.phone,patient.email,patient.allergies,patient.medicalHistory,patient.dentalHistory])
  const update=(k,v)=>setForm({...form,[k]:v})
  const staff=role==='staff', dentist=role==='dentist'
  const save=()=>onSave({
    person:staff?{firstName:form.firstName,lastName:form.lastName,phone:form.phone,email:form.email,dob:form.dob,sex:form.sex,address:form.address}:{},
    patient:staff?{preferredBranch:form.preferredBranch,emergencyContact:form.emergencyContact,consent:form.consent}:{allergies:form.allergies,medicalHistory:form.medicalHistory,dentalHistory:form.dentalHistory}
  })
  return <Card title="Patient summary" subtitle={staff?'Staff maintains approved demographics/contact/HMO fields. Clinical history remains read-only.':'Patient identity/contact information is read-only for the dentist; only clinical fields can be updated.'}>
    <div className="form-grid">
      <Field label="Patient code"><input value={form.patientCode||form.id} disabled/></Field>
      <Field label="First name"><input value={form.firstName||''} disabled={dentist} onChange={e=>update('firstName',e.target.value)}/></Field>
      <Field label="Last name"><input value={form.lastName||''} disabled={dentist} onChange={e=>update('lastName',e.target.value)}/></Field>
      <Field label="Preferred branch"><input value={form.preferredBranch||''} disabled={dentist} onChange={e=>update('preferredBranch',e.target.value)}/></Field>
      <Field label="Phone"><input value={form.phone||''} disabled={dentist} onChange={e=>update('phone',e.target.value)}/></Field>
      <Field label="Email"><input value={form.email||''} disabled={dentist} onChange={e=>update('email',e.target.value)}/></Field>
      <Field label="Date of birth"><input type="date" value={form.dob||''} disabled={dentist} onChange={e=>update('dob',e.target.value)}/></Field>
      <Field label="Sex"><input value={form.sex||''} disabled={dentist} onChange={e=>update('sex',e.target.value)}/></Field>
      <Field label="Address"><textarea value={form.address||''} disabled={dentist} onChange={e=>update('address',e.target.value)}/></Field>
      {(form.hmo&&form.hmo!=='None'||form.hmoMember&&form.hmoMember!=='—')&&<Field label="Earlier HMO note" hint="Read-only earlier browser note. HMO membership is recorded on the clinic server in HMO Management."><input value={[form.hmo,form.hmoMember].filter(v=>v&&v!=='None'&&v!=='—').join(' • ')} disabled/></Field>}
      <Field label="Allergies" hint={staff?'Read-only for staff; clinical changes require a dentist.':''}><textarea value={form.allergies||''} disabled={staff} onChange={e=>update('allergies',e.target.value)}/></Field>
      <Field label="Medical history" hint={staff?'Read-only clinical field':''}><textarea value={form.medicalHistory||''} disabled={staff} onChange={e=>update('medicalHistory',e.target.value)}/></Field>
      <Field label="Dental history" hint={staff?'Read-only clinical field':''}><textarea value={form.dentalHistory||''} disabled={staff} onChange={e=>update('dentalHistory',e.target.value)}/></Field>
      <Field label="Emergency contact"><textarea value={form.emergencyContact||''} disabled={dentist} onChange={e=>update('emergencyContact',e.target.value)}/></Field>
      <Button className="span-2" onClick={save}>Save permitted changes</Button>
    </div>
  </Card>
}

function PatientDocumentsTab({ patient, role, store }) {
  const { toast, session } = store
  const [docs, setDocs] = useState([])
  const [consents, setConsents] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [retractTarget, setRetractTarget] = useState(null)
  const [retractReason, setRetractReason] = useState('')
  const [consentOpen, setConsentOpen] = useState(false)
  const [consentForm, setConsentForm] = useState({ consent_type: 'general_treatment', version: '1.0', notes: '' })
  const [fileToUpload, setFileToUpload] = useState(null)
  const [uploadCategory, setUploadCategory] = useState('clinical_attachment')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [expandedExtraction, setExpandedExtraction] = useState(null)

  const patientIdentifier = patient?.publicId || patient?.patientCode || patient?.id

  const reload = async () => {
    if (!patientIdentifier) return
    try {
      setLoading(true)
      const [docList, consentList] = await Promise.all([
        fetchDocuments({ patient_id: patientIdentifier }),
        fetchPatientConsents(patientIdentifier).catch(() => []),
      ])
      setDocs(docList)
      setConsents(consentList)
    } catch (err) {
      toast(err.message || 'Could not load patient documents', 'warning')
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    reload()
  }, [patientIdentifier])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!fileToUpload) return toast('Please select a file to upload.', 'warning')
    const formData = new FormData()
    formData.append('file', fileToUpload)
    formData.append('patient_id', patientIdentifier)
    formData.append('category', uploadCategory)
    if (uploadTitle.trim()) formData.append('title', uploadTitle.trim())
    if (session?.branchId) formData.append('branch_id', session.branchId)

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

  const handleGrantConsent = async (e) => {
    e.preventDefault()
    try {
      await grantConsent(patientIdentifier, consentForm)
      toast('Consent granted on file.', 'success')
      setConsentOpen(false)
      setConsentForm({ consent_type: 'general_treatment', version: '1.0', notes: '' })
      await reload()
    } catch (err) {
      toast(err.message || 'Could not record consent.', 'warning')
    }
  }

  const handleWithdrawConsent = async (consentId) => {
    try {
      await withdrawConsent(patientIdentifier, consentId)
      toast('Consent withdrawn.', 'success')
      await reload()
    } catch (err) {
      toast(err.message || 'Could not withdraw consent.', 'warning')
    }
  }

  const isOwner = role === 'owner'

  return <>
    <Card
      title="Patient Documents & Forms"
      subtitle="Encrypted, private server storage with SHA-256 integrity verification. Downloads are served through authenticated streaming guards."
      actions={
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isOwner && <Button size="sm" onClick={() => setUploadOpen(true)}>Upload Document</Button>}
          {!isOwner && <Button size="sm" variant="soft" onClick={() => setConsentOpen(true)}>Record Consent</Button>}
        </div>
      }
    >
      {loading ? <Notice>Loading documents and consents...</Notice> : <>
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700' }}>Active Consents & Agreements</h4>
          {consents.length === 0 ? (
            <Notice tone="info">No consent records found for this patient.</Notice>
          ) : (
            <Table
              rows={consents}
              columns={[
                { key: 'consentType', label: 'Consent Type', render: c => c.consentType?.replace(/_/g, ' ') },
                { key: 'version', label: 'Version' },
                { key: 'status', label: 'Status', render: c => <Status>{c.status}</Status> },
                { key: 'signedAt', label: 'Signed Date', render: c => dateLabel(c.signedAt) },
                { key: 'actions', label: 'Actions', render: c => (
                  c.status === 'Granted' && !isOwner ? (
                    <Button size="sm" variant="ghost" onClick={() => handleWithdrawConsent(c.id)}>Withdraw</Button>
                  ) : null
                )},
              ]}
            />
          )}
        </div>

        <div>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700' }}>Uploaded Patient Documents</h4>
          {docs.length === 0 ? (
            <Notice tone="info">No documents uploaded for this patient yet.</Notice>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {docs.map(doc => (
                <div
                  key={doc.id}
                  style={{
                    border: '1px solid var(--line)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    backgroundColor: doc.status === 'Retracted' ? 'rgba(0,0,0,0.02)' : 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <b style={{ fontSize: '12px', display: 'block' }}>{doc.title}</b>
                      <small style={{ color: 'var(--muted)', fontSize: '10px' }}>
                        {doc.originalFilename} • {doc.fileSizeFormatted} • {doc.category?.replace(/_/g, ' ')} • Uploaded {dateLabel(doc.createdAt)}
                      </small>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <Status>{doc.status}</Status>
                      {doc.status === 'Active' && (
                        <>
                          <Button size="sm" variant="soft" onClick={() => handleDownload(doc)}>Download</Button>
                          {!isOwner && <Button size="sm" variant="ghost" onClick={() => { setRetractTarget(doc); setRetractReason('') }}>Retract</Button>}
                        </>
                      )}
                    </div>
                  </div>

                  {doc.status === 'Retracted' && (
                    <Notice tone="warning">
                      Retracted on {dateLabel(doc.retractedAt)}: {doc.retractionReason}
                    </Notice>
                  )}

                  {doc.checksumSha256 && (
                    <small style={{ fontFamily: 'monospace', fontSize: '9px', color: 'var(--muted)' }}>
                      SHA-256: {doc.checksumSha256.slice(0, 16)}...{doc.checksumSha256.slice(-8)}
                    </small>
                  )}

                  {doc.extractions && doc.extractions.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedExtraction(expandedExtraction === doc.id ? null : doc.id)}
                      >
                        {expandedExtraction === doc.id ? 'Hide Extracted Text (Draft)' : `View Extracted Text Draft (${doc.extractions.length})`}
                      </Button>
                      {expandedExtraction === doc.id && (
                        <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '6px', fontSize: '11px' }}>
                          <p style={{ margin: '0 0 6px 0', fontWeight: '600', color: 'var(--muted)' }}>
                            Status: <span style={{ color: 'var(--brand)' }}>Draft (Advisory Only)</span> • Method: {doc.extractions[0].extractionMethod}
                          </p>
                          {doc.extractions[0].rawText && (
                            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'auto', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid var(--line)', fontSize: '10px' }}>
                              {doc.extractions[0].rawText}
                            </pre>
                          )}
                          {doc.extractions[0].structuredPayload && Object.keys(doc.extractions[0].structuredPayload).length > 0 && (
                            <div style={{ marginTop: '6px' }}>
                              <b>Suggested fields:</b>
                              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                                {Object.entries(doc.extractions[0].structuredPayload).map(([k, v]) => (
                                  <li key={k}><b>{k}</b>: {String(v)}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </>}
    </Card>

    <Modal open={uploadOpen} onClose={() => !uploading && setUploadOpen(false)} title="Upload Patient Document" subtitle="Files are stored securely in encrypted private storage.">
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
          <input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} placeholder="e.g. National ID or Panoramic X-Ray" />
        </Field>
        <Field label="Category" required>
          <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)}>
            <option value="consent_document">Consent Document</option>
            <option value="valid_id">Valid ID</option>
            <option value="clinical_attachment">Clinical Attachment</option>
            <option value="hmo_card">HMO Card</option>
            <option value="treatment_request">Treatment Request</option>
            <option value="prescription_source">Prescription Source</option>
            <option value="invoice_proof">Payment Proof</option>
            <option value="other">Other Document</option>
          </select>
        </Field>
        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancel</Button>
          <Button type="submit" disabled={uploading}>{uploading ? 'Uploading...' : 'Upload Document'}</Button>
        </div>
      </form>
    </Modal>

    <Modal open={!!retractTarget} onClose={() => setRetractTarget(null)} title="Retract Document" subtitle="Retracting revokes download access and marks the record as retracted with an audit trail.">
      <div className="form-grid">
        <Field label="Retraction Reason" required hint="Explain why this document is being retracted (e.g. incorrect patient file, corrupted scan).">
          <textarea value={retractReason} onChange={e => setRetractReason(e.target.value)} placeholder="Provide audit explanation..." rows={3} />
        </Field>
        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={() => setRetractTarget(null)}>Cancel</Button>
          <Button type="button" variant="danger" onClick={handleRetract}>Confirm Retraction</Button>
        </div>
      </div>
    </Modal>

    <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Record Patient Consent" subtitle="Records patient consent agreement on file.">
      <form onSubmit={handleGrantConsent} className="form-grid">
        <Field label="Consent Type" required>
          <select value={consentForm.consent_type} onChange={e => setConsentForm({ ...consentForm, consent_type: e.target.value })}>
            <option value="general_treatment">General Dental Treatment</option>
            <option value="data_privacy">Data Privacy & Consent</option>
            <option value="procedure_specific">Procedure-Specific Consent</option>
            <option value="financial_agreement">Financial & HMO Agreement</option>
          </select>
        </Field>
        <Field label="Version">
          <input value={consentForm.version} onChange={e => setConsentForm({ ...consentForm, version: e.target.value })} />
        </Field>
        <Field label="Notes / Witness" className="span-2">
          <textarea value={consentForm.notes} onChange={e => setConsentForm({ ...consentForm, notes: e.target.value })} placeholder="Signed in-person at clinic counter..." rows={2} />
        </Field>
        <div className="span-2" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
          <Button type="button" variant="ghost" onClick={() => setConsentOpen(false)}>Cancel</Button>
          <Button type="submit">Record Consent</Button>
        </div>
      </form>
    </Modal>
  </>
}


// The editable Treatment form, derived from the server record (or empty before treatment starts). Unsaved changes live
// only in React memory; there are no browser Treatment drafts.
const treatmentForm=(t,dentist)=>({
  complaint:t?.complaint||'',plan:t?.plan||'',procedure:t?.procedure||'',notes:t?.notes||'',
  assistant:t?t.assistant||'Unassigned':dentist?.assistant||'Unassigned',
  prescriptionRequired:!!t?.prescriptionRequired,followupRequired:!!t?.followupRequired,
  followupDate:t?.followupDate||'',followupReason:t?.followupReason||'',followupInterval:t?.followupInterval||'',
  procedures:(t?.procedures||[]).map(p=>({id:p.id,serviceId:p.serviceId,quantity:p.quantity,notes:p.notes||''})),
})
const formKey=form=>JSON.stringify({...form,assistant:undefined,procedures:form.procedures.map(p=>({...p,quantity:String(p.quantity)}))})

export function TreatmentPage({ store, context, setPage }) {
  const { state, toast }=store
  const session=store.session||sessionForRole('dentist',state)
  const flow=store.appointmentFlow
  const queueEntry=state.queue.find(q=>q.id===context?.queueEntryId&&inScope(q,session,state)&&isTodayQueue(q))
  // M5: the clinical record is the server Treatment of the encounter's Visit (never a browser record).
  const treatment=state.treatments.find(t=>t.server&&(context?.treatmentId&&t.id===context.treatmentId||queueEntry?.visitId&&t.visitId===queueEntry.visitId))||null
  const visitId=treatment?.visitId||queueEntry?.visitId||null
  const visit=(state.visits||[]).find(v=>v.id===visitId)||null
  const patientId=treatment?.patientId||queueEntry?.patientId||''
  const patient=state.patients.find(p=>p.id===patientId)
  const dentist=state.dentists.find(d=>d.id===session.dentistId)
  const [base,setBase]=useState(treatment)
  const [form,setForm]=useState(()=>treatmentForm(treatment,dentist))
  const [saving,setSaving]=useState(false)
  const dirty=formKey(form)!==formKey(treatmentForm(base,dentist))
  // Adopt the latest server record when nothing is unsaved; otherwise keep the Dentist's text and flag the newer version.
  React.useEffect(()=>{
    if(!dirty||!base){setBase(treatment);setForm(treatmentForm(treatment,dentist))}
  },[treatment?.id,treatment?.revision,treatment?.status])
  const newer=!!treatment&&!!base&&treatment.revision!==base.revision
  const reloadLatest=()=>{setBase(treatment);setForm(treatmentForm(treatment,dentist))}
  const readOnly=!!treatment&&(treatment.status!=='In Treatment'||!treatment.author)
  const canStart=!treatment&&!!queueEntry&&['Called','Treatment Ready'].includes(queueEntry.status)&&visit?.status==='Checked In'
  const performedServices=state.services.filter(s=>s.status==='Active'&&state.branchServices.some(bs=>bs.branchId===(treatment?.branchId||queueEntry?.branchId)&&bs.serviceId===s.id&&bs.active!==false)&&state.dentistServiceAssignments.some(a=>a.dentistId===session.dentistId&&a.serviceId===s.id&&a.isAuthorized!==false))
  const priorCare=state.treatments.filter(t=>t.server&&t.patientId===patientId&&t.status==='Completed'&&t.id!==treatment?.id)
  const done=(result,message)=>{
    // A refused or partial step keeps the Dentist's unsaved text on screen (a started-but-undocumented treatment only
    // becomes the new base record, so Save retries the documentation against it).
    if(!result.ok){toast(result.message,'warning');if(result.record)setBase(result.record);return}
    setBase(result.record);setForm(treatmentForm(result.record,dentist))
    toast(result.warnings?.length?`${message} Clinic review needed: ${result.warnings.join(' ')}`:message,result.warnings?.length?'warning':'success')
  }
  const act=async fn=>{setSaving(true);try{await fn()}finally{setSaving(false)}}
  const start=()=>act(async()=>done(await flow.startTreatment(queueEntry,form),'Treatment started.'))
  // Saves against the revision this form was loaded from, so a newer save elsewhere is reported, never overwritten.
  const save=()=>act(async()=>done(await flow.saveTreatment({...treatment,revision:base.revision},form),'Treatment progress saved.'))
  const complete=()=>act(async()=>done(await flow.completeTreatment({...treatment,revision:base.revision},form,{dirty}),'Treatment completed; this encounter is closed and downstream tasks prepared.'))
  const line=(index,key,value)=>setForm({...form,procedures:form.procedures.map((p,i)=>i===index?{...p,[key]:value}:p)})
  return <>
    <PageHeader title="Treatment & Clinical Workflow" text="Treatment opens from the logged-in dentist’s active queue. Patient, appointment, dentist, branch, and service context are loaded automatically; clinical judgment remains with the dentist."/>
    {!queueEntry&&!treatment?<Notice tone="info" title="No encounter selected">Open the exact patient from My Queue to document treatment. <Button size="sm" onClick={()=>setPage('queue')}>Open My Queue</Button></Notice>:<div className="grid-2 clinical-layout">
      <Card title="Current patient & visit context">
        {queueEntry&&<p>Queue #{queueEntry.queueNumber} • {queueEntry.branch} • <Status>{queueEntry.displayStatus||queueEntry.status}</Status></p>}
        <Button size="sm" variant="ghost" onClick={()=>setPage('patients',{...context,patientId})}>Open Chart</Button>
        <div className="patient-summary"><b>{patientName(patientId,state.patients)}</b><p>{state.services.find(s=>s.id===(queueEntry?.serviceId||treatment?.requestedServiceId))?.name||'Unknown requested service'} • {state.branches.find(b=>b.id===(treatment?.branchId||queueEntry?.branchId))?.name} • {treatment?.dentistName||dentist?.name}</p><p>Allergies: {patient?.allergies}</p>
          {patient?.dentalHistory&&<p>Earlier dental history notes (read-only, recorded before server treatment records): {patient.dentalHistory}</p>}
          <p>{priorCare.length?`${priorCare.length} earlier completed treatment record${priorCare.length===1?'':'s'} available in the chart.`:'No earlier server treatment records you can view.'}</p></div>
        {visibleHmo(state,session).filter(h=>h.server?h.visitId&&h.visitId===visitId:treatment?.id&&h.treatmentId===treatment.id).map(h=><p key={h.id}>HMO: {h.providerName||h.provider} • {h.status}{h.legacy?' (earlier record)':''} • Provider decisions are external.</p>)}
        <Notice tone="info">The system does not diagnose, prescribe, or choose treatment. It only loads known context and automates downstream handoffs after the dentist’s decisions.</Notice>
      </Card>
      <Card title="Clinical documentation" subtitle={treatment?`Clinic server record • revision ${treatment.revision}`:'Starting treatment serves the queue entry and creates the clinic server record.'}>
        {treatment?.status==='Completed'&&<Notice tone="success">This encounter is complete and its clinical record is read-only. Corrections after completion are not available yet (clinic policy pending).</Notice>}
        {treatment&&!treatment.author&&treatment.status!=='Completed'&&<Notice tone="warning">This treatment belongs to another Dentist and is read-only.</Notice>}
        {newer&&dirty&&<Notice tone="warning" title="A newer version was saved">This treatment was saved elsewhere after you opened it. Your unsaved changes are still here. <Button size="sm" variant="soft" onClick={reloadLatest}>Load the latest version (discards unsaved changes)</Button></Notice>}
        <fieldset disabled={readOnly||saving} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid one-col">
        <Notice>Confirm the procedures actually performed. The booked service is visit context only.</Notice>
        {form.procedures.map((p,index)=><div className="form-grid" key={p.id||`new-${index}`}>
          <Field label={`Procedure ${index+1}`} required><select value={p.serviceId||''} onChange={e=>line(index,'serviceId',e.target.value)}><option value="">Select performed procedure</option>{performedServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}{p.serviceId&&!performedServices.some(s=>s.id===p.serviceId)&&<option value={p.serviceId}>{treatment?.procedures.find(x=>x.id===p.id)?.serviceName||p.serviceId}</option>}</select></Field>
          <Field label="Quantity" required><input type="number" min="1" step="1" value={p.quantity} onChange={e=>line(index,'quantity',e.target.value)}/></Field>
          <Field label="Procedure notes"><input value={p.notes||''} onChange={e=>line(index,'notes',e.target.value)}/></Field>
          <Button variant="ghost" onClick={()=>setForm({...form,procedures:form.procedures.filter((_,i)=>i!==index)})}>Remove procedure {index+1}</Button>
        </div>)}
        <Button variant="ghost" onClick={()=>setForm({...form,procedures:[...form.procedures,{serviceId:'',quantity:1,notes:''}]})}>Add performed procedure</Button>
        <Field label="Chief complaint"><textarea value={form.complaint} onChange={e=>setForm({...form,complaint:e.target.value})}/></Field>
        <Field label="Treatment plan"><textarea value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})}/></Field>
        <Field label="Procedure / treatment performed"><textarea value={form.procedure} onChange={e=>setForm({...form,procedure:e.target.value})}/></Field>
        <Field label="Assigned assistant" hint="From the dentist profile when treatment started"><input value={form.assistant} readOnly/></Field>
        <Field label="Clinical notes"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <div className="check-pair"><label><input type="checkbox" checked={form.prescriptionRequired} onChange={e=>setForm({...form,prescriptionRequired:e.target.checked})}/> Dentist indicates prescription required</label><label><input type="checkbox" checked={form.followupRequired} onChange={e=>setForm({...form,followupRequired:e.target.checked})}/> Dentist indicates follow-up required</label></div>
        {form.followupRequired&&<div className="form-grid"><Field label="Recommended follow-up date"><input type="date" value={form.followupDate} onChange={e=>setForm({...form,followupDate:e.target.value})}/></Field><Field label="Follow-up reason / instructions"><input value={form.followupReason} onChange={e=>setForm({...form,followupReason:e.target.value})}/></Field><Field label="Recommended interval"><input value={form.followupInterval} onChange={e=>setForm({...form,followupInterval:e.target.value})}/></Field></div>}
        {!readOnly&&<div className="form-actions">
          {!treatment?<Button disabled={saving||!canStart} onClick={start}>Start Treatment</Button>:<>
            <Button variant="ghost" disabled={saving||!dirty} onClick={save}>Save Treatment Progress</Button>
            <Button disabled={saving} onClick={complete}>Complete Treatment</Button></>}
        </div>}
        {!treatment&&queueEntry&&!canStart&&<Notice>Treatment can start once this patient is Called or Ready for treatment.</Notice>}
        {dirty&&!readOnly&&treatment&&<small className="block-muted">Unsaved changes — they are kept only on this screen until you save.</small>}
      </div></fieldset></Card>
    </div>}
  </>
}

export function PrescriptionsPage({ role, store, context }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const eligible=prescriptionTasks(state,session)
  const [form,setForm]=useState({treatmentId:'',items:[]})
  const visible=visiblePrescriptions(state,session)
  const select=treatmentId=>{
    const draft=state.prescriptions.find(r=>r.treatmentId===treatmentId&&r.status==='Draft')
    setForm(draft||{treatmentId,items:[{medication:'',dosage:'',instructions:'',duration:''}]})
  }
  const save=authorize=>{
    const result=authorize?actions.authorizePrescription(form):actions.savePrescription(form)
    if(!result.ok)return toast(result.message,'warning')
    setForm(authorize?{treatmentId:'',items:[]}:result.record)
    toast(authorize?'Prescription authorized.':'Prescription draft saved.','success')
  }
  const update=(index,key,value)=>setForm({...form,items:form.items.map((r,i)=>i===index?{...r,[key]:value}:r)})
  if(role==='patient')return <PatientPrescriptionsPage store={store} context={context}/>
  return <>
    <PageHeader title={role==='patient'?'My Prescriptions':'Prescription tasks'} text="Prescriptions are available to the patient only after the treating dentist authorizes them."/>
    {role==='dentist'&&<Card title="Requested prescriptions"><Field label="Treatment"><select value={form.treatmentId} onChange={e=>select(e.target.value)}><option value="">Select treatment</option>{eligible.map(t=><option value={t.id} key={t.id}>{patientName(t.patientId,state.patients)} • {dateLabel(t.date)} • {t.procedure} • {t.id}</option>)}</select></Field>
      {!eligible.length&&<Notice>No prescriptions await authorization.</Notice>}
      {form.treatmentId&&<><div className="form-grid">{form.items.map((r,index)=><React.Fragment key={index}>
        <Field label={`Medication ${index+1}`} required><input value={r.medication} onChange={e=>update(index,'medication',e.target.value)}/></Field>
        <Field label="Dosage" required><input value={r.dosage} onChange={e=>update(index,'dosage',e.target.value)}/></Field>
        <Field label="Frequency / instructions" required><textarea value={r.instructions} onChange={e=>update(index,'instructions',e.target.value)}/></Field>
        <Field label="Duration"><input value={r.duration||''} onChange={e=>update(index,'duration',e.target.value)}/></Field>
        <Button variant="ghost" onClick={()=>setForm({...form,items:form.items.filter((_,i)=>i!==index)})}>Remove medication {index+1}</Button>
      </React.Fragment>)}</div><div className="form-actions"><Button variant="ghost" onClick={()=>setForm({...form,items:[...form.items,{medication:'',dosage:'',instructions:'',duration:''}]})}>Add medication</Button><Button variant="ghost" onClick={()=>save(false)}>Save Draft</Button><Button onClick={()=>save(true)}>Authorize Prescription</Button></div></>}
    </Card>}
    <Card className="top-gap" title={role==='patient'?'Authorized prescriptions':'Prescription records'}>{visible.length?visible.map(r=><div className="clinical-history" key={r.id}><div><b>{patientName(r.patientId,state.patients)} • {dentistName(r.dentistId,state.dentists)}</b>{(Array.isArray(r.items)?r.items.filter(Boolean):[r]).map((item,index)=><p key={item.id||index}>{item.medication} • {item.dosage} • {item.instructions} {item.duration&&`• ${item.duration}`}</p>)}<small>{r.authorizedAt||'Awaiting authorization'}</small></div><Status>{r.status}</Status></div>):<Notice>No prescriptions available.</Notice>}</Card>
  </>
}

export function FollowupsPage({ role, store, setPage, context }) {
  const { state, toast }=store
  const session=store.session||sessionForRole(role,state)
  const visible=state.followups.filter(f=>inScope(f,session,state)&&(role!=='patient'||linkedTreatment(state,f)))
  const [booking,setBooking]=useState(null)
  if(role==='patient')return <PatientFollowupsPage store={store} setPage={setPage} context={context}/>
  return <>
    <PageHeader title="Treatment Follow-Up Scheduling" text="Return visits requested by the treating dentist. Scheduling uses normal appointment availability and conflict checks."/>
    {/* Transitional M6/M20 rule (until M20 is backend-authoritative): the Dentist records/recommends the follow-up in the
        treatment encounter; clinic Staff schedule the appointment through M6. Dentists get no booking action here. */}
    {role==='dentist'&&<Notice title="Clinic Staff schedule follow-up visits">Indicate that a follow-up is required, with the recommended date and instructions, in the treatment encounter. Clinic Staff then book the appointment with you; you can’t book it from here.</Notice>}
    <Card title="Follow-up tasks">{!visible.length&&<Notice>No follow-up requirements.</Notice>}{visible.map(f=>{
      const appointment=state.appointments.find(a=>a.id===f.appointmentId)
      const effectiveStatus=followupDisplayState(state,f)
      return <div className="clinical-history" key={f.id}><div><b>{patientName(f.patientId,state.patients)} • {f.reason}</b><p>{dateLabel(f.recommendedDate)} {f.interval} • {dentistName(f.dentistId,state.dentists)}</p>{!linkedTreatment(state,f)&&<p>Care record needs clinic review before scheduling.</p>}<small>{appointment?`${dateLabel(appointment.date)} • ${displayTime(appointment.start)}`:'Awaiting scheduling'}</small></div><Status>{effectiveStatus==='Open'?'Awaiting Scheduling':effectiveStatus}</Status>{f.legacyAppointment&&<small className="block-muted">Historical demo record</small>}{effectiveStatus==='Open'&&linkedTreatment(state,f)&&!f.legacyAppointment&&role==='staff'&&<Button size="sm" onClick={()=>setBooking(f)}>Schedule follow-up</Button>}</div>
    })}</Card>
    <Modal open={!!booking} onClose={()=>setBooking(null)} title="Schedule required follow-up" wide>{booking&&<AppointmentForm role={role} store={store} followup={booking} onSaved={()=>setBooking(null)} submitLabel="Schedule follow-up"/>}</Modal>
  </>
}
