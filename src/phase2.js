import { validSession, permitted, completedEncounter, paymentConsistent, isRecord } from './safeguards.js'
import { inScope } from './contracts.js'
import { uid } from './logic.js'

const fail=message=>({ok:false,message})
const clean=value=>String(value??'').trim()
const numericInput=value=>typeof value==='number'||typeof value==='string'&&!!value.trim()
export const money=value=>Math.round(Number(value)*100)/100
export function linkedTreatment(state, record) {
  const treatment=state.treatments.find(t=>t.id===record?.treatmentId)
  return treatment && state.patients.some(p=>p.id===treatment.patientId) &&
    record.patientId===treatment.patientId && ['dentistId','branchId'].every(k=>record[k]==null||record[k]===treatment[k]) ? treatment : null
}
export function visiblePrescriptions(state, session) {
  if(!validSession(state,session)||session.role==='dentist'&&!permitted(state,session,'prescriptions'))return []
  return state.prescriptions.filter(r=>inScope(r,session,state)&&linkedTreatment(state,r)&&(!Array.isArray(r.items)||completedEncounter(state,linkedTreatment(state,r))&&r.items.every(i=>i&&i.prescriptionId===r.id)&& (r.status!=='Authorized'||r.authorizedBy===state.dentists.find(d=>d.id===r.dentistId)?.userId))&&(session.role==='dentist'||session.role==='patient'&&r.status==='Authorized'))
}
export function visibleInvoices(state, session) {
  if(!validSession(state,session)||session.role==='staff'&&!permitted(state,session,'billing'))return []
  return state.invoices.filter(i=>inScope(i,session,state)&&(['staff','owner'].includes(session.role)||session.role==='patient'&&linkedTreatment(state,i)&&['Issued','Open','Paid'].includes(i.status)&&paymentConsistent(i)))
}
export function prescriptionTasks(state, session) {
  if(!permitted(state,session,'prescriptions'))return []
  return state.treatments.filter(t=>session?.role==='dentist'&&inScope(t,session,state)&&t.status==='Completed'&&t.prescriptionRequired===true&&!state.prescriptions.some(r=>r.treatmentId===t.id&&r.status==='Authorized'))
}

// Embedded child rows retain canonical foreign keys, while fees are encounter snapshots.
export function procedureLines(state, entry, treatmentId, input, current) {
  const source=input.procedures ?? (input.serviceId&&input.serviceId!==current?.serviceId?null:current?.procedures) ??
    (clean(input.procedure??current?.procedure)?[{serviceId:input.serviceId||current?.serviceId||entry.serviceId,quantity:1,notes:input.procedure??current?.procedure}]:[])
  if(!Array.isArray(source))return fail('Enter valid performed procedures.')
  const lines=[]
  for(const [index,row] of source.entries()){
    if(!isRecord(row)||row.treatmentId&&row.treatmentId!==treatmentId)return fail('Procedure belongs to another treatment.')
    const service=state.services.find(s=>s.id===row.serviceId&&s.status==='Active')
    const assignment=state.branchServices.find(b=>b.branchId===entry.branchId&&b.serviceId===row.serviceId&&b.active!==false)
    const configuredFee=assignment?.feeOverride??service?.baseFee
    const quantity=Number(row.quantity), unitFee=Number(configuredFee)
    if(!service||!assignment||!state.dentistServiceAssignments.some(a=>a.dentistId===entry.dentistId&&a.serviceId===row.serviceId&&a.isAuthorized!==false))return fail('Select an authorized performed procedure for this branch.')
    if(!numericInput(row.quantity)||!numericInput(configuredFee)||configuredFee==null||typeof configuredFee==='boolean'||typeof configuredFee==='string'&&!configuredFee.trim()||!Number.isSafeInteger(quantity)||quantity<=0||!Number.isFinite(unitFee)||unitFee<0||!Number.isSafeInteger(Math.round(unitFee*100)*quantity))return fail('Procedure quantity and configured fee must be valid.')
    lines.push({id:`${treatmentId}-procedure-${index+1}`,treatmentId,serviceId:service.id,quantity,unitFee:money(unitFee),amount:money(money(unitFee)*quantity),notes:clean(row.notes)})
  }
  if(!Number.isSafeInteger(lines.reduce((sum,p)=>sum+Math.round(p.amount*100),0)))return fail('Procedure total exceeds the supported amount.')
  return {ok:true,lines}
}

