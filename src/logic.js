import { SERVICES } from './data.js'
import { clinicNow, clinicDate } from './clock.js'
import { TERMINAL, isTodayQueue, isWaitingQueue } from './contracts.js'

export const uid = (prefix='id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
export const peso = new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP', maximumFractionDigits:0 })

export const patientName = (patientId, patients) => patients.find(p=>p.id===patientId)?.name || patientId
export const dentistName = (dentistId, dentists) => dentists.find(d=>d.id===dentistId)?.name || dentistId

// Same duplicate-person signal Staff patient creation already uses (createPatientRecord): a matching phone, or a
// matching first/last name plus date of birth. Never claims a match from typed identity alone with looser rules.
export const possibleDuplicatePerson = (persons, {firstName, lastName, phone, dob}) =>
  persons.some(p=>(phone&&p.phone===phone)||(p.firstName?.toLowerCase()===firstName.toLowerCase()&&p.lastName?.toLowerCase()===lastName.toLowerCase()&&p.dob===(dob||null)))
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

// A calendar date ("2026-10-14") is shown as that date; a full timestamp from the server ("2026-10-14T02:28:17+08:00") or a Date
// is shown as its clinic (Asia/Manila) date. Anything missing, empty or unreadable is shown as "—", never "Invalid Date".
export const dateLabel = date => {
  const options={month:'short',day:'numeric',year:'numeric'}
  if (date instanceof Date) return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH',{...options,timeZone:'Asia/Manila'})
  const text=typeof date==='string'?date.trim():''
  const calendar=/^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (calendar) {
    const [y,m,d]=calendar.slice(1).map(Number), day=new Date(Date.UTC(y,m-1,d))
    if (day.getUTCFullYear()!==y||day.getUTCMonth()!==m-1||day.getUTCDate()!==d) return '—'
    return day.toLocaleDateString('en-PH',{...options,timeZone:'UTC'})
  }
  if (!/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(text)) return '—'
  const instant=new Date(text.replace(' ','T').replace(/([+-]\d{2})$/,'$1:00')) // PostgreSQL may write "+08"
  return Number.isNaN(instant.getTime()) ? '—' : instant.toLocaleDateString('en-PH',{...options,timeZone:'Asia/Manila'})
}

export function statusTone(value='') {
  const s=String(value).toLowerCase()
  if (['paid','approved','confirmed','authorized','active','available','open','success','delivered','verified'].some(x=>s===x)) return 'success'
  if (['pending','waiting','scheduled','draft','called','treatment ready'].some(x=>s.includes(x))) return 'warning'
  if (['cancel','failed','missing','rejected','overload','no-show','inactive','unavailable','conflict','escalat'].some(x=>s.includes(x))) return 'danger'
  if (['complete','closed','responded','returned'].some(x=>s.includes(x))) return 'info'
  return 'neutral'
}

export function queueWaitEstimate(entry, queue, appointments, treatments, dentists) {
  if (!isWaitingQueue(entry) || !isTodayQueue(entry) || entry.status==='In Treatment') return 0
  const priorityRank = p => p === 'Urgent' ? 0 : p === 'Priority' ? 1 : 2
  const statusRank = s => s === 'Treatment Ready' ? 0 : s === 'Called' ? 1 : 2
  const same=queue.filter(q=>q.branchId===entry.branchId && q.clinicDate===entry.clinicDate && q.dentistId===entry.dentistId && isWaitingQueue(q))
  const ahead=same.filter(q=>{
    if (q.id === entry.id) return false
    if (q.position != null && entry.position != null) return q.position < entry.position
    const sDiff = statusRank(q.status) - statusRank(entry.status)
    if (sDiff !== 0) return sDiff < 0
    const pDiff = priorityRank(q.priority) - priorityRank(entry.priority)
    if (pDiff !== 0) return pDiff < 0
    return (q.queueNumber || 99) < (entry.queueNumber || 99)
  }).length
  const avgDuration=appointments.filter(a=>a.dentistId===entry.dentistId && a.date===clinicDate() && a.status!=='Cancelled').map(a=>a.duration||30)
  const typical=avgDuration.length ? Math.round(avgDuration.reduce((a,b)=>a+b,0)/avgDuration.length) : 30
  const active=treatments.some(t=>t.server && t.dentistId===entry.dentistId && t.status==='In Treatment') ? Math.round(typical*.55) : 0
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
