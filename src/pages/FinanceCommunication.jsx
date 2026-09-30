import React, { useState, useRef, useEffect } from 'react'
import { Button, Card, Field, Modal, Notice, PageHeader, Status, Table } from '../components.jsx'
import { dateLabel, displayTime, patientName, peso, uid } from '../logic.js'

import { visibleInvoices, validInvoice } from '../phase2.js'
import { visibleConversations } from '../phase3-contracts.js'
import { sessionForRole } from '../contracts.js'
import { PatientBillingPage } from './PatientCare.jsx'
import { PatientMessagesPage } from './PatientMessages.jsx'
import { listBillingInvoices, listBillingTreatments, createBillingDraft, reviewBillingInvoice, issueBillingInvoice, recordBillingPayment } from '../api-client.js'

function InvoiceCharges({invoice,state}) {
  return <>{(Array.isArray(invoice.items)?invoice.items.filter(Boolean):[]).map((item,index)=><p key={item.id||index}><b>{state.services.find(s=>s.id===item.serviceId)?.name||item.name||'Unknown procedure'}</b> • {item.quantity||1} × {peso.format(item.unitFee??item.amount)} = {peso.format(item.amount)}</p>)}<p>Subtotal: {peso.format(invoice.subtotal??invoice.total)}</p><p><b>Total: {peso.format(invoice.total)}</b></p></>
}

