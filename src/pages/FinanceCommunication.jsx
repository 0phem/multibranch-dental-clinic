import { hmoDataValid } from '../hmo.js'
import { clinicNow } from '../clock.js'
import React, { useState, useRef } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { dateLabel, displayTime, patientName, peso, uid } from '../logic.js'

import { visibleInvoices, validInvoice } from '../phase2.js'
import { visibleHmo, HMO_PROVIDERS, HMO_REQUIREMENT_RULES, HMO_PENDING_HOURS, pendingHmo, pendingHours, validHmoContext, visibleConversations } from '../phase3-contracts.js'
import { sessionForRole } from '../contracts.js'
import { PatientBillingPage, PatientHmoPage } from './PatientCare.jsx'
import { PatientMessagesPage } from './PatientMessages.jsx'

function InvoiceCharges({invoice,state}) {
  return <>{(Array.isArray(invoice.items)?invoice.items.filter(Boolean):[]).map((item,index)=><p key={item.id||index}><b>{state.services.find(s=>s.id===item.serviceId)?.name||item.name||'Unknown procedure'}</b> • {item.quantity||1} × {peso.format(item.unitFee??item.amount)} = {peso.format(item.amount)}</p>)}<p>Subtotal: {peso.format(invoice.subtotal??invoice.total)}</p><p><b>Total: {peso.format(invoice.total)}</b></p></>
}

export function BillingPage({ role, store, context }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const visible=visibleInvoices(state,session).filter(i=>role!=='staff'||i.branchId===session.branchId)
  const [reviewId,setReviewId]=useState(null),[payId,setPayId]=useState(null),[amount,setAmount]=useState('')
  const review=visible.find(i=>i.id===reviewId),pay=visible.find(i=>i.id===payId)
  const reviewInvoice=i=>{
    const result=actions.reviewInvoice(i.id)
    if(!result.ok)return toast(result.message,'warning')
    setReviewId(i.id)
  }
  const issue=()=>{
    const result=actions.issueInvoice(reviewId)
    if(!result.ok)return toast(result.message,'warning')
    setReviewId(null);toast('Invoice issued.','success')
  }
  const postPayment=method=>{
    const result=actions.postPayment(payId,method,amount)
    if(!result.ok)return toast(result.message,'warning')
    setPayId(null);toast(method==='Cash'?'Cash payment recorded; receipt available.':'Simulated electronic payment recorded; demo receipt available.','success')
  }
  if(role==='patient')return <PatientBillingPage store={store} context={context}/>
  return <>
    <PageHeader title="Billing & Payments" text="Branch-scoped charges from completed treatment. Staff reviews invoices before issuance and records full payment."/>
    <Card title="Branch payment worklist" subtitle={role==='staff'?`Assigned branch: ${state.branches.find(b=>b.id===session.branchId)?.name||'Not assigned'}`:'All clinic branches'}>
      {!visible.length&&<Notice>No payment records are available in your current scope.</Notice>}
      <div className="billing-worklist">{visible.map(i=><details className="billing-worklist-item" key={i.id}>
        <summary className="billing-worklist-row"><span className="billing-worklist-patient"><b>{patientName(i.patientId,state.patients)}</b><small>{i.invoiceNo||i.id}</small></span><strong>{peso.format(i.total)}</strong><Status>{i.status}</Status><time dateTime={i.visitDate}>{dateLabel(i.visitDate)}</time><span className="billing-worklist-chevron" aria-hidden="true">›</span></summary>
        <div className="billing-worklist-detail"><p><b>Branch:</b> {state.branches.find(b=>b.id===i.branchId)?.name||i.branchId}</p><p><b>Payment:</b> {i.paymentStatus} {i.method&&i.method!=='—'?`• ${i.method}`:''}</p><InvoiceCharges invoice={i} state={state}/>{i.receipt&&<p><b>Receipt:</b> {i.receipt}{i.payment?.simulation?' • Simulated electronic payment':''}<small className="block-muted">{i.payment?.recordedAt||i.paidAt} • {peso.format(i.payment?.amount??i.total)}</small></p>}
          {role==='staff'&&!validInvoice(state,i)&&i.status!=='Paid'&&<Notice>Historical charges need clinic review; completed procedure links are unavailable.</Notice>}
          {role==='staff'&&validInvoice(state,i)&&<div className="row-actions">{['Draft','Review'].includes(i.status)&&<Button size="sm" onClick={()=>reviewInvoice(i)}>Review Invoice</Button>}{i.status==='Issued'&&<Button size="sm" onClick={()=>{setPayId(i.id);setAmount(String(i.total))}}>Record Payment</Button>}</div>}
        </div>
      </details>)}</div>
    </Card>
    <Modal open={!!review} onClose={()=>setReviewId(null)} title="Review Invoice">{review&&<><p>{patientName(review.patientId,state.patients)} • {review.branch} • {dateLabel(review.visitDate)}</p><p>Treatment: {state.treatments.find(t=>t.id===review.treatmentId)?.procedure}</p><Status>{review.status}</Status><InvoiceCharges invoice={review} state={state}/><Button onClick={issue}>Issue Invoice</Button></>}</Modal>
    <Modal open={!!pay} onClose={()=>setPayId(null)} title="Record payment">{pay&&<><p>{pay.invoiceNo} • {patientName(pay.patientId,state.patients)} • {peso.format(pay.total)}</p><Notice>Cash is recorded by clinic staff. Card / Electronic is a simulation; no money is transferred.</Notice><Field label="Full payment amount" required><input type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></Field><div className="payment-options"><Button onClick={()=>postPayment('Cash')}>Record Cash</Button><Button onClick={()=>postPayment('Electronic')}>Simulate Card / Electronic</Button></div></>}</Modal>
  </>
}