export function validInvoice(state, invoice) {
  const t=linkedTreatment(state,invoice)
  if(!t||t.status!=='Completed'||invoice.queueEntryId!==t.queueEntryId||invoice.appointmentId!==t.appointmentId||!Array.isArray(t.procedures)||!t.procedures.length||!Array.isArray(invoice.items)||invoice.items.length!==t.procedures.length)return false
  const queue=state.queue.find(q=>q.id===t.queueEntryId)
  const appointment=t.appointmentId?state.appointments.find(a=>a.id===t.appointmentId):null
  if(!queue||queue.status!=='Completed'||queue.treatmentId!==t.id||['patientId','dentistId','branchId','appointmentId'].some(k=>(queue[k]??null)!==(t[k]??null)))return false
  if(t.appointmentId&&(!appointment||appointment.status!=='Completed'||appointment.treatmentId!==t.id||['patientId','dentistId','branchId'].some(k=>appointment[k]!==t[k])))return false
  if(state.invoices.filter(i=>i.treatmentId===t.id).length!==1)return false
  const used=new Set()
  for(const item of invoice.items){
    if(!item)return false
    const p=t.procedures.find(p=>p?.id===item.procedureId)
    if(!p||p.treatmentId!==t.id||!state.services.some(s=>s.id===p.serviceId)||!Number.isSafeInteger(p.quantity)||p.quantity<=0||!Number.isFinite(p.unitFee)||p.unitFee<0||p.amount!==money(p.quantity*p.unitFee)||used.has(p.id)||item.invoiceId!==invoice.id||item.treatmentId!==t.id||item.serviceId!==p.serviceId||item.quantity!==p.quantity||item.unitFee!==p.unitFee||item.amount!==p.amount||!Number.isFinite(item.amount)||item.amount<0)return false
    used.add(p.id)
  }
  const total=money(invoice.items.reduce((sum,i)=>sum+i.amount,0))
  return Number.isFinite(total)&&total>=0&&invoice.subtotal===total&&invoice.total===total&&invoice.netAmount===total
}

