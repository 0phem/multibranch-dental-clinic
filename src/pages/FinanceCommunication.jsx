import React, { useMemo, useState } from 'react'
import { ROLE_INFO, TODAY } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table, Tabs, Timeline } from '../components.jsx'
import { dateLabel, dentistName, displayTime, patientName, peso, uid } from '../logic.js'

import { inScope, sessionForRole } from '../contracts.js'

export function BillingPage({ role, store }) {
  const { state, actions, toast, log }=store
  const pid=ROLE_INFO.patient.patientId
  const session=store.session||sessionForRole(role,state)
  const visible=state.invoices.filter(i=>inScope(i,session)&&(role!=='patient'||i.status!=='Draft')).sort((a,b)=>b.visitDate.localeCompare(a.visitDate))
  const [pay,setPay]=useState(null)
  const issue=i=>{
    const result=actions.issueInvoice(i.id); if(!result.ok)return toast(result.message,'warning')
    log(ROLE_INFO.staff.name,`Reviewed and issued invoice ${i.invoiceNo||i.id}`,'M11');toast('Draft invoice reviewed and issued to the patient.','success')
  }
  const postPayment=(method)=>{
    if(!pay)return
    const result=actions.postPayment(pay.id,method); if(!result.ok)return toast(result.message,'warning')
    log(ROLE_INFO.staff.name,`Posted ${method} payment and generated receipt ${result.receipt}`,'M11')
    toast(method==='Card'?'Frontend card-payment success simulated. PayMongo/server verification is required in backend.':'Cash payment posted and receipt generated.','success');setPay(null)
  }
  return <>
    <PageHeader title={role==='patient'?'Receipts & Payments':'Billing & Payments'} text={role==='patient'?'Your issued bills, payment state, and official/digital receipt records. Draft clinic bills are not shown until staff review.':'Completed treatment automatically creates the draft invoice. Staff reviews the prepared charges, then records Cash or Card payment; staff does not normally recreate treatment charges.'} modules={[11,23]}/>
    {role==='staff'&&<Card title="Automated billing handoff"><Notice tone="success" title="Treatment-driven billing">When the dentist completes treatment, the system prepares one draft invoice from the completed service or procedure and the configured fee. Staff reviews exceptions; normal charges are not retyped.</Notice></Card>}
    <Card className={role==='staff'?'top-gap':''} title={role==='patient'?'My transactions':'Transactions'}>
      <Table rows={visible} columns={[
        {key:'date',label:'Visit date',render:i=>dateLabel(i.visitDate)},...(role==='staff'?[{key:'patient',label:'Patient',render:i=>patientName(i.patientId,state.patients)}]:[]),
        {key:'invoice',label:'Invoice',render:i=>i.invoiceNo||i.id},
        {key:'items',label:'Charges',render:i=><div>{i.items.map((x,idx)=><div key={idx}><b>{x.name}</b><small className="block-muted">{peso.format(x.amount)}</small></div>)}</div>},
        {key:'branch',label:'Branch'},{key:'total',label:'Total',render:i=><b>{peso.format(i.total)}</b>},{key:'status',label:'Status',render:i=><Status>{i.status}</Status>},{key:'method',label:'Payment method'},
        {key:'receipt',label:'Receipt',render:i=>i.receipt||'—'},...(role==='staff'?[{key:'action',label:'Action',render:i=><div className="row-actions">{i.status==='Draft'&&<Button size="sm" onClick={()=>issue(i)}>Review & Issue</Button>}{['Open','Pending'].includes(i.status)&&<Button size="sm" onClick={()=>setPay(i)}>Record Payment</Button>}</div>}]:[])
      ]}/>
    </Card>
    <Modal open={!!pay} onClose={()=>setPay(null)} title="Record payment" subtitle={pay?`${patientName(pay.patientId,state.patients)} • ${peso.format(pay.total)}`:''}><Notice tone="info">Cash is recorded by clinic staff. Card is a frontend simulation only; backend implementation must verify the PayMongo/payment-provider result server-side before marking the invoice paid.</Notice><div className="payment-options"><Button onClick={()=>postPayment('Cash')}>Cash</Button><Button onClick={()=>postPayment('Card')}>Card • PayMongo later</Button></div></Modal>
  </>
}

