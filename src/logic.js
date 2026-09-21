import { validTime, isRecord } from './safeguards.js'
import { SERVICES } from './data.js'
import { clinicNow, clinicDate, validDate } from './clock.js'
import { TERMINAL, isTodayQueue, isWaitingQueue } from './contracts.js'

export const uid = (prefix='id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
export const peso = new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP', maximumFractionDigits:0 })

export const patientName = (patientId, patients) => patients.find(p=>p.id===patientId)?.name || patientId
export const dentistName = (dentistId, dentists) => dentists.find(d=>d.id===dentistId)?.name || dentistId
export const serviceInfo = (idOrName, services=SERVICES) => services.find(s=>s.id===idOrName||s.name===idOrName) || { id:null, name:idOrName||'Unknown service', duration:30, baseFee:0, category:'General Dentistry', status:'Active' }

export function toMinutes(value='00:00') {
  if (typeof value!=='string') return NaN
  if (!value) return 0
  if (/^\d{2}:\d{2}$/.test(value)) {
    const [h,m]=value.split(':').map(Number); return h*60+m
  }
  const match=value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!match) return 0
  let h=Number(match[1]); const m=Number(match[2]); const ap=match[3].toUpperCase()
  if (ap==='PM' && h!==12) h+=12
  if (ap==='AM' && h===12) h=0
  return h*60+m
}

export function displayTime(value='') {
  if (!value) return '—'
  const [hRaw,m='00']=value.split(':').map(Number)
  const h=((hRaw+11)%12)+1
  const ap=hRaw>=12?'PM':'AM'
  return `${h}:${String(m).padStart(2,'0')} ${ap}`
}