export function phase2Actions(run) {
  const invoiceCommand=transition=>run(({state,session,now,event,notify},id,method,amount)=>{
    const invoice=state.invoices.find(i=>i.id===id)
    if(session.role!=='staff'||!invoice||!inScope(invoice,session,state))return fail('Only assigned Staff may operate this invoice.')
    if(!validInvoice(state,invoice)||!paymentConsistent(invoice))return fail('Invoice and completed procedure links need review before financial processing.')
    let record={...invoice}
    if(transition==='review'){
      if(invoice.status==='Review')return {ok:true,unchanged:true,record:invoice}
      if(invoice.status!=='Draft')return fail('Only draft invoices can enter review.')
      record={...record,status:'Review',reviewedAt:now.timestamp,reviewedBy:session.userId}
    }else if(transition==='issue'){
      if(['Issued','Paid'].includes(invoice.status))return {ok:true,unchanged:true,record:invoice}
      if(invoice.payment||invoice.paymentStatus!=='Unpaid')return fail('Invoice payment state needs review.')
      if(invoice.status!=='Review')return fail('Review the itemized invoice before issuance.')
      record={...record,status:'Issued',issuedAt:now.timestamp,issuedBy:session.userId}
      notify(`issued:${id}`,invoice.patientId,'Bill Available',`Your bill ${invoice.invoiceNo} is ready for payment.`)
    }else{
      if(!numericInput(amount)||!['Cash','Card','Electronic'].includes(method)||!Number.isFinite(Number(amount))||Number(amount)<=0||money(amount)!==Number(amount)||Number(amount)!==invoice.total)return fail('Record the exact full invoice amount using Cash or Card / Electronic.')
      if(invoice.status==='Paid'&&invoice.payment?.status==='Completed'&&invoice.payment.amount===invoice.total&&invoice.payment.invoiceId===id&&invoice.payment.patientId===invoice.patientId)return {ok:true,unchanged:true,record:invoice,receipt:invoice.receipt}
      if(invoice.status!=='Issued'||invoice.payment||invoice.paymentStatus!=='Unpaid')return fail('Only an issued, unpaid invoice can receive payment.')
      const paymentId=uid('pay'),receipt=`RCPT-${paymentId}`
      const payment={id:paymentId,invoiceId:id,patientId:invoice.patientId,branchId:invoice.branchId,amount:Number(amount),method,status:'Completed',simulation:method!=='Cash',recordedBy:session.userId,recordedAt:now.timestamp,receipt}
      record={...record,status:'Paid',paymentStatus:'Paid',method,paidAt:now.timestamp,payment,receipt}
      notify(`paid:${id}`,invoice.patientId,'Receipt Available',`Receipt ${receipt} is available${payment.simulation?' for your simulated payment':''}.`)
    }
    state.invoices=state.invoices.map(i=>i.id===id?record:i)
    event(`invoice:${transition}:${id}`,'M11',`billing.${transition}`,record.invoiceNo,record.patientId,record.branchId)
    return {ok:true,record,receipt:record.receipt}
  })
  const savePrescription=run(({state,session,now,event,notify},input={},authorize=false)=>{
    if(!isRecord(input))return fail('Select a valid prescription task.')
    const t=state.treatments.find(t=>t.id===input.treatmentId)
    if(session.role!=='dentist'||!t||!inScope(t,session,state)||!state.patients.some(p=>p.id===t.patientId)||!completedEncounter(state,t)||t.prescriptionRequired!==true)return fail('Only the treating Dentist can document a requested prescription.')
    if(['patientId','dentistId','branchId'].some(k=>input[k]!=null&&input[k]!==t[k]))return fail('Prescription context does not match treatment.')
    const matches=state.prescriptions.filter(r=>r.treatmentId===t.id),current=matches[0]
    if(matches.length>1||current&&!linkedTreatment(state,current)||input.id&&input.id!==current?.id)return fail('Prescription linkage needs review.')
    if(current?.status==='Authorized')return {ok:true,unchanged:true,record:current}
    if(current&&current.dentistId!==t.dentistId)return fail('Prescription Dentist does not match treatment.')
    if(current&&input.revision!=null&&input.revision!==current.revision)return fail('This prescription draft changed. Reopen it before saving.')
    const source=input.items??current?.items??[]
    if(!Array.isArray(source)||source.some(r=>!isRecord(r)||r.prescriptionId&&r.prescriptionId!==current?.id))return fail('Enter valid medication items for this prescription.')
    if(source.some(r=>['medication','dosage','instructions','duration'].some(k=>r[k]!=null&&typeof r[k]!=='string')))return fail('Medication fields must contain text entered by the Dentist.')
    const id=current?.id||uid('rx')
    const items=source.map((r,index)=>({id:`${id}-item-${index+1}`,prescriptionId:id,medication:clean(r?.medication),dosage:clean(r?.dosage),instructions:clean(r?.instructions),duration:clean(r?.duration)}))
    if(authorize&&(!items.length||items.some(r=>!r.medication||!r.dosage||!r.instructions)))return fail('Medication, dosage, and instructions are required for every item.')
    const record={id,treatmentId:t.id,patientId:t.patientId,dentistId:t.dentistId,branchId:t.branchId,items,status:authorize?'Authorized':'Draft',version:1,updatedAt:now.timestamp,authorizedAt:authorize?now.timestamp:null,authorizedBy:authorize?session.userId:null,revision:(current?.revision||0)+1}
    if(current&&current.status===record.status&&JSON.stringify(current.items)===JSON.stringify(items))return {ok:true,unchanged:true,record:current}
    state.prescriptions=current?state.prescriptions.map(r=>r.id===id?record:r):[record,...state.prescriptions]
    event(`prescription:${id}:${record.revision}`,'M19',authorize?'prescription.authorized':'prescription.draft.saved',id,t.patientId,t.branchId)
    if(authorize)notify(`rx-authorized:${id}`,t.patientId,'Prescription Available','Your dentist has authorized your prescription.')
    return {ok:true,record}
  })
  return {reviewInvoice:invoiceCommand('review'),issueInvoice:invoiceCommand('issue'),postPayment:invoiceCommand('payment'),savePrescription,authorizePrescription:input=>savePrescription(input,true)}
}

// Safe display/recovery for persisted follow-ups whose cancellation predates reconciliation.
export function followupDisplayState(state,f) {
  const t=linkedTreatment(state,f)
  if(!t||t.status!=='Completed'||t.followupRequired!==true)return 'Needs clinic review'
  if(!f.appointmentId)return f.status==='Open'?'Open':'Needs clinic review'
  const a=state.appointments.find(a=>a.id===f.appointmentId)
  if(!a||['patientId','dentistId','branchId'].some(k=>a[k]!==f[k]))return 'Needs clinic review'
  if(['Cancelled','No-show'].includes(a.status))return 'Open'
  if(a.status==='Completed')return 'Completed'
  return f.status==='Scheduled'?'Scheduled':'Needs clinic review'
}