export function HmoPage({ role, activeBranch, store, context }) {
  const {state,actions,toast}=store
  const session=store.session||sessionForRole(role,state)
  const visible=visibleHmo(state,session).filter(h=>role!=='owner'||!activeBranch||activeBranch==='All Branches'||state.branches.find(b=>b.id===h.branchId)?.name===activeBranch)
  const [selectedId,setSelectedId]=useState(context?.hmoCaseId||'')
  React.useEffect(()=>{if(context?.hmoCaseId)setSelectedId(context.hmoCaseId)},[context?.hmoCaseId])
  const selected=visible.find(h=>h.id===selectedId)||(!selectedId?visible[0]:null)
  const [creating,setCreating]=useState(false),[encounter,setEncounter]=useState('')
  const [operation,setOperation]=useState(null)
  const [form,setForm]=useState({method:'',note:'',nextAction:'',outcome:'',requirementIds:[]})
  const operate=(mode,h)=>{setOperation({mode,caseId:h.id,submissionCycle:h.submissionCycle,commandId:uid('hmo-command')});setForm({method:'',note:'',nextAction:'',outcome:'',requirementIds:[]})}
  const report=(result,message)=>{toast(result.ok?message:result.message,result.ok?'success':'warning');return result.ok}
  const create=()=>{
    const [kind,id]=encounter.split(':')
    const result=actions.createHmoCase(kind==='treatment'?{treatmentId:id}:{appointmentId:id})
    if(report(result,'Clinic HMO case prepared.')){setCreating(false);setSelectedId(result.record.id)}
  }
  const submit=()=>{
    if(!operation)return
    const input={...form,...operation}
    const result=operation.mode==='submit'?actions.submitHmoCase(operation.caseId,input):operation.mode==='contact'?actions.followUpHmo(operation.caseId,input):actions.recordHmoOutcome(operation.caseId,input)
    if(report(result,operation.mode==='response'?'Externally received provider response recorded.':'Clinic-side tracking record saved.'))setOperation(null)
  }
  const eligible=[...state.appointments.filter(a=>a.branchId===session.branchId&&!['Cancelled','No-show'].includes(a.status)).map(a=>({key:`appointment:${a.id}`,record:a})),...state.treatments.filter(t=>t.branchId===session.branchId&&!t.appointmentId).map(t=>({key:`treatment:${t.id}`,record:t}))].filter(x=>state.patients.find(p=>p.id===x.record.patientId)?.hmoProviderId)
  const staff=role==='staff',internal=staff||role==='owner'
  const label=h=>h.legacy&&['Approved','Rejected','Returned'].includes(h.status)?`Historical recorded ${h.status}`:['Approved','Rejected','Returned'].includes(h.status)?`Provider ${h.status}`:h.status
  if(role==='patient')return <PatientHmoPage store={store} context={context}/>
  return <>
    <PageHeader title={role==='patient'?'My HMO Coverage':role==='owner'?'HMO Overview':'HMO Cases'} text="Review patient cases, clinic-checked requirements, and externally received provider responses. Local checks do not confirm provider approval."/>
    {staff&&<div className="page-toolbar"><Button onClick={()=>setCreating(true)}>Prepare HMO Case</Button><Button variant="ghost" onClick={()=>report(actions.evaluateHmoTimers(),'Pending case timers checked.')}>Check overdue cases</Button></div>}
    {!visible.length?<Notice>No HMO cases are available in your scope.</Notice>:<div className="grid-2">
      <Card title="Case worklist" subtitle={role==='staff'?`Assigned branch: ${session.branchId||'Not assigned'}`:'Clinic-wide cases'}>{visible.map(h=><div className="clinical-history" key={h.id}><div><b>{role==='patient'?HMO_PROVIDERS.find(p=>p.id===h.providerId)?.name:patientName(h.patientId,state.patients)}</b><p>{state.branches.find(b=>b.id===h.branchId)?.name} • {h.submittedAt?'Submission recorded':'Not submitted'}</p><Status>{label(h)}</Status>{internal&&pendingHmo(h)&&<small className="block-muted">Pending {pendingHours(h,state.clock).toFixed(1)} hours</small>}</div><Button size="sm" variant="ghost" onClick={()=>setSelectedId(h.id)}>View case</Button></div>)}</Card>
      {selected&&<Card title={`${HMO_PROVIDERS.find(p=>p.id===selected.providerId)?.name||'HMO'} case`} subtitle={label(selected)}>
        <p>{patientName(selected.patientId,state.patients)} • {state.branches.find(b=>b.id===selected.branchId)?.name}</p>
        {internal&&(!validHmoContext(state,selected)||!hmoDataValid(selected,clinicNow()))&&<Notice tone="warning">Case relationships need clinic review before processing.</Notice>}
        <p>{selected.submittedAt?`Submission recorded: ${selected.submittedAt}`:'Not submitted'}</p>
        {selected.providerRespondedAt&&<p>Provider response recorded: {selected.providerRespondedAt}</p>}
        <h3>Requirements</h3>
        {(selected.requirements||[]).filter(Boolean).map(r=><HmoRequirement key={`${selected.id}:${r.id}`} requirement={r} canEdit={(staff||role==='patient')&&['Draft','Missing Requirements','Ready for Submission','Returned'].includes(selected.status)} patient={role==='patient'} onProvide={metadata=>report(actions.provideHmoRequirement(selected.id,r.ruleId,metadata),role==='patient'?'Document metadata recorded for clinic review.':'Requirement checked locally.')}/>)}
        {staff&&validHmoContext(state,selected)&&hmoDataValid(selected,clinicNow())&&<div className="form-actions">
          {selected.status==='Ready for Submission'&&<Button onClick={()=>operate('submit',selected)}>{selected.submissionCycle?'Record Resubmission':'Record External Submission'}</Button>}
          {pendingHmo(selected)&&<><Button variant="ghost" onClick={()=>operate('contact',selected)}>Record Contact Attempt</Button><Button onClick={()=>operate('response',selected)}>Record Provider Response</Button>{selected.status!=='Escalated'&&pendingHours(selected,state.clock)>=HMO_PENDING_HOURS&&<Button variant="danger" onClick={()=>report(actions.escalateHmo(selected.id),'Case escalated for clinic attention.')}>Escalate Case</Button>}</>}
        </div>}
        {internal&&hmoDataValid(selected,clinicNow())&&<><h3>Clinic follow-up history</h3>{!(selected.contacts||[]).length&&<Notice>No contact attempts recorded.</Notice>}{(selected.contacts||[]).map(c=><p key={c.id}><b>{c.at} • {c.method} • {state.users.find(u=>u.id===c.staffUserId)?.name||c.staffUserId}</b><br/>{c.note}<br/>Next action: {c.nextAction}</p>)}{(selected.responses||[]).map(r=><p key={r.id}><b>Provider response recorded: {r.outcome}</b><br/>{r.recordedAt} • {r.method}<br/>{r.note}</p>)}</>}
      </Card>}
    </div>}
    <Modal open={creating} onClose={()=>setCreating(false)} title="Prepare HMO case"><Field label="Insured encounter" required><select value={encounter} onChange={e=>setEncounter(e.target.value)}><option value="">Select encounter</option>{eligible.map(({key,record:r})=><option key={key} value={key}>{patientName(r.patientId,state.patients)} • {r.date} • {state.services.find(s=>s.id===r.serviceId)?.name} • {r.id}</option>)}</select></Field><Notice>Patient, membership, branch, and encounter details are prefilled from the selected visit.</Notice><Button onClick={create}>Prepare Case</Button></Modal>
    <Modal open={!!operation} onClose={()=>setOperation(null)} title={operation?.mode==='response'?'Record externally received provider response':operation?.mode==='contact'?'Record clinic contact attempt':'Record external submission'}>
      <Notice>No provider is contacted by this application. Record an action or response handled outside the app.</Notice>
      <Field label="Channel" required><select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}><option value="">Select channel</option>{['Portal','Email','Phone','In person'].map(m=><option key={m}>{m}</option>)}</select></Field>
      {operation?.mode==='response'&&<><Field label="Provider outcome received" required><select value={form.outcome} onChange={e=>setForm({...form,outcome:e.target.value})}><option value="">Select received outcome</option><option>Approved</option><option>Rejected</option><option>Returned</option></select></Field>{form.outcome==='Returned'&&<fieldset><legend>Requirements returned for correction</legend>{HMO_REQUIREMENT_RULES.map(r=><label className="check-control" key={r.id}><input type="checkbox" checked={form.requirementIds.includes(r.id)} onChange={e=>setForm({...form,requirementIds:e.target.checked?[...form.requirementIds,r.id]:form.requirementIds.filter(id=>id!==r.id)})}/>{r.label}</label>)}</fieldset>}</>}
      <Field label="Internal tracking note / result" required><textarea value={form.note} onChange={e=>setForm({...form,note:e.target.value})}/></Field>
      {operation?.mode==='contact'&&<Field label="Next action" required><input value={form.nextAction} onChange={e=>setForm({...form,nextAction:e.target.value})}/></Field>}
      <Button onClick={submit}>Save Tracking Record</Button>
    </Modal>
  </>
}
function HmoRequirement({requirement:r,canEdit,patient,onProvide}) {
  const [metadata,setMetadata]=useState({fileName:r.document?.fileName||''})
  return <div className="clinical-history"><div><b>{r.label}</b><Status>{r.state}</Status>{canEdit&&r.state!=='Validated locally'&&<><Field label={patient?'Select document (metadata only)':'Document name / clinic record'}>{patient?<input type="file" onChange={e=>{const file=e.target.files?.[0];setMetadata(file?{fileName:file.name,size:file.size}:{fileName:''})}}/>:<input value={metadata.fileName} onChange={e=>setMetadata({...metadata,fileName:e.target.value})}/>}</Field><Button size="sm" onClick={()=>onProvide(metadata)}>{patient?'Record Document Metadata':'Validate Locally'}</Button><small className="block-muted">No file is uploaded or stored. Local validation is not provider approval.</small></>}</div></div>
}