export function addMinutes(time, mins) {
  const total=toMinutes(time)+Number(mins||0)
  const h=Math.floor(total/60)%24, m=total%60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

export const dateLabel = date => {
  if (!date) return '—'
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-PH',{month:'short',day:'numeric',year:'numeric'})
}

export function statusTone(value='') {
  const s=String(value).toLowerCase()
  if (['paid','approved','confirmed','authorized','active','available','open','success','delivered','verified'].some(x=>s===x)) return 'success'
  if (['pending','waiting','scheduled','draft','called','treatment ready'].some(x=>s.includes(x))) return 'warning'
  if (['cancel','failed','missing','rejected','overload','no-show','inactive','unavailable','conflict','escalat'].some(x=>s.includes(x))) return 'danger'
  if (['complete','closed','responded','returned'].some(x=>s.includes(x))) return 'info'
  return 'neutral'
}

export function overlap(startA, durationA, startB, durationB) {
  const a1=toMinutes(startA), a2=a1+Number(durationA||0)
  const b1=toMinutes(startB), b2=b1+Number(durationB||0)
  return a1 < b2 && b1 < a2
}

export function validateAppointment(form, state, ignoreId=null, now=clinicNow(), suggest=true) {
  form=isRecord(form)?form:{}
  const branch=state.branches.find(b=>form.branchId?b.id===form.branchId:b.name===form.branch)
  const dentist=state.dentists.find(d=>d.id===form.dentistId)
  const service=state.services.find(s=>s.id===form.serviceId)
  const patient=state.patients.find(p=>p.id===form.patientId)
  const assignment=state.branchServices.find(bs=>bs.branchId===branch?.id&&bs.serviceId===service?.id&&bs.active!==false)
  const duration=Number(assignment?.durationOverride??service?.duration)
  const start=toMinutes(form.start), end=start+duration
  const checks=[]
  const check=(key,label,ok,detail=label)=>checks.push({key,label,ok:!!ok,detail})
  check('patient','Patient exists',patient)
  check('branch-status','Branch is open',branch&&branch.status==='Open')
  check('service-exists','Service is active',service&&service.status==='Active')
  check('service','Service available at branch',assignment)
  check('dentist','Dentist exists',dentist)
  check('dentist-branch','Dentist assigned to branch',dentist?.branchIds?.includes(branch?.id) || (!dentist?.branchIds&&dentist?.branches?.includes(branch?.name)))
  check('dentist-service','Dentist can perform selected service',state.dentistServiceAssignments.some(a=>a.dentistId===dentist?.id&&a.serviceId===service?.id&&a.isAuthorized!==false))
  const account=state.users?.find(u=>u.id===dentist?.userId)
  check('dentist-active','Dentist currently available',dentist?.available&&account&&(account.accountStatus||account.status)==='Active')
  check('date','Date is not in the past',validDate(form.date)&&form.date>=now.date)
  check('time','Valid future start time',validTime(form.start)&&(form.date!==now.date||form.start>now.time))
  check('duration','Valid service duration',Number.isFinite(duration)&&duration>0)
  check('branch-hours','Within branch operating hours',branch&&validTime(branch.open)&&validTime(branch.close)&&start>=toMinutes(branch.open)&&end<=toMinutes(branch.close))
  check('dentist-shift','Within dentist shift',dentist&&validTime(dentist.shiftStart)&&validTime(dentist.shiftEnd)&&start>=toMinutes(dentist.shiftStart)&&end<=toMinutes(dentist.shiftEnd))
  const overlaps=state.appointments.filter(a=>a.id!==ignoreId&&!TERMINAL.includes(a.status)&&a.date===form.date&&overlap(form.start,duration,a.start,a.duration))
  const conflict=overlaps.find(a=>a.dentistId===form.dentistId)
  check('overlap','No overlapping dentist appointment',!conflict)
  check('patient-overlap','No overlapping patient appointment',!overlaps.some(a=>a.patientId===form.patientId))
  const valid=checks.every(c=>c.ok)
  const alternatives=[]
  if(suggest&&!valid&&branch&&dentist&&duration>0){
    for(let minute=Math.max(toMinutes(branch.open),toMinutes(dentist.shiftStart));minute+duration<=Math.min(toMinutes(branch.close),toMinutes(dentist.shiftEnd));minute+=30){
      const time=addMinutes('00:00',minute)
      if(validateAppointment({...form,start:time},state,ignoreId,now,false).valid) alternatives.push(time)
      if(alternatives.length===5)break
    }
  }
  return {valid,checks,alternatives,duration,conflict,service,branch}
}

export function availableSlots(form,state,ignoreId=null,now=clinicNow()) {
  const branch=state.branches.find(b=>b.id===form.branchId)
  if(!branch)return []
  const slots=[]
  for(let minute=toMinutes(branch.open);minute<toMinutes(branch.close);minute+=30){
    const start=addMinutes('00:00',minute)
    if(validateAppointment({...form,start},state,ignoreId,now,false).valid)slots.push(start)
  }
  return slots
}

export function recalcQueue(queue) {
  const priorityRank={Urgent:0,Priority:1,Normal:2}
  const groups={}
  queue.forEach(q=>{
    if (!isWaitingQueue(q) || !q.clinicDate) return
    const key=`${q.clinicDate}|${q.branchId}|${q.dentistId}`
    groups[key] ||= []
    groups[key].push(q)
  })
  Object.values(groups).forEach(list=>list.sort((a,b)=>(a.status==='In Treatment'?-1:0)-(b.status==='In Treatment'?-1:0) || (priorityRank[a.priority]??2)-(priorityRank[b.priority]??2) || toMinutes(a.checkedIn)-toMinutes(b.checkedIn)))
  const positions={}
  Object.entries(groups).forEach(([key,list])=>list.forEach((q,i)=>positions[q.id]=i+1))
  return queue.map(q=>({...q,position:positions[q.id]||null}))
}

export function queueWaitEstimate(entry, queue, appointments, treatments, dentists) {
  if (!isWaitingQueue(entry) || !isTodayQueue(entry) || entry.status==='In Treatment') return 0
  const same=queue.filter(q=>q.branchId===entry.branchId && q.clinicDate===entry.clinicDate && q.dentistId===entry.dentistId && isWaitingQueue(q))
  const ahead=same.filter(q=>(q.position||99)<(entry.position||99)).length
  const avgDuration=appointments.filter(a=>a.dentistId===entry.dentistId && a.date===clinicDate() && a.status!=='Cancelled').map(a=>a.duration||30)
  const typical=avgDuration.length ? Math.round(avgDuration.reduce((a,b)=>a+b,0)/avgDuration.length) : 30
  const active=treatments.some(t=>t.dentistId===entry.dentistId && t.date===clinicDate() && t.status==='In Treatment') ? Math.round(typical*.55) : 0
  const dentistAvailable=dentists.find(d=>d.id===entry.dentistId)?.available !== false
  return dentistAvailable ? Math.max(5, active + ahead*typical) : Math.max(30,(ahead+1)*typical)
}

export function branchCapacity(branchName, state) {
  const dentists=(state.dentists||[]).filter(d=>d.available && d.branches.includes(branchName))
  const activeDentists=dentists.length
  const divisor=Math.max(1,activeDentists)
  const queue=(state.queue||[]).filter(q=>q.branch===branchName && isTodayQueue(q) && isWaitingQueue(q))
  const waiting=queue.filter(q=>q.status==='Waiting').length
  const ready=queue.filter(q=>['Called','Treatment Ready'].includes(q.status)).length
  const booked=(state.appointments||[]).filter(a=>a.branch===branchName && a.date===clinicDate() && a.status!=='Cancelled').length
  const branch=(state.branches||[]).find(b=>b.name===branchName)
  const workload=Math.min(140, Math.round(((waiting*1.2+ready*1.4+booked*.65)/(divisor*4))*100))
  const estimate=Math.max(0,Math.round((waiting/divisor)*22 + ready*8))
  const threshold=branch?.threshold ?? 80
  return { branch:branchName, activeDentists, waiting, ready, booked, workload, estimate, threshold, overloaded: workload>=threshold || estimate>=35 }
}

export function nextAppointment(patientId, appointments) {
  return appointments.filter(a=>a.patientId===patientId && !TERMINAL.includes(a.status) && `${a.date} ${a.start}`>=clinicNow().label).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0]
}

export function csvCell(value) {
  const text=String(value??'')
  const safe=/^[\s]*[=+@-]/.test(text)?`'${text}`:text
  return `"${safe.replaceAll('"','""')}"`
}

export function makeCsv(filename, rows) {
  if (!rows?.length) return
  const keys=Object.keys(rows[0])
  const esc=csvCell
  const text=[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n')
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export function nowLabel() {
  return clinicNow().label
}
