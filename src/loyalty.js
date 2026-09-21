import { isRecord, permitted } from './safeguards.js'
import { patientInScope } from './contracts.js'
import { uid } from './logic.js'

// M24 Referral & Loyalty — an approved frontend enhancement. Every rule below is a TEAM-DESIGNED PROTOTYPE rule,
// approved for demonstration, and none is an established Dr. Dana clinic policy: the 50-point redemption threshold,
// one Pending request at a time, each request processed once, the same-day duplicate-reward check, whole positive
// points as the input validation rule, and the `DANA-<FIRST>-NN` referral-code format (a technical convention). An
// account is established by recording a Patient's first qualified activity (as in the earlier frontend). No monetary
// value, discount, service, tier, expiry or referral-qualification timing is defined here or anywhere else in the app.
export const LOYALTY_PROGRAM=Object.freeze({redemptionThreshold:50})

export const QUALIFIED_ACTIVITIES=['Qualified Visit','Qualified Referral']
const EARNING=[...QUALIFIED_ACTIVITIES,'Referral Reward']
const REQUEST='Redemption Request', REDEMPTION='Redemption'
export const LOYALTY_REVIEW_MESSAGE='Your loyalty activity needs clinic review.'
export const needMoreMessage=missing=>`You need ${missing} more ${missing===1?'point':'points'} to request a reward.`

const fail=message=>({ok:false,message})
const clean=value=>typeof value==='string'?value.trim():''
const commandIdOf=value=>{const id=clean(value);return id&&id.length<=200?id:''}
const isPending=entry=>entry.type===REQUEST&&entry.status==='Pending'

// The ledger is the source of truth for the balance. A stored balance that disagrees with it is never
// repaired silently: the account is reported as needing clinic review and every mutation is blocked.
// Legacy entries (no id, no commandId) stay valid.
export function ledgerIssue(account) {
  if(!isRecord(account)||!clean(account.id)||!clean(account.patientId)||!clean(account.referralCode))return 'malformed'
  if(!Array.isArray(account.history))return 'history'
  if(!Number.isSafeInteger(account.points)||account.points<0)return 'balance'
  let sum=0,pending=0
  const ids=new Set()
  for(const entry of account.history){
    if(!isRecord(entry)||!Number.isSafeInteger(entry.points)||!clean(entry.at))return 'entry'
    if(entry.id!==undefined){if(!clean(entry.id)||ids.has(entry.id))return 'entry';ids.add(entry.id)}
    if(entry.commandId!==undefined&&!clean(entry.commandId))return 'entry'
    if(EARNING.includes(entry.type)){if(entry.points<=0)return 'entry'}
    else if(entry.type===REQUEST){if(entry.points!==0||!['Pending','Processed'].includes(entry.status))return 'entry';if(isPending(entry))pending++}
    else if(entry.type===REDEMPTION){if(entry.points>=0||entry.status!=='Processed')return 'entry'}
    else return 'entry'
    sum+=entry.points
    if(!Number.isSafeInteger(sum))return 'balance'
  }
  if(sum!==account.points)return 'balance'
  return pending>1?'pending':null
}

// Every account row belonging to a Patient. `null` means the collection itself is unusable.
export function accountsOf(state,patientId) {
  return Array.isArray(state.loyalty)?state.loyalty.filter(l=>isRecord(l)&&l.patientId===patientId):null
}
function soleAccount(state,patientId) {
  const rows=accountsOf(state,patientId)
  if(!rows)return {error:LOYALTY_REVIEW_MESSAGE}
  if(!rows.length)return {none:true}
  if(rows.length>1||state.loyalty.filter(l=>isRecord(l)&&l.id===rows[0].id).length!==1)return {error:LOYALTY_REVIEW_MESSAGE}
  return {account:rows[0]}
}

