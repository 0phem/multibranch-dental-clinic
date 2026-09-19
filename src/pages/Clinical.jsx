import React, { useMemo, useState } from 'react'
import { ROLE_INFO, TODAY } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, SectionLabel, Status, Table, Tabs, Timeline } from '../components.jsx'
import { dateLabel, dentistName, displayTime, patientName, recalcQueue, uid } from '../logic.js'
import { AppointmentForm } from './Scheduling.jsx'

export function PatientsPage({ role, store }) {
  const { state, setters, toast, log }=store
  const [selected,setSelected]=useState(state.patients[0]?.id||'')
  const [tab,setTab]=useState('summary')
  const [newOpen,setNewOpen]=useState(false)
  const [newPatient,setNewPatient]=useState({name:'',dob:'',sex:'Female',phone:'',email:'',address:'',preferredBranch:'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false})
  const patient=state.patients.find(p=>p.id===selected)
  const visits=state.appointments.filter(a=>a.patientId===selected).sort((a,b)=>`${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
  const treatments=state.treatments.filter(t=>t.patientId===selected).sort((a,b)=>b.date.localeCompare(a.date))
  const hmo=state.hmo.filter(h=>h.patientId===selected)
  const rx=state.prescriptions.filter(r=>r.patientId===selected)
  const saveDemographics=(patch)=>{setters.setPatients(xs=>xs.map(p=>p.id===selected?{...p,...patch}:p));log(role==='dentist'?ROLE_INFO.dentist.name:ROLE_INFO.staff.name,`Updated patient record ${selected}`,'M4');toast('Patient record updated.','success')}
  const createPatient=()=>{if(role!=='staff')return;if(!newPatient.name||!newPatient.phone)return toast('Patient name and phone are required.','warning');const duplicate=state.patients.find(p=>p.name.toLowerCase()===newPatient.name.toLowerCase()||p.phone===newPatient.phone);if(duplicate)return toast(`Possible duplicate record: ${duplicate.name}. Review the existing patient first.`,'warning');const patientCode=`PAT-${String(state.patients.length+1).padStart(4,'0')}`;const record={id:uid('p'),patientCode,...newPatient};setters.setPatients(xs=>[...xs,record]);log(ROLE_INFO.staff.name,`Created patient record ${patientCode} • ${record.name}`,'M4');toast('New centralized patient record created with an ERD-aligned patient code.','success');setSelected(record.id);setNewOpen(false)}
  if (!patient) return <Notice>No patient records are available.</Notice>
  const tabs=[{key:'summary',label:'Summary'},{key:'visits',label:'Visit history',count:visits.length},{key:'clinical',label:'Clinical',count:treatments.length},{key:'hmo',label:'HMO',count:hmo.length},{key:'documents',label:'Documents'}]
  return <>
    <PageHeader title="Centralized Patient Records" text="One cross-branch patient record with role-aware access. Staff focuses on demographics, HMO, documents and visit context; dentists retain clinical editing authority." modules={[4]}/>
    <div className="records-layout">
      <Card className="patient-list" title="Patients" actions={role==='staff'?<Button size="sm" onClick={()=>setNewOpen(true)}>New Patient</Button>:null}><input className="search-input" placeholder="Search patient..."/><div className="patient-list-scroll">{state.patients.map(p=><button key={p.id} className={selected===p.id?'selected':''} onClick={()=>{setSelected(p.id);setTab('summary')}}><span className="avatar">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><b>{p.name}</b><small>{p.patientCode||p.id} • {p.preferredBranch} • {p.hmo}</small></div></button>)}</div></Card>
      <div>
        <Card className="patient-header-card"><div className="patient-record-head"><div className="avatar xl">{patient.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>{patient.name}</h2><p>{patient.patientCode||patient.id} • {patient.dob} • {patient.sex} • {patient.preferredBranch}</p><div className="chip-row"><span className="mini-chip">HMO: {patient.hmo}</span><span className="mini-chip">Allergies: {patient.allergies}</span>{patient.consent&&<span className="mini-chip success">Consent on file</span>}</div></div></div></Card>
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
        {tab==='summary'&&<SummaryTab patient={patient} role={role} onSave={saveDemographics}/>} 
        {tab==='visits'&&<Card title="Cross-branch visit history"><Table rows={visits} columns={[{key:'date',label:'Date',render:a=>dateLabel(a.date)},{key:'branch',label:'Branch'},{key:'service',label:'Service'},{key:'dentist',label:'Dentist',render:a=>dentistName(a.dentistId,state.dentists)},{key:'status',label:'Status',render:a=><Status>{a.status}</Status>}]} /></Card>}
        {tab==='clinical'&&<Card title="Treatment history" subtitle={role==='dentist'?'Dentist-authorized clinical view':'Staff read-only clinical summary'}>{treatments.length?treatments.map(t=><div className="clinical-history" key={t.id}><div><b>{dateLabel(t.date)} • {t.procedure||t.plan}</b><p>{t.notes}</p><small>{dentistName(t.dentistId,state.dentists)} • {t.status}</small></div><Status>{t.status}</Status></div>):<Notice>No treatment history recorded.</Notice>}</Card>}
        {tab==='hmo'&&<Card title="HMO record"><Table rows={hmo} columns={[{key:'provider',label:'Provider'},{key:'memberId',label:'Member ID'},{key:'treatment',label:'Requested treatment'},{key:'eligibility',label:'Eligibility',render:h=><Status>{h.eligibility}</Status>},{key:'status',label:'Status',render:h=><Status>{h.status}</Status>}]} /></Card>}
        {tab==='documents'&&<Card title="Visit documents"><Notice tone="info">Document upload/storage is represented in the UI only. In a real implementation, scanned consent forms, HMO documents, and visit attachments would be stored securely and linked to this patient record.</Notice><div className="document-grid"><div><span>PDF</span><b>Consent Form</b><small>Verified • 2026-09-12</small></div><div><span>IMG</span><b>Visit Attachment</b><small>Branch A • 2026-09-12</small></div></div></Card>}
      </div>
    </div>
    <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="Create patient record" subtitle="Staff creates or finds the centralized record before downstream workflows use it." wide><div className="form-grid"><Field label="Full name"><input value={newPatient.name} onChange={e=>setNewPatient({...newPatient,name:e.target.value})}/></Field><Field label="Phone"><input value={newPatient.phone} onChange={e=>setNewPatient({...newPatient,phone:e.target.value})}/></Field><Field label="Date of birth"><input type="date" value={newPatient.dob} onChange={e=>setNewPatient({...newPatient,dob:e.target.value})}/></Field><Field label="Sex"><select value={newPatient.sex} onChange={e=>setNewPatient({...newPatient,sex:e.target.value})}><option>Female</option><option>Male</option><option>Other</option></select></Field><Field label="Email"><input value={newPatient.email} onChange={e=>setNewPatient({...newPatient,email:e.target.value})}/></Field><Field label="Preferred branch"><select value={newPatient.preferredBranch} onChange={e=>setNewPatient({...newPatient,preferredBranch:e.target.value})}>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field><Field label="HMO provider"><input value={newPatient.hmo} onChange={e=>setNewPatient({...newPatient,hmo:e.target.value})}/></Field><Field label="HMO member ID"><input value={newPatient.hmoMember} onChange={e=>setNewPatient({...newPatient,hmoMember:e.target.value})}/></Field><Field label="Address"><textarea value={newPatient.address} onChange={e=>setNewPatient({...newPatient,address:e.target.value})}/></Field><Field label="Emergency contact"><textarea value={newPatient.emergencyContact} onChange={e=>setNewPatient({...newPatient,emergencyContact:e.target.value})}/></Field><label className="check-control span-2"><input type="checkbox" checked={newPatient.consent} onChange={e=>setNewPatient({...newPatient,consent:e.target.checked})}/><span><b>Consent recorded</b><small>Frontend marker only; real consent evidence would be stored securely.</small></span></label><Button className="span-2" onClick={createPatient}>Create Central Patient Record</Button></div></Modal>
  </>
}

function SummaryTab({ patient, role, onSave }) {
  const [form,setForm]=useState(patient)
  React.useEffect(()=>setForm(patient),[patient.id])
  const update=(k,v)=>setForm({...form,[k]:v})
  const staff=role==='staff'
  return <Card title="Patient summary" subtitle={staff?'Staff can maintain demographics, contact, HMO and documents. Clinical history is read-only.':'Dentist can review and update clinical fields.'}>
    <div className="form-grid">
      <Field label="Patient code" hint="PATIENTS.patient_code"><input value={form.patientCode||form.id} disabled/></Field>
      <Field label="Full name"><input value={form.name} onChange={e=>update('name',e.target.value)}/></Field>
      <Field label="Preferred branch"><input value={form.preferredBranch} onChange={e=>update('preferredBranch',e.target.value)}/></Field>
      <Field label="Phone"><input value={form.phone} onChange={e=>update('phone',e.target.value)}/></Field>
      <Field label="Email"><input value={form.email} onChange={e=>update('email',e.target.value)}/></Field>
      <Field label="HMO provider"><input value={form.hmo} onChange={e=>update('hmo',e.target.value)}/></Field>
      <Field label="HMO member ID"><input value={form.hmoMember} onChange={e=>update('hmoMember',e.target.value)}/></Field>
      <Field label="Allergies" hint={staff?'Read-only for staff; clinical changes require a dentist.':''}><textarea value={form.allergies} disabled={staff} onChange={e=>update('allergies',e.target.value)}/></Field>
      <Field label="Medical history" hint={staff?'Read-only clinical field':''}><textarea value={form.medicalHistory} disabled={staff} onChange={e=>update('medicalHistory',e.target.value)}/></Field>
      <Field label="Dental history" hint={staff?'Read-only clinical field':''}><textarea value={form.dentalHistory} disabled={staff} onChange={e=>update('dentalHistory',e.target.value)}/></Field>
      <Field label="Emergency contact"><textarea value={form.emergencyContact} onChange={e=>update('emergencyContact',e.target.value)}/></Field>
      <Button className="span-2" onClick={()=>onSave(form)}>Save permitted changes</Button>
    </div>
  </Card>
}

export function TreatmentPage({ store }) {
  const { state, setters, toast, log, workflow }=store
  const did=ROLE_INFO.dentist.dentistId
  const ready=state.queue.filter(q=>q.dentistId===did&&q.status==='Treatment Ready')
  const [selected,setSelected]=useState(ready[0]?.patientId||state.patients[0]?.id||'')
  const existing=state.treatments.find(t=>t.patientId===selected&&t.date===TODAY&&t.dentistId===did)
  const [form,setForm]=useState(existing||{complaint:'',plan:'',procedure:'',notes:'',assistant:state.dentists.find(d=>d.id===did)?.assistant||'',status:'Planned',followupRequired:false,prescriptionRequired:false,followupDate:'2026-10-03',followupInterval:'2 weeks'})
  React.useEffect(()=>{const t=state.treatments.find(x=>x.patientId===selected&&x.date===TODAY&&x.dentistId===did);setForm(t||{complaint:'',plan:'',procedure:'',notes:'',assistant:state.dentists.find(d=>d.id===did)?.assistant||'',status:'Planned',followupRequired:false,prescriptionRequired:false,followupDate:'2026-10-03',followupInterval:'2 weeks'})},[selected])
  const save=(status=form.status)=>{
    const current=state.treatments.find(t=>t.patientId===selected&&t.date===TODAY&&t.dentistId===did)
    const record={id:current?.id||uid('t'),patientId:selected,dentistId:did,date:TODAY,appointmentId:current?.appointmentId||null,...form,status,startedAt:current?.startedAt||(status==='In Treatment'?'10:08':null),completedAt:status==='Completed'?'10:48':current?.completedAt||null}
    if(current)setters.setTreatments(xs=>xs.map(t=>t.id===current.id?record:t));else setters.setTreatments(xs=>[record,...xs])
    if(status==='Completed'){
      setters.setQueue(xs=>recalcQueue(xs.map(q=>q.patientId===selected&&q.dentistId===did&&!['Completed','No-show'].includes(q.status)?{...q,status:'Completed',completedAt:'10:48'}:q)))
      setters.setPatients(xs=>xs.map(p=>p.id===selected?{...p,dentalHistory:`${p.dentalHistory} ${record.procedure||record.plan} • ${TODAY}.`.trim()}:p))
      if(record.followupRequired && !state.followups.some(f=>f.treatmentId===record.id)){
        setters.setFollowups(xs=>[{id:uid('f'),patientId:selected,treatmentId:record.id,dentistId:did,reason:record.procedure?`Follow-up after ${record.procedure}`:'Treatment follow-up',recommendedDate:record.followupDate||'2026-10-03',interval:record.followupInterval||'2 weeks',status:'Open',appointmentId:null,taskCreatedAt:'2026-09-19 10:48'},...xs])
        workflow('M20','Follow-up scheduling task created',`${patientName(selected,state.patients)} • ${record.followupDate||'2026-10-03'}`)
      }
      if(record.prescriptionRequired) workflow('M19','Prescription task triggered',`${patientName(selected,state.patients)} • dentist authorization required`)
      workflow('M5','Treatment completed',`${patientName(selected,state.patients)} • patient history updated and downstream actions evaluated`)
    }
    log(ROLE_INFO.dentist.name,`${status==='Completed'?'Completed':'Updated'} treatment for ${patientName(selected,state.patients)}`,'M5')
    toast(status==='Completed'?'Treatment completed. Prescription/follow-up decisions are now available.':'Treatment record saved.','success')
  }
  return <>
    <PageHeader title="Treatment & Clinical Workflow" text="Clinical decisions remain with the dentist while the system standardizes treatment status, notes, completion, and downstream prescription/follow-up handoffs." modules={[5,19,20]}/>
    <div className="grid-2 clinical-layout">
      <Card title="Patient & treatment context"><Field label="Patient"><select value={selected} onChange={e=>setSelected(e.target.value)}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><div className="patient-summary"><b>{patientName(selected,state.patients)}</b><p>Allergies: {state.patients.find(p=>p.id===selected)?.allergies}</p><p>History: {state.patients.find(p=>p.id===selected)?.dentalHistory}</p></div><Notice tone="info">Diagnosis, treatment choice, and duration are not automated. The UI only supports documentation and workflow handoffs.</Notice></Card>
      <Card title="Clinical documentation"><div className="form-grid one-col">
        <Field label="Chief complaint"><textarea value={form.complaint} onChange={e=>setForm({...form,complaint:e.target.value})}/></Field>
        <Field label="Treatment plan"><textarea value={form.plan} onChange={e=>setForm({...form,plan:e.target.value})}/></Field>
        <Field label="Procedure / treatment performed"><textarea value={form.procedure} onChange={e=>setForm({...form,procedure:e.target.value})}/></Field>
        <Field label="Assigned assistant"><input value={form.assistant} onChange={e=>setForm({...form,assistant:e.target.value})}/></Field>
        <Field label="Clinical notes"><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <div className="check-pair"><label><input type="checkbox" checked={form.prescriptionRequired} onChange={e=>setForm({...form,prescriptionRequired:e.target.checked})}/> Prescription required</label><label><input type="checkbox" checked={form.followupRequired} onChange={e=>setForm({...form,followupRequired:e.target.checked})}/> Follow-up required</label></div>
        {form.followupRequired&&<div className="form-grid"><Field label="Recommended follow-up date"><input type="date" value={form.followupDate||''} onChange={e=>setForm({...form,followupDate:e.target.value})}/></Field><Field label="Recommended interval"><input value={form.followupInterval||''} onChange={e=>setForm({...form,followupInterval:e.target.value})}/></Field></div>}
        <div className="form-actions"><Button variant="ghost" onClick={()=>save('In Treatment')}>Save as In Treatment</Button><Button onClick={()=>save('Completed')}>Mark Procedure Complete</Button></div>
      </div></Card>
    </div>
  </>
}

export function PrescriptionsPage({ role, store }) {
  const { state, setters, toast, log }=store
  const pid=ROLE_INFO.patient.patientId, did=ROLE_INFO.dentist.dentistId
  const eligible=state.treatments.filter(t=>t.dentistId===did&&t.status==='Completed'&&t.prescriptionRequired&&!state.prescriptions.some(rx=>rx.treatmentId===t.id))
  const [form,setForm]=useState({treatmentId:eligible[0]?.id||'',medication:'',dosage:'',instructions:''})
  const visible=state.prescriptions.filter(rx=>role==='patient'?rx.patientId===pid:rx.dentistId===did)
  const authorize=()=>{
    const t=state.treatments.find(x=>x.id===form.treatmentId); if(!t)return toast('Select a completed treatment requiring a prescription.','warning')
    if(!form.medication||!form.dosage||!form.instructions)return toast('Complete medication, dosage, and instructions before authorization.','warning')
    const record={id:uid('rx'),patientId:t.patientId,treatmentId:t.id,dentistId:did,...form,authorizedAt:'2026-09-19 10:08',status:'Authorized',version:1}
    setters.setPrescriptions(xs=>[record,...xs]);log(ROLE_INFO.dentist.name,`Authorized prescription ${record.id}`,'M19');toast('Prescription authorized, stored, and linked to patient history.','success');setForm({treatmentId:'',medication:'',dosage:'',instructions:''})
  }
  return <>
    <PageHeader title={role==='patient'?'My Prescriptions':'Digital Prescription Management'} text={role==='patient'?'Authorized prescriptions linked to your treatment history.':'Dentist-only prescription creation and authorization with an immutable authorized record concept.'} modules={[19]}/>
    {role==='dentist'&&<Card title="Create authorized prescription" subtitle="The dentist remains the authorizing professional"><div className="form-grid">
      <Field label="Completed treatment"><select value={form.treatmentId} onChange={e=>setForm({...form,treatmentId:e.target.value})}><option value="">Select treatment</option>{eligible.map(t=><option value={t.id} key={t.id}>{patientName(t.patientId,state.patients)} • {t.procedure||t.plan}</option>)}</select></Field>
      <Field label="Medication"><input value={form.medication} onChange={e=>setForm({...form,medication:e.target.value})}/></Field>
      <Field label="Dosage"><input value={form.dosage} onChange={e=>setForm({...form,dosage:e.target.value})}/></Field>
      <Field label="Instructions"><textarea value={form.instructions} onChange={e=>setForm({...form,instructions:e.target.value})}/></Field>
      <Button className="span-2" onClick={authorize}>Review & Authorize Prescription</Button>
    </div></Card>}
    <Card className={role==='dentist'?'top-gap':''} title="Authorized prescriptions"><Table rows={visible} columns={[{key:'patient',label:'Patient',render:r=>patientName(r.patientId,state.patients)},{key:'medication',label:'Medication'},{key:'dosage',label:'Dosage'},{key:'instructions',label:'Instructions'},{key:'authorizedAt',label:'Authorized'},{key:'dentist',label:'Dentist',render:r=>dentistName(r.dentistId,state.dentists)},{key:'status',label:'Status',render:r=><Status>{r.status}</Status>}]} /></Card>
  </>
}

export function FollowupsPage({ role, store }) {
  const { state, setters, toast, log, notify }=store
  const pid=ROLE_INFO.patient.patientId, did=ROLE_INFO.dentist.dentistId
  const visible=state.followups.filter(f=>role==='patient'?f.patientId===pid:role==='dentist'?f.dentistId===did:true)
  const [booking,setBooking]=useState(null)
  const [newTask,setNewTask]=useState({patientId:state.patients[0]?.id||'',reason:'',recommendedDate:TODAY,interval:'2 weeks'})
  const createTask=()=>{
    if(!newTask.reason)return toast('Enter the clinical follow-up reason.','warning')
    const t={id:uid('f'),patientId:newTask.patientId,treatmentId:null,dentistId:did,reason:newTask.reason,recommendedDate:newTask.recommendedDate,interval:newTask.interval,status:'Open',appointmentId:null,taskCreatedAt:'2026-09-19 10:08'}
    setters.setFollowups(xs=>[t,...xs]);notify(t.patientId,'Follow-Up Required',`A follow-up is recommended for ${dateLabel(t.recommendedDate)}. Please schedule an available appointment.`);log(ROLE_INFO.dentist.name,'Created follow-up scheduling task','M20');toast('Follow-up task created and patient/front desk notified.','success')
  }
  const prefill=booking?{patientId:booking.patientId,dentistId:booking.dentistId,date:booking.recommendedDate,service:'Follow-Up',source:'Follow-Up Task',notes:booking.reason}:{}
  return <>
    <PageHeader title="Treatment Follow-Up Scheduling" text="The clinical requirement is tracked separately from booking. When scheduling begins, it reuses the same Smart Scheduling validation as Module 6–7." modules={[20,6,7]}/>
    {role==='dentist'&&<Card title="Create follow-up obligation"><div className="form-grid"><Field label="Patient"><select value={newTask.patientId} onChange={e=>setNewTask({...newTask,patientId:e.target.value})}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Recommended date"><input type="date" value={newTask.recommendedDate} onChange={e=>setNewTask({...newTask,recommendedDate:e.target.value})}/></Field><Field label="Interval"><input value={newTask.interval} onChange={e=>setNewTask({...newTask,interval:e.target.value})}/></Field><Field label="Reason"><input value={newTask.reason} onChange={e=>setNewTask({...newTask,reason:e.target.value})}/></Field><Button className="span-2" onClick={createTask}>Create Follow-Up Scheduling Task</Button></div></Card>}
    <Card className={role==='dentist'?'top-gap':''} title="Follow-up tasks"><Table rows={visible} columns={[{key:'patient',label:'Patient',render:f=>patientName(f.patientId,state.patients)},{key:'reason',label:'Reason'},{key:'recommendedDate',label:'Recommended',render:f=>dateLabel(f.recommendedDate)},{key:'interval',label:'Interval'},{key:'status',label:'Status',render:f=><Status>{f.status}</Status>},{key:'appointment',label:'Appointment',render:f=>f.appointmentId?state.appointments.find(a=>a.id===f.appointmentId)?`${dateLabel(state.appointments.find(a=>a.id===f.appointmentId).date)} • ${displayTime(state.appointments.find(a=>a.id===f.appointmentId).start)}`:'Linked':'Not booked'},{key:'action',label:'Action',render:f=>f.status==='Open'&&role!=='dentist'?<Button size="sm" onClick={()=>setBooking(f)}>Schedule follow-up</Button>:null}]} /></Card>
    <Modal open={!!booking} onClose={()=>setBooking(null)} title="Schedule required follow-up" subtitle="This appointment must pass normal scheduling validation." wide>{booking&&<AppointmentForm role={role==='patient'?'patient':'staff'} store={store} prefill={prefill} onSaved={a=>{setters.setFollowups(xs=>xs.map(f=>f.id===booking.id?{...f,status:'Scheduled',appointmentId:a.id}:f));setBooking(null);toast('Follow-up appointment scheduled and task closed.','success')}} submitLabel="Validate & Schedule Follow-Up"/>}</Modal>
  </>
}
