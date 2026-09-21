import React, { useState } from 'react'
import { Button, Empty, Field, Notice, PageHeader, Status } from '../components.jsx'
import { dateLabel } from '../logic.js'
import { formatStamp, hmoCaseView, invoiceView, money, patientContext, patientHmo, patientInvoices, patientPrescriptions, prescriptionView, resolveTarget } from '../patient-view.js'
import { DefinitionList, RecordCard } from '../patient-ui.jsx'

const NO_ACCOUNT=<Notice tone="warning" title="We couldn’t confirm your account">Reopen your workspace, or ask the clinic to check your account access.</Notice>

export function PatientPrescriptionsPage({ store, context }) {
  const { state }=store, session=store.session
  if(!patientContext(state,session))return NO_ACCOUNT
  const target=resolveTarget(state,session,'prescriptions',context)
  const items=patientPrescriptions(state,session).map(r=>prescriptionView(state,r)).sort((a,b)=>String(b.authorizedAt||'').localeCompare(String(a.authorizedAt||'')))
  return <div className="pt-page">
    <PageHeader kicker="Your care" title="My Prescriptions" text="Prescriptions appear here after your Dentist authorizes them."/>
    <div className="pt-list">{items.length?items.map(rx=><RecordCard key={rx.id} id={`rx-${rx.id}`} highlight={target===rx.id} title={rx.items.map(i=>i.medication).filter(Boolean).join(', ')||'Prescription'} subtitle={`Authorized by ${rx.dentist}${rx.authorizedAt?` • ${formatStamp(rx.authorizedAt)}`:''}`} status="Authorized">
      {rx.items.map(item=><div className="pt-rx-item" key={item.key}><h4>{item.medication||'Medication'}</h4><DefinitionList items={[{label:'Dosage',value:item.dosage},{label:'Instructions',value:item.instructions},{label:'Duration',value:item.duration}]}/></div>)}
      <DefinitionList items={[{label:'From your visit',value:rx.visitDate?dateLabel(rx.visitDate):null}]}/>
    </RecordCard>):<Empty title="No prescriptions" text="Prescriptions appear here after your Dentist authorizes them."/>}</div>
  </div>
}

export function PatientBillingPage({ store, context }) {
  const { state }=store, session=store.session
  if(!patientContext(state,session))return NO_ACCOUNT
  const target=resolveTarget(state,session,'billing',context)
  const items=patientInvoices(state,session).map(i=>invoiceView(state,i)).sort((a,b)=>String(b.date).localeCompare(String(a.date)))
  return <div className="pt-page">
    <PageHeader kicker="Your care" title="Receipts & Payments" text="Invoices the clinic has issued, and your receipts. The clinic records payments. Nothing is charged when you book."/>
    <div className="pt-list">{items.length?items.map(inv=><RecordCard key={inv.id} id={`invoice-${inv.id}`} highlight={target===inv.id} title={inv.invoiceNo||'Invoice'} subtitle={`${dateLabel(inv.date)}${inv.branch?` • ${inv.branch}`:''}`} status={inv.status}>
      <ul className="pt-charges" aria-label="Itemized charges">{inv.items.map(item=><li key={item.key}><span><b>{item.name}</b><small>{item.quantity} × {money(item.unit)}</small></span><span>{money(item.amount)}</span></li>)}</ul>
      <div className="pt-total"><span>Total</span><b>{money(inv.total)}</b></div>
      {inv.receipt&&<div className="pt-receipt"><h4>Receipt</h4><DefinitionList items={[{label:'Receipt number',value:inv.receipt.number},{label:'Payment method',value:inv.receipt.simulated?'Simulated electronic payment — no money was transferred':inv.receipt.method},{label:'Paid',value:formatStamp(inv.receipt.paidAt)}]}/></div>}
    </RecordCard>):<Empty title="No invoices yet" text="Invoices appear here after the clinic issues them."/>}</div>
  </div>
}

// Patients may record document details only. The clinic checks them locally, which is not provider approval.
function Requirement({ requirement:r, onProvide }) {
  const [details,setDetails]=useState({fileName:''})
  return <li className={`pt-req ${r.needsAction?'needs-action':''}`.trim()}>
    <div className="pt-req-head"><b>{r.label}</b><Status>{r.state}</Status>{r.returned&&<span className="pt-flag">Needs correction</span>}</div>
    {r.needsAction&&<div className="pt-req-action">
      <Field label="Select document (details only)"><input type="file" onChange={event=>{const file=event.target.files?.[0];setDetails(file?{fileName:file.name,size:file.size}:{fileName:''})}}/></Field>
      <Button size="sm" onClick={()=>onProvide(r,details)}>Record Document Metadata</Button>
      <p className="pt-hint">No file is uploaded or stored. The clinic checks the document details; this is not approval from your HMO.</p>
    </div>}
    {r.state==='Provided'&&<p className="pt-hint">Recorded. The clinic will check this document.</p>}
  </li>
}

export function PatientHmoPage({ store, context }) {
  const { state, actions, toast }=store, session=store.session
  if(!patientContext(state,session))return NO_ACCOUNT
  const target=resolveTarget(state,session,'hmo',context)
  const cases=patientHmo(state,session)
  const provide=(caseId,requirement,details)=>{
    const result=actions.provideHmoRequirement(caseId,requirement.ruleId,details)
    toast(result.ok?'Document details recorded for the clinic to check.':result.message,result.ok?'success':'warning')
  }
  return <div className="pt-page">
    <PageHeader kicker="Your coverage" title="My HMO Coverage" text="The clinic tracks the documents for your HMO request and any response your provider sends back."/>
    <Notice tone="info">Checking your documents at the clinic is not approval from your HMO. Only a response from your provider counts as a provider decision.</Notice>
    <div className="pt-list">{cases.length?cases.map(h=>{
      const v=hmoCaseView(h), branch=state.branches.find(b=>b.id===h.branchId)?.name
      return <RecordCard key={h.id} id={`hmo-${h.id}`} highlight={target===h.id} title={v.provider} subtitle={branch?`Branch: ${branch}`:undefined} status={v.label}>
        <p className={`pt-stage-line ${v.escalated?'is-attention':''}`.trim()}>{v.stage}</p>
        <DefinitionList items={[
          {label:'Documents checked at the clinic',value:v.total?`${v.checked} of ${v.total}`:null},
          {label:'Submission',value:v.submittedAt?`Recorded ${formatStamp(v.submittedAt)}`:'Not yet submitted'},
          {label:'Provider response',value:v.respondedAt?`Recorded ${formatStamp(v.respondedAt)}`:'None recorded yet'},
          {label:'Clinic follow-up',value:v.escalated?'The clinic is following up':null},
        ]}/>
        {v.requirements.length>0&&<><h4>Documents</h4><ul className="pt-reqs">{v.requirements.map(r=><Requirement key={`${h.id}:${r.id}`} requirement={r} onProvide={(requirement,details)=>provide(h.id,requirement,details)}/>)}</ul></>}
      </RecordCard>
    }):<Empty title="No HMO case" text="You have no HMO case with the clinic yet."/>}</div>
  </div>
}
