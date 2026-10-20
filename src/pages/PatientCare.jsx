import React, { useState, useEffect, useRef } from 'react'
import { Button, Empty, Notice, PageHeader, Status } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { formatStamp, hmoCaseView, invoiceView, money, patientContext, patientHmo, patientInvoices, patientPrescriptions, prescriptionView, resolveTarget } from '../patient-view.js'
import { DefinitionList, RecordCard } from '../patient-ui.jsx'
import { formatAmount } from '../pricing-api.js'
import { myBillingInvoices, getBillingInvoice } from '../api-client.js'
import { ReviewAndPay } from './ReviewAndPay.jsx'
import { paymentMethodLabel } from '../payment-method.js'
import { clinic } from '../clinic-config.js'
import { useVisibleRefresh } from '../use-visible-refresh.js'

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

export function PatientBillingPage({ store, context }) {
  const { state }=store, session=store.session
  const [openReceiptId,setOpenReceiptId]=useState(null)
  const [serverItems,setServerItems]=useState(null),[serverError,setServerError]=useState('')
  const [reviewId,setReviewId]=useState(null)
  const [attempt,setAttempt]=useState(0)
  const [nextCursor,setNextCursor]=useState(null),[loadingMore,setLoadingMore]=useState(false),[moreError,setMoreError]=useState('')
  const PAGE=25
  // A link to one invoice (email button or PayMongo return; see invoice-link.js). Coming back from the payment page is NOT proof
  // of payment: the banner reflects only what the clinic server reports for that invoice (Paid after the provider's verified
  // confirmation), never the link itself.
  const linkId=typeof context?.invoiceId==='string'?context.invoiceId.toLowerCase():null, linkPayment=context?.payment||null
  const [linkState,setLinkState]=useState(linkId&&linkPayment?'checking':null)
  useEffect(()=>{let live=true;setServerError('');myBillingInvoices({per_page:PAGE}).then(r=>{if(!live)return;if(r.ok){const rows=Array.isArray(r.data)?r.data:[];setServerItems(previous=>[...rows,...(previous||[]).filter(p=>!rows.some(x=>x.id===p.id))]);setNextCursor(r.meta?.next_cursor??null);setMoreError('')}else setServerError(r.message||'Your invoices could not be loaded.')});return()=>{live=false}},[attempt])
  const loadOlder=async()=>{if(!nextCursor||loadingMore)return;setLoadingMore(true);setMoreError('');const r=await myBillingInvoices({per_page:PAGE,cursor:nextCursor});setLoadingMore(false);if(!r.ok)return setMoreError(r.message||'Older invoices could not be loaded.');setServerItems(previous=>[...(previous||[]),...(Array.isArray(r.data)?r.data:[]).filter(row=>!(previous||[]).some(p=>p.id===row.id))]);setNextCursor(r.meta?.next_cursor??null)}
  // Pending settlement is re-checked with the project's visible-tab refresh primitive (no ad-hoc timers): every 3 seconds, for
  // about a minute, only while this page is open.
  const confirmTries=useRef(0)
  const checkLinked=async(first=false)=>{
    const r=await getBillingInvoice(linkId)
    if(r.ok&&r.data){
      const row=r.data
      setServerItems(previous=>previous===null?[row]:(previous.some(p=>p.id===row.id)?previous.map(p=>p.id===row.id?row:p):[row,...previous])) // kept even if older than the first page
      if(row.status==='Paid'){setLinkState(linkPayment?'paid':null);return}
      if(linkPayment==='cancelled'){setLinkState('cancelled');return}
      if(first&&!linkPayment&&row.status==='Issued'&&Number(row.balance)>0){setReviewId(row.id);return} // "Review and pay" from the email
    } else if(first&&!linkPayment){setLinkState('unavailable');return}
    if(linkPayment==='success'&&++confirmTries.current>=20)setLinkState('timeout')
  }
  useEffect(()=>{if(linkId)checkLinked(true)},[linkId,linkPayment])
  useVisibleRefresh(checkLinked,{active:linkState==='checking'&&linkPayment==='success',intervalMs:3000})
  if(!patientContext(state,session))return NO_ACCOUNT
  const patient=patientContext(state,session).patient
  const target=resolveTarget(state,session,'billing',context)
  const items=serverItems!==null?(serverItems||[]).map(i=>({id:i.id,publicId:i.public_id,invoiceNo:i.invoice_number,date:i.issued_at||i.created_at,branch:i.branch?.name||'',status:i.status,total:i.gross_amount,hmoCoverage:i.hmo_coverage_amount,patientResponsibility:i.patient_responsibility_amount,balance:i.balance,settlementType:i.settlement_type,items:(i.lines||[]).map(l=>({key:l.id,name:l.service?.name||'Service',quantity:l.quantity,unit:l.unit_price,amount:l.line_total})),receipt:i.receipt?{number:i.receipt.number,amount:i.receipt.amount,method:paymentMethodLabel(i.receipt.method),status:'Recorded',paidAt:i.receipt.issued_at}:null})) : (typeof window==='undefined'?patientInvoices(state,session).map(i=>invoiceView(state,i)):[])
  const reviewing=reviewId?items.find(i=>i.id===reviewId):null
  if(reviewing)return <div className="pt-page"><ReviewAndPay invoice={reviewing} onBack={()=>setReviewId(null)}/></div>
  return <div className="pt-page">
    <PageHeader kicker="Your care" title="Receipts & Payments" text="Invoices the clinic has issued, and your receipts. The clinic records payments. Nothing is charged when you book."/>
    {linkState==='checking'&&<Notice tone="info" title="Confirming your payment">You are back from the payment page. Your invoice shows as paid only after the clinic system receives confirmation from PayMongo. This usually takes a few seconds.</Notice>}
    {linkState==='paid'&&<Notice tone="success" title="Payment received">The clinic system has confirmed your payment and your invoice is settled. Your Payment Receipt is on its way to your email.</Notice>}
    {linkState==='timeout'&&<Notice tone="warning" title="Payment pending">We have not received confirmation from PayMongo yet, so your invoice still shows as unpaid. Check again in a few minutes, and contact the clinic if you were charged and it still shows unpaid. <Button size="sm" variant="ghost" onClick={()=>{confirmTries.current=0;setLinkState('checking')}}>Check again</Button></Notice>}
    {linkState==='cancelled'&&<Notice tone="warning" title="Payment cancelled">You left the payment page before paying. Nothing was charged and your balance is unchanged. You can try again below.</Notice>}
    {linkState==='unavailable'&&<Notice tone="warning" title="Invoice not available">That invoice could not be opened from your account. Your invoices are listed below.</Notice>}
    <div className="pt-list">{serverError?<Notice tone="warning" title="Invoices unavailable">{serverError} <Button size="sm" variant="ghost" onClick={()=>setAttempt(attempt+1)}>Retry</Button></Notice>:serverItems===null&&typeof window!=='undefined'?<Notice>Loading your invoices…</Notice>:items.length?items.map(inv=><RecordCard key={inv.id} id={`invoice-${inv.id}`} highlight={target===inv.id||(linkId!==null&&String(inv.id).toLowerCase()===linkId)} title={inv.invoiceNo||'Invoice'} subtitle={`${dateLabel(inv.date)}${inv.branch?` • ${inv.branch}`:''}${serverItems===null?' • Historical browser record':''}`} status={inv.status}>
      <ul className="pt-charges" aria-label="Itemized charges">{inv.items.map(item=><li key={item.key}><span><b>{item.name}</b><small>{item.quantity} × {money(item.unit)}</small></span><span>{money(item.amount)}</span></li>)}</ul>
      <div className="pt-total"><span>Total / Patient responsibility</span><b>{money(inv.patientResponsibility??inv.total)}</b></div>{inv.balance!==undefined&&<p className="pt-hint">Balance: {money(inv.balance)}{inv.settlementType==='full_hmo_coverage'?' • Fully covered by HMO; no Patient payment was collected.':''}</p>}
      {inv.status==='Issued'&&Number(inv.balance??inv.patientResponsibility??0)>0&&serverItems!==null&&<div style={{marginTop:'10px'}}>
        <Button size="sm" variant="primary" onClick={()=>setReviewId(inv.id)}>Review and pay online</Button>
      </div>}
      {inv.receipt&&<p className="pt-hint">Receipt available: {inv.receipt.number}</p>}
      {inv.receipt&&<Button size="sm" variant="soft" aria-expanded={openReceiptId===inv.id} aria-controls={`receipt-${inv.id}`} onClick={()=>setOpenReceiptId(openReceiptId===inv.id?null:inv.id)}>{openReceiptId===inv.id?'Hide Receipt':'View Receipt'}</Button>}
      {inv.receipt&&openReceiptId===inv.id&&<div className="pt-receipt" id={`receipt-${inv.id}`}><h4>Payment receipt</h4><p className="pt-hint">{clinic.name}</p><DefinitionList items={[
        {label:'Branch',value:inv.branch},
        {label:'Patient',value:patient.name},
        {label:'Service',value:inv.items.map(item=>item.name).join(', ')},
        {label:'Appointment reference',value:state.appointments.find(a=>a.id===inv.appointmentId)?.appointmentNo||null},
        {label:'Invoice',value:inv.invoiceNo},
        {label:'Receipt reference',value:inv.receipt.number},
        {label:'Amount paid',value:money(inv.receipt.amount)},
        {label:'Payment method',value:inv.receipt.method},
        {label:'Payment status',value:inv.receipt.status},
        {label:'Payment date and time',value:formatStamp(inv.receipt.paidAt)},
      ]}/></div>}
    </RecordCard>):<Empty title="No invoices yet" text="Invoices appear here after the clinic issues them."/>}</div>
    {serverItems!==null&&!serverError&&items.length>0&&<div className="pt-more" style={{marginTop:'12px',textAlign:'center'}}>
      <p className="pt-hint" role="status">Showing {items.length} invoice{items.length===1?'':'s'}{nextCursor?'. Older invoices are available.':'. That is all of your invoices.'}</p>
      {moreError&&<Notice tone="warning" title="Older invoices unavailable">{moreError} <Button size="sm" variant="ghost" onClick={loadOlder}>Retry</Button></Notice>}
      {nextCursor&&!moreError&&<Button variant="soft" disabled={loadingMore} onClick={loadOlder}>{loadingMore?'Loading…':'Load older invoices'}</Button>}
    </div>}
  </div>
}

