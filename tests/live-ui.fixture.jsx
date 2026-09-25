import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ClinicProvider, useClinic } from '../src/store.jsx'
import { BookingPage } from '../src/pages/Scheduling.jsx'
import { BillingPage } from '../src/pages/FinanceCommunication.jsx'
import { setClockSource } from '../src/clock.js'
import { createWorkflowActions } from '../src/workflow.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import * as data from '../src/data.js'
import '../src/styles.css'
import '../src/foundation.css'
import '../src/patient.css'

setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
const screen=new URLSearchParams(location.search).get('screen')||'smart'
const dentistServices={}
for(const row of data.INITIAL_DENTIST_SERVICE_ASSIGNMENTS)(dentistServices[row.dentistId]??=[]).push(row.serviceId)
const referenceData={branches:data.INITIAL_BRANCHES,services:data.INITIAL_SERVICES,branchServices:data.INITIAL_BRANCH_SERVICES,staff:data.INITIAL_STAFF,dentists:data.INITIAL_DENTISTS.map(d=>({...d,serviceIds:dentistServices[d.id]||[]}))}

function seedPaidJourney() {
  if(localStorage.getItem('qa-live-seeded'))return
  let state=normalizeClinicState({
    persons:structuredClone(data.INITIAL_PERSONS),patients:structuredClone(data.INITIAL_PATIENTS),users:structuredClone(data.INITIAL_USERS),
    branches:structuredClone(data.INITIAL_BRANCHES),services:structuredClone(data.INITIAL_SERVICES),branchServices:structuredClone(data.INITIAL_BRANCH_SERVICES),
    dentists:structuredClone(data.INITIAL_DENTISTS),staff:structuredClone(data.INITIAL_STAFF),dentistServiceAssignments:structuredClone(data.INITIAL_DENTIST_SERVICE_ASSIGNMENTS),
    appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],followups:[],prescriptions:[],notifications:[],hmo:[],conversations:[],inquiries:[],workflowLog:[],audit:[],bookingDrafts:[],
  })
  let session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  const ok=result=>{if(!result.ok)throw new Error(result.message);return result.record}
  const appointment=ok(actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}))
  const queue=ok(actions.checkInAppointment(appointment.id))
  session=sessionForRole('dentist',state)
  ok(actions.updateQueue(queue.id,'Called'))
  ok(actions.saveTreatment({queueEntryId:queue.id}))
  const treatment=ok(actions.completeTreatment({queueEntryId:queue.id,procedure:'Dental Consultation',procedures:[{serviceId:'svc1',quantity:1}]}))
  session=sessionForRole('staff',state)
  const invoice=state.invoices.find(i=>i.treatmentId===treatment.id)
  ok(actions.reviewInvoice(invoice.id));ok(actions.issueInvoice(invoice.id))
  if(!['payment','payment-reload'].includes(screen))ok(actions.postPayment(invoice.id,'Cash',invoice.total))
  state.invoices.push(structuredClone(data.INITIAL_INVOICES[1])) // Existing Branch B fixture for scope verification.
  for(const key of ['appointments','queue','checkIns','treatments','invoices','patients','persons','users']){
    const storageKey=key==='checkIns'?'check-ins':key
    localStorage.setItem(`dentalops-v4-${storageKey}`,JSON.stringify(state[key]))
  }
  if(!['payment','payment-reload'].includes(screen))localStorage.setItem('qa-live-receipt',state.invoices.find(i=>i.id===invoice.id).receipt)
  localStorage.setItem('qa-live-seeded','1')
}
seedPaidJourney()

function Fixture() {
  const store=useClinic()
  const [role,setRole]=useState(['staff','payment'].includes(screen)?'staff':'patient')
  useEffect(()=>{store.setSession(role)},[role])
  if(!store.session)return <p>Opening test workspace…</p>
  return <div className={`role-${role}`}><main className="content" id="main-content">
    {['smart','manual','visual'].includes(screen)?<BookingPage role="patient" store={store} setPage={()=>{}}/>:<BillingPage role={role} store={store}/>}
    <button type="button" hidden onClick={()=>setRole(role==='staff'?'patient':'staff')}>Switch role</button>
  </main></div>
}
createRoot(document.getElementById('root')).render(<ClinicProvider initialReferenceData={referenceData}><Fixture/></ClinicProvider>)

