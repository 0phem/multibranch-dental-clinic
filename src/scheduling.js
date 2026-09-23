import { isRecord } from './safeguards.js'
import { TERMINAL } from './contracts.js'
import { availableSlots, validateAppointment } from './logic.js'
import { clinicNow, addDays, validDate } from './clock.js'

// Scheduling domain (Phase 4B.3B): deterministic automatic Dentist assignment and open-time search underneath the
// future Patient booking redesign. No AI, no randomness, no invented workload scores, no first-array-entry fallback.
// Every function here is pure and reuses the exact authoritative rules the current booking wizard already uses
// (`validateAppointment`, `availableSlots`) rather than inventing a second, incompatible eligibility system.

// A stable technical identifier for the assignment rule version, recorded on auto-assigned appointments/events so a
// later rule change is never silently attributed to an earlier one. Not a clinic-policy version number.
export const SCHEDULING_RULE_VERSION = 'dentist-assignment-v1'

// findOpenTimes' technical search horizon/result cap. 14 days is a scheduling-search default, not a clinic
// booking-limit policy (P1-P9 remain unresolved); a later caller may search a different window.
export const FIND_TIME_DEFAULT_WINDOW_DAYS = 14
export const FIND_TIME_DEFAULT_RESULT_LIMIT = 10

const activeAccount=(state,dentist)=>{const user=state.users.find(u=>u.id===dentist.userId);return !!user&&(user.accountStatus||user.status)==='Active'}

// ---- Eligibility pool --------------------------------------------------------------------------------------
// Configured-service + branch-assignment + active-account eligibility. Relocated here unchanged from its prior
// Patient-view home so the scheduling domain and the booking wizard share exactly one eligibility pool; re-exported
// from `patient-view.js` for existing callers.
export const servicesAt=(state,branchId)=>{
  const offered=new Set(state.branchServices.filter(bs=>bs.branchId===branchId&&bs.active!==false).map(bs=>bs.serviceId))
  return state.services.filter(s=>s.status==='Active'&&offered.has(s.id))
}
export const dentistsFor=(state,branchId,serviceId)=>{
  const allowed=new Set(state.dentistServiceAssignments.filter(a=>a.serviceId===serviceId&&a.isAuthorized!==false).map(a=>a.dentistId))
  return state.dentists.filter(d=>d.branchIds?.includes(branchId)&&d.available&&allowed.has(d.id)&&activeAccount(state,d))
}

// Total minutes of this Dentist's legitimately-scheduled (non-terminal) appointments on the given date. TERMINAL
// (Completed/Cancelled/No-show) is the same canonical status list every other command already uses; those never
// occupy capacity, so they never inflate workload. A different date never contributes.
function bookedMinutes(state,dentistId,date,ignoreId=null) {
  return state.appointments
    .filter(a=>a.dentistId===dentistId&&a.date===date&&a.id!==ignoreId&&!TERMINAL.includes(a.status))
    .reduce((total,a)=>total+Number(a.duration||0),0)
}

// ---- Automatic Dentist assignment --------------------------------------------------------------------------
// "For this Patient, branch, service, date and time, which Dentist may legitimately perform this appointment?"
// A candidate is eligible only when it passes the exact same authoritative validator every manual booking already
// uses (branch/service/shift/hours/overlap/Patient-conflict; the M15 branch-load estimate is never consulted).
// Eligible candidates are ranked by fewest legitimately booked minutes on the requested date, tied by ascending canonical
// Dentist ID, so identical state + identical input always produces the identical Dentist regardless of array order.
// Zero eligible Dentist is an explicit `{ok:false}` result, never an exception and never a fallback to any Dentist.
export function assignDentist(state,form,now=clinicNow(),ignoreId=null) {
  const empty={ok:false,dentist:null,dentistId:null,candidates:[],reason:'Enter valid appointment details.'}
  if(!isRecord(form)||!form.branchId||!form.serviceId||!form.date||!form.start)return empty
  const pool=dentistsFor(state,form.branchId,form.serviceId)
  const scored=pool
    .map(dentist=>({dentist,valid:validateAppointment({...form,dentistId:dentist.id},state,ignoreId,now,false).valid,minutes:bookedMinutes(state,dentist.id,form.date,ignoreId)}))
    .filter(candidate=>candidate.valid)
    .sort((a,b)=>a.minutes-b.minutes||String(a.dentist.id).localeCompare(String(b.dentist.id)))
  const candidates=scored.map(c=>({dentistId:c.dentist.id,minutes:c.minutes}))
  if(!scored.length)return {ok:false,dentist:null,dentistId:null,candidates,reason:'No Dentist is currently eligible for this branch, service and time.'}
  const winner=scored[0].dentist
  return {ok:true,dentist:winner,dentistId:winner.id,candidates,reason:''}
}

// ---- Find open times ----------------------------------------------------------------------------------------
// Deterministic scheduling search, not AI: inspects legitimate dates in chronological order within a technical
// window, reusing the exact slot-interval rule `availableSlots` already owns (no new arbitrary interval), and only
// returns a date/time that has at least one legitimately eligible Dentist. Every returned slot carries the
// deterministic assignment that would provisionally apply right now; a later authoritative confirmation always
// recomputes it rather than trusting this result (see `confirmation_semantics` in PHASE4B3_ONBOARDING_BOOKING.md).
export function findOpenTimes(state,form,{startDate=null,windowDays=FIND_TIME_DEFAULT_WINDOW_DAYS,limit=FIND_TIME_DEFAULT_RESULT_LIMIT,now=clinicNow(),ignoreId=null}={}) {
  if(!isRecord(form)||!form.branchId||!form.serviceId)return []
  const from=validDate(startDate)&&startDate>=now.date?startDate:now.date
  const pool=dentistsFor(state,form.branchId,form.serviceId)
  if(!pool.length)return []
  const results=[]
  for(let offset=0;offset<windowDays&&results.length<limit;offset++){
    const date=addDays(from,offset)
    const times=new Set()
    for(const dentist of pool)for(const start of availableSlots({...form,date,dentistId:dentist.id},state,ignoreId,now))times.add(start)
    for(const start of [...times].sort()){
      if(results.length>=limit)break
      const assignment=assignDentist(state,{...form,date,start},now,ignoreId)
      if(assignment.ok)results.push({date,start,dentistId:assignment.dentistId,dentist:assignment.dentist.name})
    }
  }
  return results
}