export function HmoPage({ role, activeBranch, store }) {
  const { state, actions, toast, log }=store
  const [selected,setSelected]=useState(null)
  const [outcome,setOutcome]=useState('Approved')
  const [createOpen,setCreateOpen]=useState(false)
  const patient0=state.patients[0]
  const [caseForm,setCaseForm]=useState({patientId:patient0?.id||'',provider:patient0?.hmo||'',memberId:patient0?.hmoMember||'',serviceId:state.services[0]?.id||'',branch:patient0?.preferredBranch||'Branch A'})
  const visible=state.hmo.filter(h=>activeBranch==='All Branches'||h.branch===activeBranch)
  const selectPatient=patientId=>{const p=state.patients.find(x=>x.id===patientId);setCaseForm({...caseForm,patientId,provider:p?.hmo||'',memberId:p?.hmoMember||'',branch:p?.preferredBranch||caseForm.branch})}
  const createCase=()=>{
    const svc=state.services.find(s=>s.id===caseForm.serviceId)
    const result=actions.createHmoCase({...caseForm,treatment:svc?.name||'Requested dental treatment'})
    if(!result.ok)return toast(result.message,'warning')
    log(ROLE_INFO.staff.name,'Created HMO case; local requirements evaluated automatically','M12')
    toast(result.record.missing.length?`HMO case created. ${result.record.missing.length} missing requirement(s) were identified and the patient was notified.`:'HMO case created and is ready for provider submission.','success');setCreateOpen(false)
  }
  const receiveRequirement=(h,req)=>{const r=actions.markHmoRequirementReceived(h.id,req);if(!r.ok)return toast(r.message,'warning');log(ROLE_INFO.staff.name,`Received HMO requirement: ${req}`,'M12');toast(`${req} recorded. Case completeness recalculated automatically.`,'success')}
  const submit=h=>{const r=actions.submitHmoCase(h.id);if(!r.ok)return toast(r.message,'warning');log(ROLE_INFO.staff.name,'Submitted complete HMO case to provider','M13');toast('Complete HMO case submitted; provider response is now pending.','success')}
  const followUp=h=>{const r=actions.followUpHmo(h.id);if(!r.ok)return toast(r.message,'warning');log(ROLE_INFO.staff.name,'Recorded HMO provider follow-up','M14');toast('Provider follow-up recorded.','success')}
  const escalate=h=>{const r=actions.escalateHmo(h.id);if(!r.ok)return toast(r.message,'warning');log(ROLE_INFO.staff.name,'Escalated unresolved HMO case','M14');toast('Case marked escalated for higher attention; this is not an approval/rejection decision.','success')}
  const recordOutcome=()=>{if(!selected)return;const r=actions.recordHmoOutcome(selected.id,outcome);if(!r.ok)return toast(r.message,'warning');log(ROLE_INFO.staff.name,'Recorded external HMO provider response','M13');toast('External provider outcome recorded and patient notified.','success');setSelected(null)}
  return <>
    <PageHeader title={role==='owner'?'HMO Overview':'HMO Verification, Request & Follow-Up'} text={role==='owner'?'Management oversight of HMO completeness, pending duration, provider outcomes, and escalation status.':'Case creation prefills patient HMO data, checks known requirements automatically, notifies missing-document needs, and only submits complete cases. Provider approval remains external.'} modules={[12,13,14,18,23]}/>
    {role==='staff'&&<div className="page-toolbar"><Button onClick={()=>setCreateOpen(true)}>Start HMO Case</Button></div>}
    <div className="stats-grid small"><StatCardMini label="Missing requirements" value={visible.filter(h=>h.missing?.length).length}/><StatCardMini label="Pending" value={visible.filter(h=>h.status==='Pending').length}/><StatCardMini label="Escalated" value={visible.filter(h=>h.status==='Escalated'||h.escalationStatus==='Escalated').length}/><StatCardMini label="Approved" value={visible.filter(h=>h.status==='Approved').length}/></div>
    <Card title="HMO cases" subtitle={role==='owner'?'Owner/Admin monitors provider workflow; clinic users do not approve their own HMO requests.':'Actions are state-driven: resolve specific missing requirements, submit only when complete, then record the external provider response.'}>
      <Table rows={visible} columns={[
        {key:'patient',label:'Patient',render:h=>patientName(h.patientId,state.patients)},{key:'provider',label:'Provider'},{key:'memberId',label:'Member ID'},{key:'treatment',label:'Treatment'},{key:'branch',label:'Branch'},
        {key:'docs',label:'Requirements',render:h=>h.missing?.length?<span className="danger-text">{h.missing.length} missing</span>:<span className="success-text">Complete</span>},
        {key:'eligibility',label:'Provider verification',render:h=><Status>{h.eligibility||'Not started'}</Status>},
        {key:'pending',label:'Pending time',render:h=>h.status==='Pending'?`${h.pendingHours||0}h`:'—'},{key:'escalation',label:'Escalation',render:h=><Status>{h.escalationStatus||'Not Escalated'}</Status>},{key:'status',label:'Status',render:h=><Status>{h.status}</Status>},
        {key:'action',label:'Actions',render:h=>role==='staff'?<div className="row-actions">{h.missing?.map(req=><Button key={req} size="sm" variant="ghost" onClick={()=>receiveRequirement(h,req)}>Receive {req}</Button>)}{!h.missing?.length&&!h.submittedAt&&<Button size="sm" onClick={()=>submit(h)}>Submit to Provider</Button>}{h.status==='Pending'&&<><Button size="sm" variant="ghost" onClick={()=>followUp(h)}>Record Follow-Up</Button>{(h.pendingHours||0)>=12&&(h.followUpCount||0)>0&&<Button size="sm" variant="danger" onClick={()=>escalate(h)}>Escalate</Button>}<Button size="sm" onClick={()=>setSelected(h)}>Record Provider Response</Button></>}</div>:<Button size="sm" variant="ghost" onClick={()=>setSelected(h)}>View</Button>}
      ]}/>
    </Card>
    <Modal open={createOpen} onClose={()=>setCreateOpen(false)} title="Start HMO case" subtitle="Patient HMO data is prefilled; the system determines the local requirement checklist instead of asking staff to recreate known information."><div className="form-grid"><Field label="Patient"><select value={caseForm.patientId} onChange={e=>selectPatient(e.target.value)}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Branch"><select value={caseForm.branch} onChange={e=>setCaseForm({...caseForm,branch:e.target.value})}>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field><Field label="HMO provider"><input value={caseForm.provider} readOnly/></Field><Field label="Member ID"><input value={caseForm.memberId} readOnly/></Field><Field label="Requested service"><select value={caseForm.serviceId} onChange={e=>setCaseForm({...caseForm,serviceId:e.target.value})}>{state.services.filter(s=>s.status==='Active').map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field><Notice tone="info">Known local requirements are checked immediately. Provider eligibility and approval still depend on the HMO provider’s supported channel or a staff-recorded provider response.</Notice><Button className="span-2" onClick={createCase}>Create & Evaluate Requirements</Button></div></Modal>
    <Modal open={!!selected} onClose={()=>setSelected(null)} title={role==='owner'?'HMO case detail':'Record HMO provider response'} subtitle={selected?.reference||selected?.id}>
      {selected&&<div><div className="detail-list"><div><span>Patient</span><b>{patientName(selected.patientId,state.patients)}</b></div><div><span>Provider</span><b>{selected.provider}</b></div><div><span>Status</span><Status>{selected.status}</Status></div><div><span>Provider verification</span><b>{selected.eligibility}</b></div><div><span>Escalation</span><b>{selected.escalationStatus||'Not Escalated'}</b></div><div><span>Submitted</span><b>{selected.submittedAt||'Not submitted'}</b></div><div><span>Follow-up attempts</span><b>{selected.followUpCount||0}</b></div></div>{role==='staff'&&['Pending','Escalated'].includes(selected.status)&&<><Field label="External provider response"><select value={outcome} onChange={e=>setOutcome(e.target.value)}><option>Approved</option><option>Rejected</option><option>Returned</option></select></Field><Button className="full" onClick={recordOutcome}>Record External Provider Outcome</Button><Notice tone="info">The clinic records the HMO company’s response. The system does not generate an approval decision.</Notice></>}</div>}
    </Modal>
  </>
}