const waitFor=async selector=>{
  for(let n=0;n<100;n++){
    const node=document.querySelector(selector)
    if(node)return node
    await new Promise(resolve=>setTimeout(resolve,50))
  }
  throw new Error(`Missing ${selector}`)
}
const click=async selector=>{const node=await waitFor(selector);node.click();await new Promise(resolve=>setTimeout(resolve,60));return node}
const check=(condition,message)=>{if(!condition)throw new Error(message)}
const result=(status,message)=>{
  const node=document.createElement('output');node.id='qa-result';node.dataset.status=status;node.textContent=`QA_${status}: ${message}`;document.body.append(node)
}
async function run() {
  await waitFor('.page-header')
  if(screen==='staff'){
    const rows=[...document.querySelectorAll('.billing-worklist-row')]
    check(rows.length===1,`expected one branch A row, got ${rows.length}`)
    check(!document.querySelector('.billing-worklist')?.textContent.includes('INV-2026-0002'),'Branch B invoice rendered')
    check(!document.querySelector('.billing-worklist-item').open,'details start expanded')
    rows[0].click()
    check(document.querySelector('.billing-worklist-item').open,'row did not expand')
    check(document.querySelector('.billing-worklist-detail').textContent.includes('Branch A'),'branch detail missing')
  }else if(screen==='receipt'||screen==='payment-reload'){
    const receipt=screen==='receipt'?localStorage.getItem('qa-live-receipt'):JSON.parse(localStorage.getItem('dentalops-v4-invoices')).find(i=>i.patientId==='p1'&&i.status==='Paid')?.receipt
    check(document.querySelector('.pt-list')?.textContent.includes(receipt),'paid transaction missing after load')
    check(!document.querySelector('.pt-receipt'),'receipt expanded before request')
    await click('button[aria-controls^="receipt-"]')
    const detail=await waitFor('.pt-receipt')
    for(const field of ['Dr. Dana E. Roxas Dental Clinic','Maria Santos','Dental Consultation','Amount paid','Cash','Completed',receipt])check(detail.textContent.includes(field),`receipt missing ${field}`)
  }else if(screen==='payment'){
    check(document.querySelector('.billing-worklist-row'),'issued invoice missing from Staff worklist')
    await click('.billing-worklist-row')
    await click('.billing-worklist-detail .btn')
    await click('.payment-options .btn:first-child')
    await waitFor('.billing-worklist-row .status.success')
    const persisted=JSON.parse(localStorage.getItem('dentalops-v4-invoices'))
    check(persisted.some(i=>i.patientId==='p1'&&i.status==='Paid'&&i.payment?.status==='Completed'),'confirmed payment was not persisted')
    await click('button[hidden]')
    await waitFor('.pt-list button[aria-controls^="receipt-"]')
    await click('.pt-list button[aria-controls^="receipt-"]')
    check(document.querySelector('.pt-receipt')?.textContent.includes('Amount paid'),'Patient receipt did not open after payment')
  }else{
    await click(screen==='manual'?'.pt-book-mode:not(.pt-book-mode-primary)':'.pt-book-mode-primary')
    await click('.pt-choice input[value="b1"]')
    await click('.pt-stage-footer .btn.primary')
    await click('.pt-choice input[value="svc1"]')
    await click('.pt-stage-footer .btn.primary')
    if(screen==='visual'){
      check(document.querySelectorAll('.pt-date-chip').length>=7,'date cards missing')
      check(document.querySelectorAll('.pt-time-slot').length>=2,'time buttons missing')
      result('PASS',screen)
      return
    }
    const cards=[...document.querySelectorAll('.pt-date-chip')]
    check(cards.length>=7,`only ${cards.length} date cards`)
    check(cards.every(card=>card.disabled||card.getAttribute('aria-checked')!==null),'date controls lack state semantics')
    const selectable=cards.filter(card=>!card.disabled)
    check(selectable.length>=2,'two available date choices missing')
    selectable[1].click()
    await new Promise(resolve=>setTimeout(resolve,60))
    check(selectable[1].getAttribute('aria-checked')==='true','selected date state missing')
    check(selectable[1].classList.contains('is-selected'),'selected date style hook missing')
    if(screen==='manual')await click('.pt-stage-footer .btn.primary')
    const times=[...document.querySelectorAll('.pt-time-slot')]
    check(times.length>=2,`only ${times.length} time buttons`)
    check(getComputedStyle(times[0]).paddingLeft!=='0px','time buttons have no padding')
    check(getComputedStyle(times[0].parentElement).gap!=='0px','time buttons have no gap')
    times[0].click()
    await new Promise(resolve=>setTimeout(resolve,60))
    check(document.querySelector('.pt-time-slot.is-selected[aria-pressed="true"]'),'selected time state missing')
    await click('.pt-stage-footer .btn.primary')
    await waitFor('.pt-choice input[value="card"]')
    await click('.pt-choice input[value="card"]')
    const review=await waitFor('.pt-dl')
    for(const field of ['Branch','Service','Date','Time','Payment Method'])check(review.textContent.includes(field),`review missing ${field}`)
    check(!document.body.textContent.includes('non-refundable'),'unsupported policy rendered')
    check(!(await waitFor('.pt-stage-footer .btn.primary')).disabled,'confirmation unexpectedly gated')
  }
  result('PASS',screen)
}
run().catch(error=>result('FAIL',`${screen}: ${error.message}`))