export function InquiriesPage({ store }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole('staff',state)
  const visible=state.inquiries.filter(i=>i.assignedUserId===session.userId&&i.branchId===session.branchId)
  const command=useRef(uid('inquiry'))
  const [newInquiry,setNewInquiry]=useState({source:'Facebook',name:'',contact:'',topic:''})
  const [linking,setLinking]=useState(null)
  const [appointmentId,setAppointmentId]=useState('')
  const report=(result,message)=>{toast(result.ok?message:result.message,result.ok?'success':'warning');return result.ok}
  const add=()=>{if(report(actions.createInquiry(newInquiry,command.current),'Inquiry captured and assigned.'))setNewInquiry({source:'Facebook',name:'',contact:'',topic:''})}
  const respond=i=>report(actions.updateInquiry(i.id,'Responded'),'Staff response recorded.')
  const close=i=>report(actions.updateInquiry(i.id,'Closed'),'Inquiry closed.')
  const linkBooking=()=>{if(report(actions.convertInquiry(linking?.id,appointmentId),'Inquiry linked to its appointment and conversation.')){setLinking(null);setAppointmentId('')}}
  return <>
    <PageHeader title="Social Media Inquiry Management" text="Pre-booking social inquiries become trackable records with source, topic, assignment, response status, follow-up, and conversion to a booked appointment." modules={[16]}/>
    <div className="grid-2">
      <Card title="Capture inquiry"><div className="form-grid"><Field label="Source"><select value={newInquiry.source} onChange={e=>{command.current=uid('inquiry');setNewInquiry({...newInquiry,source:e.target.value})}}><option>Facebook</option><option>Instagram</option><option>Website</option></select></Field><Field label="Name"><input value={newInquiry.name} onChange={e=>{command.current=uid('inquiry');setNewInquiry({...newInquiry,name:e.target.value})}}/></Field><Field label="Contact"><input value={newInquiry.contact} onChange={e=>{command.current=uid('inquiry');setNewInquiry({...newInquiry,contact:e.target.value})}}/></Field><Field label="Topic"><input value={newInquiry.topic} onChange={e=>{command.current=uid('inquiry');setNewInquiry({...newInquiry,topic:e.target.value})}}/></Field><Button className="span-2" onClick={add}>Create & Assign Inquiry</Button></div></Card>
      <Card title="Response automation"><Notice tone="info">Unanswered inquiries remain visible to staff and would generate reminder tasks after the configured response period in a real implementation.</Notice><div className="metric-row"><div><span>Open inquiries</span><small>Awaiting staff action</small></div><b>{visible.filter(i=>i.status==='Open').length}</b></div><div className="metric-row"><div><span>Converted to appointment</span><small>Booked inquiries linked to scheduling</small></div><b>{visible.filter(i=>i.bookedAppointmentId).length}</b></div></Card>
    </div>
    <Card className="top-gap" title="Inquiry worklist"><Table rows={visible} columns={[{key:'source',label:'Source'},{key:'name',label:'Contact'},{key:'topic',label:'Topic'},{key:'assigned',label:'Assigned staff',render:i=>state.users.find(u=>u.id===i.assignedUserId)?.name||'Unassigned'},{key:'receivedAt',label:'Received'},{key:'booking',label:'Appointment',render:i=>i.bookedAppointmentId||'—'},{key:'status',label:'Status',render:i=><Status>{i.status}</Status>},{key:'actions',label:'Actions',render:i=><div className="row-actions">{i.status==='Open'&&<Button size="sm" onClick={()=>respond(i)}>Record response</Button>}{['Responded','Open'].includes(i.status)&&!i.bookedAppointmentId&&<Button size="sm" variant="ghost" onClick={()=>setLinking(i)}>Link booked appointment</Button>}{!['Closed','Converted'].includes(i.status)&&<Button size="sm" variant="ghost" onClick={()=>close(i)}>Close</Button>}</div>}]} /></Card>
    <Modal open={!!linking} onClose={()=>setLinking(null)} title="Convert inquiry to appointment" subtitle="Link the social inquiry to the booking that resulted from the conversation."><Field label="Booked appointment"><select value={appointmentId} onChange={e=>setAppointmentId(e.target.value)}><option value="">Select appointment</option>{state.appointments.filter(a=>a.branchId===session.branchId&&a.status!=='Cancelled').map(a=><option key={a.id} value={a.id}>{dateLabel(a.date)} • {displayTime(a.start)} • {patientName(a.patientId,state.patients)} • {a.service}</option>)}</select></Field><Button className="full" onClick={linkBooking}>Record Appointment Conversion</Button></Modal>
  </>
}

