import { isRecord, validTime } from './safeguards.js'
import { validDate } from './clock.js'
import { uid } from './logic.js'

// Booking Drafts (Phase 4B.3C-1). BOOKING DRAFT != APPOINTMENT: a draft reserves no slot, consumes no Dentist
// capacity, creates no queue entry and no appointment number, and appears in no Staff/Dentist operational view —
// it is a Patient-only scratch record of in-progress booking-wizard choices. Exactly one draft per Patient. It
// never stores a committed Dentist selection (Dentist is always recomputed by the scheduling domain at Review/
// confirm time), no payment preference and no referral code — those are explicitly out of scope for this pass.
const fail=message=>({ok:false,message})
const clean=value=>typeof value==='string'?value.trim():''
const MODES=['smart','manual']
const FIELDS=['mode','branchId','serviceId','date','start']

// The only fields a draft save may ever contain. Anything else fails the whole request closed, the same
// allowlist discipline `registration.js` already established for a public boundary.
function sanitizePatch(patch) {
  if(!isRecord(patch)||Object.keys(patch).some(key=>!FIELDS.includes(key)))return null
  const out={}
  if('mode' in patch){if(patch.mode!=null&&!MODES.includes(patch.mode))return null;out.mode=patch.mode||null}
  if('branchId' in patch){if(patch.branchId!=null&&typeof patch.branchId!=='string')return null;out.branchId=patch.branchId||null}
  if('serviceId' in patch){if(patch.serviceId!=null&&typeof patch.serviceId!=='string')return null;out.serviceId=patch.serviceId||null}
  if('date' in patch){if(patch.date&&!validDate(patch.date))return null;out.date=patch.date||null}
  if('start' in patch){if(patch.start&&!validTime(patch.start))return null;out.start=patch.start||null}
  return out
}

export function bookingDraftActions(run) {
  // Patient identity is derived only from the validated session; a Patient can never name another patientId.
  const saveBookingDraft=run(({state,session,now},patch={},commandId)=>{
    if(session.role!=='patient')return fail('Only a Patient can save a booking draft.')
    const id=clean(commandId)
    if(!id)return fail('A draft save command ID is required.')
    const sanitized=sanitizePatch(patch)
    if(!sanitized)return fail('Enter valid booking progress.')
    const existing=(state.bookingDrafts||[]).find(d=>d.patientId===session.patientId)
    const next={mode:existing?.mode??null,branchId:existing?.branchId??null,serviceId:existing?.serviceId??null,date:existing?.date??null,start:existing?.start??null,...sanitized}
    if(existing&&FIELDS.every(key=>existing[key]===next[key]))return {ok:true,unchanged:true,record:existing}
    const record={id:existing?.id||uid('draft'),patientId:session.patientId,...next,revision:(existing?.revision||0)+1,updatedAt:now.timestamp}
    state.bookingDrafts=existing?(state.bookingDrafts||[]).map(d=>d.id===existing.id?record:d):[record,...(state.bookingDrafts||[])]
    return {ok:true,record}
  },{name:'booking.draft.save',module:'M6'})

  const discardBookingDraft=run(({state,session},commandId)=>{
    if(session.role!=='patient')return fail('Only a Patient can discard their own booking draft.')
    const id=clean(commandId)
    if(!id)return fail('A discard command ID is required.')
    const existing=(state.bookingDrafts||[]).find(d=>d.patientId===session.patientId)
    if(!existing)return {ok:true,unchanged:true}
    state.bookingDrafts=(state.bookingDrafts||[]).filter(d=>d.id!==existing.id)
    return {ok:true}
  },{name:'booking.draft.discard',module:'M6'})

  return {saveBookingDraft,discardBookingDraft}
}