function StatCardMini({label,value}){return <div className="mini-stat"><span>{label}</span><b>{value}</b></div>}

export function InquiriesPage({ store }) {
  const { state, setters, toast, log }=store
  const [newInquiry,setNewInquiry]=useState({source:'Facebook',name:'',contact:'',topic:''})
  const [linking,setLinking]=useState(null)
  const [appointmentId,setAppointmentId]=useState('')
  const add=()=>{if(!newInquiry.name||!newInquiry.topic)return toast('Enter the contact name and inquiry topic.','warning');const i={id:uid('inq'),...newInquiry,status:'Open',assigned:'Alyssa Cruz',receivedAt:'2026-09-19 10:08',respondedAt:null,bookedAppointmentId:null};setters.setInquiries(xs=>[i,...xs]);log('System','Captured and assigned new social inquiry','M16');toast('Inquiry captured and assigned to responsible staff.','success');setNewInquiry({source:'Facebook',name:'',contact:'',topic:''})}
  const respond=i=>{setters.setInquiries(xs=>xs.map(x=>x.id===i.id?{...x,status:'Responded',respondedAt:'2026-09-19 10:08'}:x));log(ROLE_INFO.staff.name,'Recorded staff response to social inquiry','M16');toast('Staff response recorded.','success')}
  const close=i=>{setters.setInquiries(xs=>xs.map(x=>x.id===i.id?{...x,status:'Closed'}:x));toast('Inquiry closed.','success')}
  const linkBooking=()=>{if(!linking||!appointmentId)return toast('Select a booked appointment to link.','warning');setters.setInquiries(xs=>xs.map(x=>x.id===linking.id?{...x,status:'Converted',bookedAppointmentId:appointmentId}:x));log(ROLE_INFO.staff.name,'Converted social inquiry to appointment record','M16');toast('Inquiry linked to a booked appointment and marked converted.','success');setLinking(null);setAppointmentId('')}
  return <>
    <PageHeader title="Social Media Inquiry Management" text="Pre-booking social inquiries become trackable records with source, topic, assignment, response status, follow-up, and conversion to a booked appointment." modules={[16]}/>
    <div className="grid-2">
      <Card title="Capture inquiry"><div className="form-grid"><Field label="Source"><select value={newInquiry.source} onChange={e=>setNewInquiry({...newInquiry,source:e.target.value})}><option>Facebook</option><option>Instagram</option><option>Website</option></select></Field><Field label="Name"><input value={newInquiry.name} onChange={e=>setNewInquiry({...newInquiry,name:e.target.value})}/></Field><Field label="Contact"><input value={newInquiry.contact} onChange={e=>setNewInquiry({...newInquiry,contact:e.target.value})}/></Field><Field label="Topic"><input value={newInquiry.topic} onChange={e=>setNewInquiry({...newInquiry,topic:e.target.value})}/></Field><Button className="span-2" onClick={add}>Create & Assign Inquiry</Button></div></Card>
      <Card title="Response automation"><Notice tone="info">Unanswered inquiries remain visible to staff and would generate reminder tasks after the configured response period in a real implementation.</Notice><div className="metric-row"><div><span>Open inquiries</span><small>Awaiting staff action</small></div><b>{state.inquiries.filter(i=>i.status==='Open').length}</b></div><div className="metric-row"><div><span>Converted to appointment</span><small>Booked inquiries linked to scheduling</small></div><b>{state.inquiries.filter(i=>i.bookedAppointmentId).length}</b></div></Card>
    </div>
    <Card className="top-gap" title="Inquiry worklist"><Table rows={state.inquiries} columns={[{key:'source',label:'Source'},{key:'name',label:'Contact'},{key:'topic',label:'Topic'},{key:'assigned',label:'Assigned staff'},{key:'receivedAt',label:'Received'},{key:'booking',label:'Appointment',render:i=>i.bookedAppointmentId||'—'},{key:'status',label:'Status',render:i=><Status>{i.status}</Status>},{key:'actions',label:'Actions',render:i=><div className="row-actions">{i.status==='Open'&&<Button size="sm" onClick={()=>respond(i)}>Record response</Button>}{['Responded','Open'].includes(i.status)&&!i.bookedAppointmentId&&<Button size="sm" variant="ghost" onClick={()=>setLinking(i)}>Link booked appointment</Button>}{!['Closed','Converted'].includes(i.status)&&<Button size="sm" variant="ghost" onClick={()=>close(i)}>Close</Button>}</div>}]} /></Card>
    <Modal open={!!linking} onClose={()=>setLinking(null)} title="Convert inquiry to appointment" subtitle="Link the social inquiry to the booking that resulted from the conversation."><Field label="Booked appointment"><select value={appointmentId} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{state.appointments.filter(a=>a.status!=='Cancelled').map(a=><option key={a.id} value={a.id}>{dateLabel(a.date)} • {displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field><Button className="full" onClick={linkBooking}>Record Appointment Conversion</Button></Modal>
  </>
}

export function MessagesPage({ role, store }) {
  const { state, setters, toast, log, workflow }=store
  const pid=ROLE_INFO.patient.patientId
  const name=role==='patient'?ROLE_INFO.patient.name:role==='dentist'?ROLE_INFO.dentist.name:ROLE_INFO.staff.name
  const relevant=state.conversations.filter(c=>role==='patient'?c.patientId===pid:role==='dentist'?c.assignedRole==='Dentist':c.assignedRole!=='Dentist')
  const [selected,setSelected]=useState(relevant[0]?.id||null)
  const [text,setText]=useState('')
  const convo=state.conversations.find(c=>c.id===selected)
  const send=()=>{if(!convo||!text.trim())return;const sender=role==='patient'?'patient':role==='dentist'?'dentist':'staff';setters.setConversations(xs=>xs.map(c=>c.id===convo.id?{...c,messages:[...c.messages,{id:uid('cm'),sender,text:text.trim(),at:'2026-09-19 10:08'}],unreadBy:role==='patient'?['staff']:['patient']}:c));log(name,'Sent message in unified conversation','M17');setText('');toast('Message added to the unified conversation history.','success')}
  const resolve=()=>{if(!convo)return;setters.setConversations(xs=>xs.map(c=>c.id===convo.id?{...c,status:'Closed',unreadBy:[]}:c));log(name,'Closed resolved patient conversation','M17');toast('Conversation marked resolved and closed.','success')}
  const retryNotification=n=>{setters.setNotifications(xs=>xs.map(x=>x.id===n.id?{...x,status:'Delivered',createdAt:'2026-09-19 10:08'}:x));workflow('M18','Failed notification retried',`${n.type} delivered via ${n.channel}`);log(ROLE_INFO.staff.name,'Retried failed patient notification','M18');toast('Failed notification retried and delivery status updated.','success')}
  return <>
    <PageHeader title={role==='patient'?'Messages':'Unified Patient Messaging'} text={role==='patient'?'Two-way conversations with the clinic. System alerts and reminders are available from the notification bell.':'Ongoing identified-patient conversations remain separate from social inquiries and system-generated notifications.'} modules={[17,18]}/>
    <div className="messages-layout">
      <Card className="conversation-list" title="Conversations">{relevant.map(c=><button key={c.id} className={selected===c.id?'selected':''} onClick={()=>setSelected(c.id)}><div><b>{patientName(c.patientId,state.patients)}</b><small>{c.context}</small></div><Status>{c.status}</Status></button>)}</Card>
      <Card className="conversation-card" title={convo?`${patientName(convo.patientId,state.patients)} • ${convo.context}`:'Select a conversation'} actions={convo&&role!=='patient'&&convo.status!=='Closed'?<Button size="sm" variant="ghost" onClick={resolve}>Mark resolved</Button>:null}>{convo?<><div className="message-thread">{convo.messages.map(m=><div className={`bubble ${m.sender===role?'mine':m.sender==='patient'&&role==='patient'?'mine':''}`} key={m.id}><small>{m.sender}</small><p>{m.text}</p><span>{m.at}</span></div>)}</div>{convo.status!=='Closed'?<div className="compose-row"><textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Write a message..."/><Button onClick={send}>Send</Button></div>:<Notice tone="info">This conversation is resolved and closed. Reopen controls would be permission-based in the backend implementation.</Notice>}</>:<Notice>Select a conversation.</Notice>}</Card>
      {role!=='patient'&&<Card className="notification-panel" title="Notification delivery" subtitle="System-generated outbound updates">{state.notifications.slice(0,8).map(n=><div className="notification-item" key={n.id}><div><b>{n.type}</b><p>{n.text}</p><small>{n.createdAt} • {n.channel}</small></div><div className="notification-actions"><Status>{n.status}</Status>{role==='staff'&&n.status==='Failed'&&<Button size="sm" variant="ghost" onClick={()=>retryNotification(n)}>Retry</Button>}</div></div>)}</Card>}
    </div>
  </>
}