// Only authorized Staff and the Owner may change loyalty activity. `permitted` alone is not enough:
// it also returns true for any Patient session.
function managerIssue(state,session,patientId) {
  if(!['staff','owner'].includes(session.role)||!permitted(state,session,'engagement'))return 'Only authorized clinic staff can manage loyalty activity.'
  const patient=state.patients.find(p=>p.id===patientId)
  if(!patient)return 'Patient not found.'
  if(session.role==='staff'&&session.branchId&&!patientInScope(patient,state,session))return 'This Patient is outside your branch scope.'
  return null
}
export const canManageLoyalty=(state,session,patientId)=>!managerIssue(state,session,patientId)

function referralCode(state,patient) {
  const base=String(patient.firstName||'').normalize('NFD').replace(/[^A-Za-z0-9]/g,'').toUpperCase()||'PATIENT'
  const used=new Set(state.loyalty.map(l=>l?.referralCode))
  for(let n=1;n<1000;n++){const code=`DANA-${base}-${String(n).padStart(2,'0')}`;if(!used.has(code))return code}
  return null
}
const foreignCommand=(state,account,commandId)=>state.loyalty.some(l=>l!==account&&isRecord(l)&&Array.isArray(l.history)&&l.history.some(e=>e?.commandId===commandId))
const replace=(state,previous,record)=>{state.loyalty=previous?state.loyalty.map(l=>l===previous?record:l):[record,...state.loyalty]}