export function BillingPage({ role, store, context }) {
  const { state, actions, toast }=store
  const session=store.session||sessionForRole(role,state)
  const visible=visibleInvoices(state,session).filter(i=>role!=='staff'||i.branchId===session.branchId)
  const [reviewId,setReviewId]=useState(null),[payId,setPayId]=useState(null),[amount,setAmount]=useState('')
  const [serverRows,setServerRows]=useState(null),[serverTreatments,setServerTreatments]=useState([]),[serverError,setServerError]=useState('')
  useEffect(()=>{if(role==='patient')return;let live=true;Promise.all([listBillingInvoices(),listBillingTreatments()]).then(([invoices,treatments])=>{if(!live)return;invoices.ok?setServerRows(Array.isArray(invoices.data)?invoices.data:[]):setServerError(invoices.message||'Billing records could not be loaded.');if(treatments.ok)setServerTreatments(Array.isArray(treatments.data)?treatments.data:[])});return()=>{live=false}},[role])
  if(role!=='patient'&&serverRows!==null){
    const row=serverRows.find(i=>i.id===reviewId), pay=serverRows.find(i=>i.id===payId)
    const run=(fn,id,payload,msg)=>fn(id,payload,uid('m11')).then(r=>{if(!r.ok)return toast(r.message||'Billing action was not completed.','warning');setServerRows(xs=>xs.map(x=>x.id===id?r.data:x));setReviewId(null);setPayId(null);toast(msg,'success')})
    return <><PageHeader title="Billing & Payments" text="Server-authoritative invoices from completed treatment. Review, issue and record full external payments within your branch scope."/>{serverError&&<Notice tone="warning">{serverError}</Notice>}<Card title="Completed Treatments awaiting billing"><div className="billing-worklist">{serverTreatments.filter(t=>t.billing_state!=='already_invoiced').map(t=><div className="billing-worklist-row" key={t.id}><span className="billing-worklist-patient"><b>{t.patient?.name||'Patient'}</b><small>{t.branch?.name} • {(t.services||[]).map(s=>s.name).join(', ')}</small></span>{t.billing_state==='pricing_unavailable'?<Notice tone="warning">Pricing unavailable: {(t.pricing_unavailable||[]).map(s=>s.name).join(', ')}</Notice>:<Button size="sm" onClick={()=>createBillingDraft(t.id,uid('m11')).then(r=>{if(!r.ok)return toast(r.message||'Draft could not be created.','warning');setServerRows(xs=>[r.data,...(xs||[])]);setServerTreatments(xs=>xs.map(x=>x.id===t.id?{...x,billing_state:'already_invoiced',invoice:r.data.id}:x));toast('Invoice Draft created.','success')})}>Create Draft</Button>}</div>)}</div>{!serverTreatments.filter(t=>t.billing_state!=='already_invoiced').length&&<Notice>No completed Treatments are awaiting billing.</Notice>}</Card><Card title={role==='staff'?'Branch payment worklist':'Financial oversight'}><div className="billing-worklist">{serverRows.map(i=><details className="billing-worklist-item" key={i.id}><summary className="billing-worklist-row"><span className="billing-worklist-patient"><b>{i.patient?.name||'Patient'}</b><small>{i.invoice_number}</small></span><strong>₱{i.gross_amount}</strong><Status>{i.status}</Status><time>{i.visit_id||''}</time><span aria-hidden="true">›</span></summary><div className="billing-worklist-detail"><p><b>Responsibility:</b> ₱{i.patient_responsibility_amount} • <b>Balance:</b> ₱{i.balance}</p>{i.hmo_status&&<p><b>HMO:</b> {i.hmo_status}{i.settlement_type==='full_hmo_coverage'?' • fully covered; no payment collected':''}</p>}<div className="row-actions">{role==='staff'&&i.status==='Draft'&&<Button size="sm" onClick={()=>run(reviewBillingInvoice,i.id,{expected_revision:i.revision},'Invoice moved to Review.')}>Review Invoice</Button>}{role==='staff'&&i.status==='Review'&&<Button size="sm" onClick={()=>run(issueBillingInvoice,i.id,{expected_revision:i.revision},'Invoice issued.')}>Issue Invoice</Button>}{role==='staff'&&i.status==='Issued'&&<Button size="sm" onClick={()=>{setPayId(i.id);setAmount(i.balance)}}>Record full payment</Button>}</div></div></details>)}</div>{!serverRows.length&&<Notice>No authoritative invoices are available in this scope.</Notice>}</Card>{row&&<Modal open onClose={()=>setReviewId(null)} title="Invoice review"><p>{row.invoice_number} • {row.patient?.name}</p></Modal>}{pay&&<Modal open onClose={()=>setPayId(null)} title="Record full payment"><Notice>Payments are recorded manually after an external Cash, Card/POS, Bank Transfer or E-Wallet collection.</Notice><Field label="Method"><select id="m11-method" defaultValue="Cash"><option>Cash</option><option>Card/POS</option><option>Bank Transfer</option><option>E-Wallet</option></select></Field><Field label="External reference"><input id="m11-reference" placeholder="Required except Cash"/></Field><Button onClick={()=>run(recordBillingPayment,pay.id,{expected_revision:pay.revision,method:document.getElementById('m11-method').value,external_reference:document.getElementById('m11-reference').value||null},'Payment recorded and receipt issued.')}>Record ₱{amount}</Button></Modal>}</>
  }
  if(role!=='patient' && typeof window!=='undefined') return <><PageHeader title="Billing & Payments" text="Authoritative billing records are loaded from the clinic server."/>{serverError?<Notice tone="warning">{serverError}</Notice>:<Notice>Loading authoritative billing records…</Notice>}<Card title="Historical demo records" subtitle="Read-only browser history; never used for current balances or payments."><Notice>No current financial action is available until the server billing records load.</Notice></Card></>
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
        <summary className="billing-worklist-row"><span className="billing-worklist-patient"><b>{patientName(i.patientId,state.patients)}</b><small>{i.invoiceNo||i.id}{i.legacyAppointment?' • Historical demo record':''}</small></span><strong>{peso.format(i.total)}</strong><Status>{i.status}</Status><time dateTime={i.visitDate}>{dateLabel(i.visitDate)}</time><span className="billing-worklist-chevron" aria-hidden="true">›</span></summary>
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

// M12: the HMO workspace lives in ./Hmo.jsx (server-authoritative minimal foundation).
export { HmoPage } from './Hmo.jsx'

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
    <PageHeader title="Social Media Inquiry Management" text="Pre-booking social inquiries become trackable records with source, topic, assignment, response status, follow-up, and conversion to a booked appointment."/>
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