// Patients may record document details only. The clinic checks them locally, which is not provider approval.
// M12: requirement status only. Documents are brought to the clinic; nothing is uploaded or recorded in this app (M14).
function Requirement({ requirement:r }) {
  return <li className={`pt-req ${r.needsAction?'needs-action':''}`.trim()}>
    <div className="pt-req-head"><b>{r.label}</b><Status>{r.state==='Validated locally'?'Checked at the clinic':r.state}</Status>{r.returned&&<span className="pt-flag">Needs correction</span>}</div>
    {r.needsAction&&<p className="pt-hint">Please bring this document to the clinic. The clinic checks it; that is not approval from your HMO.</p>}
    {r.clinicSide&&r.state==='Missing'&&<p className="pt-hint">The clinic prepares this document. Nothing is needed from you.</p>}
  </li>
}

// The Patient's own HMO cases from the clinic server (GET /api/hmo-cases/mine, identity from the session): status,
// requirement states, dates, the final outcome and the approved amount when Approved. Read-only in this wave.
export function PatientHmoPage({ store, context }) {
  const { state }=store, session=store.session
  if(!patientContext(state,session))return NO_ACCOUNT
  const target=resolveTarget(state,session,'hmo',context)
  const cases=patientHmo(state,session)
  return <div className="pt-page">
    <PageHeader kicker="Your coverage" title="HMO Coverage" text="The clinic tracks the documents for your HMO request and any response your provider sends back."/>
    <Notice tone="info">Checking your documents at the clinic is not approval from your HMO. Only a response from your provider counts as a provider decision.</Notice>
    <div className="pt-list">{cases.length?cases.map(h=>{
      const v=hmoCaseView(h)
      const missing=v.requirements.filter(r=>r.needsAction)
      return <RecordCard key={h.id} id={`hmo-${h.id}`} highlight={target===h.id} title={v.provider} subtitle={h.branchName?`Branch: ${h.branchName}`:undefined} status={v.label}>
        <p className={`pt-stage-line ${v.escalated?'is-attention':''}`.trim()}>{v.stage}</p>
        {h.legacy&&<Notice>An earlier record kept for reference. It is not part of your current billing.</Notice>}
        {missing.length?<Notice tone="warning"><b>Action required</b><br/>Bring to the clinic: {missing.map(r=>r.label).join(', ')}</Notice>:<Notice>No action required right now.</Notice>}
        <DefinitionList items={[
          {label:'Provider',value:v.provider},
          {label:'Member ID',value:h.server?h.memberId:null},
          {label:'Visit',value:h.clinicDate?`${dateLabel(h.clinicDate)}${h.appointmentCode?` • ${h.appointmentCode}`:''}`:null},
          {label:'Status',value:v.label},
          {label:'Documents checked at the clinic',value:v.total?`${v.checked} of ${v.total}`:null},
          {label:'Submission',value:v.submittedAt?`Recorded ${formatStamp(v.submittedAt)}`:'Not yet submitted'},
          {label:'Provider response',value:v.respondedAt?`Recorded ${formatStamp(v.respondedAt)}`:'None recorded yet'},
          {label:'Approved amount',value:v.approvedAmount?formatAmount(v.approvedAmount):null},
          {label:'Clinic follow-up',value:v.escalated?'The clinic is following up':null},
        ]}/>
        {v.requirements.length>0&&<><h4>Documents</h4><ul className="pt-reqs">{v.requirements.map(r=><Requirement key={`${h.id}:${r.id}`} requirement={r}/>)}</ul></>}
      </RecordCard>
    }):<Empty title="No HMO case" text="You have no HMO case with the clinic yet."/>}</div>
  </div>
}