export function MessagesPage({ role, store, context }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const relevant=visibleConversations(state,session)
  const [selected,setSelected]=useState(context?.conversationId||null)
  React.useEffect(()=>{if(context?.conversationId)setSelected(context.conversationId)},[context?.conversationId])
  const [text,setText]=useState('')
  const command=useRef(uid('reply'))
  const convo=relevant.find(c=>c.id===selected)
  const open=id=>{const result=actions.markConversationRead(id);if(!result.ok)return toast(result.message,'warning');setSelected(id);setText('');command.current=uid('reply')}
  const send=()=>{
    if(!convo)return
    const result=actions.replyToConversation(convo.id,text,command.current)
    if(!result.ok)return toast(result.message,'warning')
    setText('');toast('Reply recorded in the conversation.','success')
  }
  const resolve=()=>{const result=actions.closeConversation(convo.id);toast(result.ok?'Conversation closed.':result.message,result.ok?'success':'warning')}
  if(role==='patient')return <PatientMessagesPage store={store} context={context}/>
  return <>
    <PageHeader title="Messages" text="Two-way conversations with your assigned participants. Operational notifications remain in the notification bell."/>
    <div className="grid-2">
      <Card className="conversation-list" title="Conversations">{!relevant.length&&<Notice>No conversations are assigned to you.</Notice>}{relevant.map(c=><button key={c.id} className={selected===c.id?'selected':''} onClick={()=>open(c.id)}><div><b>{patientName(c.patientId,state.patients)}</b><small>{c.context} {c.unreadUserIds.includes(session.userId)?'• Unread':''}</small></div><Status>{c.status}</Status></button>)}</Card>
      <Card title={convo?`${patientName(convo.patientId,state.patients)} • ${convo.context}`:'Select a conversation'} actions={convo&&role!=='patient'&&convo.status==='Open'?<Button size="sm" variant="ghost" onClick={resolve}>Mark resolved</Button>:null}>{convo?<>
        {convo.unreadUserIds.includes(session.userId)&&<Button variant="ghost" onClick={()=>open(convo.id)}>Mark conversation read</Button>}
        <div className="message-thread">{convo.messages.map(m=><div className={`bubble ${m.senderUserId===session.userId?'mine':''}`} key={m.id}><small>{state.users.find(u=>u.id===m.senderUserId)?.name||'Historical participant'}</small><p>{m.text}</p><span>{m.at}</span></div>)}</div>
        {convo.status==='Open'?<div className="compose-row"><textarea aria-label="Reply" value={text} onChange={e=>{setText(e.target.value);command.current=uid('reply')}} placeholder="Write a message..."/><Button onClick={send}>Record Reply</Button></div>:<Notice>This conversation is closed.</Notice>}
      </>:<Notice>Select an assigned conversation to read or reply.</Notice>}</Card>
    </div>
  </>
}