export function loyaltyActions(run) {
  // The Patient never names an account or a Patient: identity comes from the validated session.
  const requestLoyaltyRedemption=run(({state,session,now,event},commandId,...extra)=>{
    if(session.role!=='patient')return fail('Only a Patient can request their own reward.')
    const id=commandIdOf(commandId)
    if(!id||extra.length)return fail('Enter a valid reward request command ID.')
    const found=soleAccount(state,session.patientId)
    if(found.none)return fail('No loyalty account is available for your record.')
    if(found.error)return fail(found.error)
    const {account}=found
    if(ledgerIssue(account))return fail(LOYALTY_REVIEW_MESSAGE)
    if(foreignCommand(state,account,id))return fail('This command ID belongs to another loyalty record.')
    const previous=account.history.find(e=>e.commandId===id)
    if(previous)return previous.type===REQUEST?{ok:true,unchanged:true,record:account}:fail('This command ID was already used for a different loyalty action.')
    if(account.history.some(isPending))return fail('A reward request is already awaiting clinic processing.')
    const {redemptionThreshold:threshold}=LOYALTY_PROGRAM
    if(account.points<threshold)return fail(needMoreMessage(threshold-account.points))
    const entry={id:uid('lh'),commandId:id,at:now.date,type:REQUEST,detail:`${threshold}-point reward requested`,points:0,status:'Pending',requestedAt:now.timestamp}
    const record={...account,history:[entry,...account.history]}
    replace(state,account,record)
    const patient=state.patients.find(p=>p.id===session.patientId)
    event(`loyalty:request:${id}`,'M24','loyalty.redemption.requested','Loyalty reward requested',session.patientId,patient?.preferredBranchId||null,{entityType:'loyalty',entityId:account.id,loyaltyAccountId:account.id})
    return {ok:true,record}
  },{name:'loyalty.redemption.request',module:'M24'})

  const recordLoyaltyActivity=run(({state,session,now,event},input,commandId,...extra)=>{
    if(!isRecord(input)||extra.length)return fail('Enter valid loyalty activity details.')
    const {patientId,activity,points}=input, id=commandIdOf(commandId)
    if(typeof patientId!=='string'||!QUALIFIED_ACTIVITIES.includes(activity)||!id)return fail('Select a Patient, a qualified activity and a command ID.')
    const denied=managerIssue(state,session,patientId)
    if(denied)return fail(denied)
    if(!Number.isSafeInteger(points)||points<=0)return fail('Enter a positive whole number of points.')
    const found=soleAccount(state,patientId)
    if(found.error)return fail('This loyalty account needs review before it can change.')
    const account=found.account||null
    if(account&&ledgerIssue(account))return fail('This loyalty account needs review before it can change.')
    if(foreignCommand(state,account,id))return fail('This command ID belongs to another loyalty record.')
    const previous=account?.history.find(e=>e.commandId===id)
    if(previous)return EARNING.includes(previous.type)&&previous.type===activity&&previous.points===points?{ok:true,unchanged:true,record:account}:fail('This command ID was already used for a different loyalty action.')
    if(account&&account.history.some(e=>e.at===now.date&&e.type===activity&&e.points===points))return fail('Duplicate reward prevented by the configured reward rule.')
    if(account&&!Number.isSafeInteger(account.points+points))return fail('That points value is too large.')
    const entry={id:uid('lh'),commandId:id,at:now.date,type:activity,detail:'Verified by the clinic',points,recordedByUserId:session.userId}
    let record
    if(account)record={...account,points:account.points+points,history:[entry,...account.history]}
    else{
      const patient=state.patients.find(p=>p.id===patientId), code=referralCode(state,patient)
      if(!code)return fail('A referral code could not be assigned. Ask an administrator to review.')
      record={id:uid('loy'),patientId,referralCode:code,points,history:[entry]}
    }
    replace(state,account,record)
    const patient=state.patients.find(p=>p.id===patientId)
    event(`loyalty:activity:${id}`,'M24','loyalty.activity.recorded',`${activity} recorded (+${points})`,patientId,patient?.preferredBranchId||null,{entityType:'loyalty',entityId:record.id,loyaltyAccountId:record.id})
    return {ok:true,record}
  },{name:'loyalty.activity.record',module:'M24'})

  const processLoyaltyRedemption=run(({state,session,now,event},accountId,commandId,...extra)=>{
    const id=commandIdOf(commandId)
    if(typeof accountId!=='string'||!id||extra.length)return fail('Select a loyalty account and a command ID.')
    const matches=Array.isArray(state.loyalty)?state.loyalty.filter(l=>isRecord(l)&&l.id===accountId):[]
    if(matches.length!==1)return fail('Loyalty account not found.')
    const account=matches[0], denied=managerIssue(state,session,account.patientId)
    if(denied)return fail(denied)
    if(ledgerIssue(account)||accountsOf(state,account.patientId).length!==1)return fail('This loyalty account needs review before it can change.')
    if(foreignCommand(state,account,id))return fail('This command ID belongs to another loyalty record.')
    const previous=account.history.find(e=>e.commandId===id)
    if(previous)return previous.type===REDEMPTION?{ok:true,unchanged:true,record:account}:fail('This command ID was already used for a different loyalty action.')
    const pending=account.history.find(isPending)
    if(!pending)return fail('There is no pending redemption request to process.')
    const {redemptionThreshold:threshold}=LOYALTY_PROGRAM
    if(account.points<threshold)return fail(`The Patient does not have the ${threshold} points required for this reward.`)
    const entry={id:uid('lh'),commandId:id,at:now.date,type:REDEMPTION,detail:`${threshold}-point reward redeemed`,points:-threshold,status:'Processed',processedAt:now.timestamp,processedByUserId:session.userId}
    const record={...account,points:account.points-threshold,history:[entry,...account.history.map(e=>e===pending?{...e,status:'Processed',processedAt:now.timestamp,processedByUserId:session.userId}:e)]}
    replace(state,account,record)
    const patient=state.patients.find(p=>p.id===account.patientId)
    event(`loyalty:process:${id}`,'M24','loyalty.redemption.processed','Loyalty reward processed',account.patientId,patient?.preferredBranchId||null,{entityType:'loyalty',entityId:account.id,loyaltyAccountId:account.id})
    return {ok:true,record}
  },{name:'loyalty.redemption.process',module:'M24'})

  return {requestLoyaltyRedemption,recordLoyaltyActivity,processLoyaltyRedemption}
}
