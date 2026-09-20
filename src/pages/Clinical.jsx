import React, { useState } from 'react'
import { ROLE_INFO } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table, Tabs } from '../components.jsx'
import { dateLabel, dentistName, displayTime, patientName } from '../logic.js'
import { AppointmentForm } from './Scheduling.jsx'

import { visiblePrescriptions, prescriptionTasks, linkedTreatment } from '../phase2.js'
import { inScope, isTodayQueue, patientInScope, sessionForRole } from '../contracts.js'

export function PatientsPage({ role, store, context, setPage }) {
  const { state, actions, toast, log }=store
  const session=store.session||sessionForRole(role,state)
  const availablePatients=state.patients.filter(p=>patientInScope(p,state,session))
  const [selected,setSelected]=useState(context?.patientId||availablePatients[0]?.id||'')
  React.useEffect(()=>{if(context?.patientId)setSelected(context.patientId)},[context?.patientId])
  const [tab,setTab]=useState('summary')
  const [newOpen,setNewOpen]=useState(false)
  const [newPatient,setNewPatient]=useState({firstName:'',middleName:'',lastName:'',dob:'',sex:'Female',phone:'',email:'',address:'',preferredBranch:'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false,createPortalAccount:false})
  const patient=availablePatients.find(p=>p.id===selected)
  const visits=state.appointments.filter(a=>a.patientId===selected&&inScope(a,session)).sort((a,b)=>`${b.date}${b.start}`.localeCompare(`${a.date}${a.start}`))
  const treatments=state.treatments.filter(t=>t.patientId===selected).sort((a,b)=>b.date.localeCompare(a.date))
  const hmo=state.hmo.filter(h=>h.patientId===selected)
  const encounter=state.queue.find(q=>q.id===context?.queueEntryId&&q.patientId===selected&&inScope(q,session)&&isTodayQueue(q))
  const saveRecord=({person,patient:patientPatch})=>{
    const result=actions.updatePatientRecord(selected,{person,patient:patientPatch})
    if(!result.ok)return toast(result.message,'warning')
    log(role==='dentist'?ROLE_INFO.dentist.name:ROLE_INFO.staff.name,`Updated permitted patient record fields ${selected}`,'M4')
    toast('Patient record updated.','success')
  }
  const createPatient=()=>{
    if(role!=='staff')return
    const result=actions.createPatientRecord({
      person:{firstName:newPatient.firstName,middleName:newPatient.middleName,lastName:newPatient.lastName,dob:newPatient.dob,sex:newPatient.sex,phone:newPatient.phone,email:newPatient.email,address:newPatient.address},
      patient:{preferredBranch:newPatient.preferredBranch,hmo:newPatient.hmo,hmoMember:newPatient.hmoMember,allergies:newPatient.allergies,medicalHistory:newPatient.medicalHistory,dentalHistory:newPatient.dentalHistory,emergencyContact:newPatient.emergencyContact,consent:newPatient.consent},
      createPortalAccount:newPatient.createPortalAccount
    })
    if(!result.ok)return toast(result.message,'warning')
    toast(result.record.userId?'Patient record and portal account created.':'Centralized patient record created.','success')
    setSelected(result.record.id);setNewOpen(false)
    setNewPatient({firstName:'',middleName:'',lastName:'',dob:'',sex:'Female',phone:'',email:'',address:'',preferredBranch:'Branch A',hmo:'None',hmoMember:'—',allergies:'None',medicalHistory:'',dentalHistory:'',emergencyContact:'',consent:false,createPortalAccount:false})
  }
  if (!patient) return <Notice>The selected patient is unavailable in your current scope.</Notice>
  const tabs=[{key:'summary',label:'Summary'},{key:'visits',label:'Visit history',count:visits.length},{key:'clinical',label:'Clinical',count:treatments.length},{key:'hmo',label:'HMO',count:hmo.length},{key:'documents',label:'Documents'}]
  return <>
    <PageHeader title="Centralized Patient Records" text="PERSONS is the single source of identity/contact data. Staff may maintain approved demographics; dentists see those fields read-only and edit only clinical information." modules={[4]} aside={role==='dentist'&&encounter&&['Called','Treatment Ready','In Treatment'].includes(encounter.status)?<Button onClick={()=>setPage('treatment',context)}>{encounter.treatmentId?'Continue Treatment':'Open Treatment'}</Button>:null}/>
    <div className="records-layout">
      <Card className="patient-list" title="Patients" actions={role==='staff'?<Button size="sm" onClick={()=>setNewOpen(true)}>New Patient</Button>:null}><input className="search-input" placeholder="Search patient..."/><div className="patient-list-scroll">{availablePatients.map(p=><button key={p.id} className={selected===p.id?'selected':''} onClick={()=>{setSelected(p.id);setTab('summary')}}><span className="avatar">{p.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</span><div><b>{p.name}</b><small>{p.patientCode||p.id} • {p.preferredBranch} • {p.hmo}</small></div></button>)}</div></Card>
      <div>
        <Card className="patient-header-card"><div className="patient-record-head"><div className="avatar xl">{patient.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><h2>{patient.name}</h2><p>{patient.patientCode||patient.id} • {patient.dob||'DOB not set'} • {patient.sex||'—'} • {patient.preferredBranch}</p><div className="chip-row"><span className="mini-chip">HMO: {patient.hmo}</span><span className="mini-chip">Allergies: {patient.allergies}</span>{patient.consent&&<span className="mini-chip success">Consent on file</span>}</div></div></div></Card>
        <Tabs tabs={tabs} active={tab} onChange={setTab}/>
        {tab==='summary'&&<SummaryTab patient={patient} role={role} onSave={saveRecord}/>} 
        {tab==='visits'&&<Card title="Cross-branch visit history"><Table rows={visits} columns={[{key:'date',label:'Date',render:a=>dateLabel(a.date)},{key:'branch',label:'Branch'},{key:'service',label:'Service'},{key:'dentist',label:'Dentist',render:a=>dentistName(a.dentistId,state.dentists)},{key:'status',label:'Status',render:a=><Status>{a.status}</Status>}]} /></Card>}
        {tab==='clinical'&&<Card title="Treatment history" subtitle={role==='dentist'?'Dentist-authorized clinical view':'Staff read-only clinical summary'}>{treatments.length?treatments.map(t=><div className="clinical-history" key={t.id}><div><b>{dateLabel(t.date)} • {t.procedure||t.plan}</b><p>{t.notes}</p><small>{dentistName(t.dentistId,state.dentists)} • {t.status}</small></div><Status>{t.status}</Status></div>):<Notice>No treatment history recorded.</Notice>}</Card>}
        {tab==='hmo'&&<Card title="HMO record"><Table rows={hmo} columns={[{key:'provider',label:'Provider'},{key:'memberId',label:'Member ID'},{key:'treatment',label:'Requested treatment'},{key:'eligibility',label:'Eligibility',render:h=><Status>{h.eligibility}</Status>},{key:'status',label:'Status',render:h=><Status>{h.status}</Status>}]} /></Card>}
        {tab==='documents'&&<Card title="Visit documents"><Notice tone="info">Document upload/storage is represented in the UI only. A backend will store file metadata and protected object-storage references linked to this patient.</Notice><div className="document-grid"><div><span>PDF</span><b>Consent Form</b><small>Verified • 2026-09-12</small></div><div><span>IMG</span><b>Visit Attachment</b><small>Branch A • 2026-09-12</small></div></div></Card>}
      </div>
    </div>
    <Modal open={newOpen} onClose={()=>setNewOpen(false)} title="Create patient record" subtitle="Identity/contact fields create one PERSON record; PATIENTS stores only patient-specific information." wide><div className="form-grid">
      <Field label="First name" required><input value={newPatient.firstName} onChange={e=>setNewPatient({...newPatient,firstName:e.target.value})}/></Field>
      <Field label="Middle name" hint="Optional"><input value={newPatient.middleName} onChange={e=>setNewPatient({...newPatient,middleName:e.target.value})}/></Field>
      <Field label="Last name" required><input value={newPatient.lastName} onChange={e=>setNewPatient({...newPatient,lastName:e.target.value})}/></Field>
      <Field label="Phone" required><input value={newPatient.phone} onChange={e=>setNewPatient({...newPatient,phone:e.target.value})}/></Field>
      <Field label="Date of birth"><input type="date" value={newPatient.dob} onChange={e=>setNewPatient({...newPatient,dob:e.target.value})}/></Field>
      <Field label="Sex"><select value={newPatient.sex} onChange={e=>setNewPatient({...newPatient,sex:e.target.value})}><option>Female</option><option>Male</option><option>Other</option></select></Field>
      <Field label="Email"><input type="email" value={newPatient.email} onChange={e=>setNewPatient({...newPatient,email:e.target.value})}/></Field>
      <Field label="Preferred branch"><select value={newPatient.preferredBranch} onChange={e=>setNewPatient({...newPatient,preferredBranch:e.target.value})}>{state.branches.filter(b=>role==='owner'||b.id===session.branchId).map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
      <Field label="HMO provider"><input value={newPatient.hmo} onChange={e=>setNewPatient({...newPatient,hmo:e.target.value})}/></Field>
      <Field label="HMO member ID"><input value={newPatient.hmoMember} onChange={e=>setNewPatient({...newPatient,hmoMember:e.target.value})}/></Field>
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
    person:staff?{firstName:form.firstName,middleName:form.middleName,lastName:form.lastName,phone:form.phone,email:form.email,dob:form.dob,sex:form.sex,address:form.address}:{},
    patient:staff?{preferredBranch:form.preferredBranch,hmo:form.hmo,hmoMember:form.hmoMember,emergencyContact:form.emergencyContact,consent:form.consent}:{allergies:form.allergies,medicalHistory:form.medicalHistory,dentalHistory:form.dentalHistory}
  })
  return <Card title="Patient summary" subtitle={staff?'Staff maintains approved demographics/contact/HMO fields. Clinical history remains read-only.':'Patient identity/contact information is read-only for the dentist; only clinical fields can be updated.'}>
    <div className="form-grid">
      <Field label="Patient code" hint="PATIENTS.patient_code"><input value={form.patientCode||form.id} disabled/></Field>
      <Field label="First name"><input value={form.firstName||''} disabled={dentist} onChange={e=>update('firstName',e.target.value)}/></Field>
      <Field label="Middle name" hint="Optional"><input value={form.middleName||''} disabled={dentist} onChange={e=>update('middleName',e.target.value)}/></Field>
      <Field label="Last name"><input value={form.lastName||''} disabled={dentist} onChange={e=>update('lastName',e.target.value)}/></Field>
      <Field label="Preferred branch"><input value={form.preferredBranch||''} disabled={dentist} onChange={e=>update('preferredBranch',e.target.value)}/></Field>
      <Field label="Phone"><input value={form.phone||''} disabled={dentist} onChange={e=>update('phone',e.target.value)}/></Field>
      <Field label="Email"><input value={form.email||''} disabled={dentist} onChange={e=>update('email',e.target.value)}/></Field>
      <Field label="Date of birth"><input type="date" value={form.dob||''} disabled={dentist} onChange={e=>update('dob',e.target.value)}/></Field>
      <Field label="Sex"><input value={form.sex||''} disabled={dentist} onChange={e=>update('sex',e.target.value)}/></Field>
      <Field label="Address"><textarea value={form.address||''} disabled={dentist} onChange={e=>update('address',e.target.value)}/></Field>
      <Field label="HMO provider"><input value={form.hmo||''} disabled={dentist} onChange={e=>update('hmo',e.target.value)}/></Field>
      <Field label="HMO member ID"><input value={form.hmoMember||''} disabled={dentist} onChange={e=>update('hmoMember',e.target.value)}/></Field>
      <Field label="Allergies" hint={staff?'Read-only for staff; clinical changes require a dentist.':''}><textarea value={form.allergies||''} disabled={staff} onChange={e=>update('allergies',e.target.value)}/></Field>
      <Field label="Medical history" hint={staff?'Read-only clinical field':''}><textarea value={form.medicalHistory||''} disabled={staff} onChange={e=>update('medicalHistory',e.target.value)}/></Field>
      <Field label="Dental history" hint={staff?'Read-only clinical field':''}><textarea value={form.dentalHistory||''} disabled={staff} onChange={e=>update('dentalHistory',e.target.value)}/></Field>
      <Field label="Emergency contact"><textarea value={form.emergencyContact||''} disabled={dentist} onChange={e=>update('emergencyContact',e.target.value)}/></Field>
      <Button className="span-2" onClick={save}>Save permitted changes</Button>
    </div>
  </Card>
}

export function TreatmentPage({ store, context, setPage }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole('dentist',state)
  const queueEntry=state.queue.find(q=>q.id===context?.queueEntryId&&inScope(q,session)&&isTodayQueue(q))
  const selected=queueEntry?.patientId||''
  const current=queueEntry?.treatmentId?state.treatments.find(t=>t.id===queueEntry.treatmentId&&t.queueEntryId===queueEntry.id):state.treatments.find(t=>t.queueEntryId===queueEntry?.id)
  const dentist=state.dentists.find(d=>d.id===session.dentistId)
  const emptyForm={complaint:'',plan:'',procedure:'',notes:'',assistant:dentist?.assistant||'Unassigned',assistantStaffId:dentist?.assistantStaffId||null,serviceId:queueEntry?.serviceId||'',procedures:[],followupRequired:false,prescriptionRequired:false,followupDate:'',followupInterval:''}
  const [form,setForm]=useState(current?{...current,procedures:(Array.isArray(current.procedures)?current.procedures.filter(Boolean):null)||[{serviceId:current.serviceId,quantity:1,notes:current.procedure||''}]}:emptyForm)
  const closed=current?.status==='Completed'||['Completed','Cancelled','No-show'].includes(queueEntry?.status)
  const performedServices=state.services.filter(s=>s.status==='Active'&&state.branchServices.some(bs=>bs.branchId===queueEntry?.branchId&&bs.serviceId===s.id&&bs.active!==false)&&state.dentistServiceAssignments.some(a=>a.dentistId===session.dentistId&&a.serviceId===s.id&&a.isAuthorized!==false))
  const save=status=>{
    if(!queueEntry)return toast('Open an encounter from My Queue.','warning')
    const result=actions.saveTreatment({...form,id:current?.id,queueEntryId:queueEntry.id},status)
    if(!result.ok)return toast(result.message,'warning')
    setForm(result.record)
    toast(status==='Completed'?'Treatment completed; this encounter is closed and downstream tasks prepared.':'Treatment progress saved.','success')
  }
  return <>
    <PageHeader title="Treatment & Clinical Workflow" text="Treatment opens from the logged-in dentist’s active queue. Patient, appointment, dentist, branch, and service context are loaded automatically; clinical judgment remains with the dentist." modules={[5,11,19,20,23]}/>
    {!queueEntry?<Notice tone="info" title="No encounter selected">Open the exact patient from My Queue to document treatment. <Button size="sm" onClick={()=>setPage('queue')}>Open My Queue</Button></Notice>:<div className="grid-2 clinical-layout">
      <Card title="Current patient & visit context">
        <p>Queue #{queueEntry.queueNumber} • {queueEntry.branch} • <Status>{queueEntry.status}</Status></p>
        <Button size="sm" variant="ghost" onClick={()=>setPage('patients',{...context,patientId:selected})}>Open Chart</Button>
        <div className="patient-summary"><b>{patientName(selected,state.patients)}</b><p>{state.services.find(s=>s.id===queueEntry.serviceId)?.name||'Unknown requested service'} • {queueEntry.branch} • {dentist?.name}</p><p>Allergies: {state.patients.find(p=>p.id===selected)?.allergies}</p><p>History: {state.patients.find(p=>p.id===selected)?.dentalHistory}</p></div>
        <Notice tone="info">The system does not diagnose, prescribe, or choose treatment. It only loads known context and automates downstream handoffs after the dentist’s decisions.</Notice>
      </Card>
      <Card title="Clinical documentation">{closed&&<Notice tone="success">This encounter is complete and its clinical record is read-only.</Notice>}<fieldset disabled={closed} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="form-grid one-col">
        <Notice>Confirm the procedures actually performed. The booked service is visit context only.</Notice>
        {(form.procedures||[]).map((line,index)=><div className="form-grid" key={index}>
          <Field label={`Procedure ${index+1}`} required><select value={line.serviceId} onChange={e=>setForm({...form,procedures:form.procedures.map((p,i)=>i===index?{...p,serviceId:e.target.value}:p)})}><option value="">Select performed procedure</option>{performedServices.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
          <Field label="Quantity" required><input type="number" min="1" step="1" value={line.quantity} onChange={e=>setForm({...form,procedures:form.procedures.map((p,i)=>i===index?{...p,quantity:e.target.value}:p)})}/></Field>
          <Field label="Procedure notes"><input value={line.notes||''} onChange={e=>setForm({...form,procedures:form.procedures.map((p,i)=>i===index?{...p,notes:e.target.value}:p)})}/></Field>
          <Button variant="ghost" onClick={()=>setForm({...form,procedures:form.procedures.filter((_,i)=>i!==index)})}>Remove procedure {index+1}</Button>
        </div>)}
        <Button variant="ghost" onClick={()=>setForm({...form,procedures:[...(form.procedures||[]),{serviceId:'',quantity:1,notes:''}]})}>Add performed procedure</Button>
        <Field label="Chief complaint"><textarea value={form.complaint||''} onChange={e=>setForm({...form,complaint:e.target.value})}/></Field>
        <Field label="Treatment plan"><textarea value={form.plan||''} onChange={e=>setForm({...form,plan:e.target.value})}/></Field>
        <Field label="Procedure / treatment performed"><textarea value={form.procedure||''} onChange={e=>setForm({...form,procedure:e.target.value})}/></Field>
        <Field label="Assigned assistant" hint="Suggested from the dentist profile / current staffing context"><input value={form.assistant||'Unassigned'} readOnly/></Field>
        <Field label="Clinical notes"><textarea value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></Field>
        <div className="check-pair"><label><input type="checkbox" checked={!!form.prescriptionRequired} onChange={e=>setForm({...form,prescriptionRequired:e.target.checked})}/> Dentist indicates prescription required</label><label><input type="checkbox" checked={!!form.followupRequired} onChange={e=>setForm({...form,followupRequired:e.target.checked})}/> Dentist indicates follow-up required</label></div>
        {form.followupRequired&&<div className="form-grid"><Field label="Recommended follow-up date"><input type="date" value={form.followupDate||''} onChange={e=>setForm({...form,followupDate:e.target.value})}/></Field><Field label="Follow-up reason / instructions"><input value={form.followupReason||''} onChange={e=>setForm({...form,followupReason:e.target.value})}/></Field><Field label="Recommended interval"><input value={form.followupInterval||''} onChange={e=>setForm({...form,followupInterval:e.target.value})}/></Field></div>}
        <div className="form-actions"><Button variant="ghost" onClick={()=>save('In Treatment')}>{current?'Save Treatment Progress':'Start Treatment'}</Button><Button disabled={!current||current.status!=='In Treatment'} onClick={()=>save('Completed')}>Complete Treatment</Button></div>
      </div></fieldset></Card>
    </div>}
  </>
}

export function PrescriptionsPage({ role, store }) {
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

export function FollowupsPage({ role, store }) {
  const { state, toast }=store
  const session=store.session||sessionForRole(role,state)
  const visible=state.followups.filter(f=>inScope(f,session)&&(role!=='patient'||linkedTreatment(state,f)))
  const [booking,setBooking]=useState(null)
  const prefill=booking?{patientId:booking.patientId,branchId:booking.branchId,dentistId:booking.dentistId,date:booking.recommendedDate,service:'Follow-Up',source:'Follow-Up Task',notes:booking.reason}:{}
  return <>
    <PageHeader title="Treatment Follow-Up Scheduling" text="Return visits requested by the treating dentist. Scheduling uses normal appointment availability and conflict checks."/>
    {role==='dentist'&&<Notice>Record the clinical follow-up requirement in the exact treatment encounter.</Notice>}
    <Card title="Follow-up tasks">{!visible.length&&<Notice>No follow-up requirements.</Notice>}{visible.map(f=>{
      const appointment=state.appointments.find(a=>a.id===f.appointmentId)
      return <div className="clinical-history" key={f.id}><div><b>{patientName(f.patientId,state.patients)} • {f.reason}</b><p>{dateLabel(f.recommendedDate)} {f.interval} • {dentistName(f.dentistId,state.dentists)}</p>{!linkedTreatment(state,f)&&<p>Care record needs clinic review before scheduling.</p>}<small>{appointment?`${dateLabel(appointment.date)} • ${displayTime(appointment.start)}`:'Awaiting scheduling'}</small></div><Status>{f.status==='Open'?'Awaiting Scheduling':f.status}</Status>{f.status==='Open'&&linkedTreatment(state,f)&&['staff','patient'].includes(role)&&<Button size="sm" onClick={()=>setBooking(f)}>Schedule follow-up</Button>}</div>
    })}</Card>
    <Modal open={!!booking} onClose={()=>setBooking(null)} title="Schedule required follow-up" wide>{booking&&<AppointmentForm role={role} store={store} prefill={prefill} followupId={booking.id} onSaved={()=>{setBooking(null);toast('Follow-up appointment scheduled.','success')}} submitLabel="Validate & Schedule Follow-Up"/>}</Modal>
  </>
}
