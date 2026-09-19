import { SERVICES, TODAY } from './data.js'

export const uid = (prefix='id') => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
export const peso = new Intl.NumberFormat('en-PH', { style:'currency', currency:'PHP', maximumFractionDigits:0 })

export const patientName = (patientId, patients) => patients.find(p=>p.id===patientId)?.name || patientId
export const dentistName = (dentistId, dentists) => dentists.find(d=>d.id===dentistId)?.name || dentistId
export const serviceInfo = name => SERVICES.find(s=>s.name===name) || { name, duration:30, category:'General Dentistry' }

export function toMinutes(value='00:00') {
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
  if (['paid','approved','confirmed','authorized','active','open','success','delivered','verified'].some(x=>s===x)) return 'success'
  if (['pending','waiting','scheduled','draft','called','treatment ready'].some(x=>s.includes(x))) return 'warning'
  if (['cancel','failed','missing','rejected','overload','no-show','inactive','escalat'].some(x=>s.includes(x))) return 'danger'
  if (['complete','closed','responded','returned'].some(x=>s.includes(x))) return 'info'
  return 'neutral'
}

export function overlap(startA, durationA, startB, durationB) {
  const a1=toMinutes(startA), a2=a1+Number(durationA||0)
  const b1=toMinutes(startB), b2=b1+Number(durationB||0)
  return a1 < b2 && b1 < a2
}

export function validateAppointment(form, state, ignoreId=null) {
  const branches=state.branches||[], dentists=state.dentists||[], appointments=state.appointments||[]
  const branch=branches.find(b=>b.name===form.branch)
  const dentist=dentists.find(d=>d.id===form.dentistId)
  const svc=serviceInfo(form.service)
  const duration=Number(form.duration||svc.duration)
  const start=toMinutes(form.start)
  const end=start+duration
  const checks=[]

  checks.push({ key:'branch-status', label:'Branch is open', ok:!!branch && branch.status==='Open', detail:branch ? `${branch.name} status: ${branch.status}` : 'Branch not found' })
  checks.push({ key:'branch-hours', label:'Within branch operating hours', ok:!!branch && start>=toMinutes(branch.open) && end<=toMinutes(branch.close), detail:branch ? `${displayTime(branch.open)}–${displayTime(branch.close)}` : 'No branch schedule' })
  checks.push({ key:'service', label:'Service available at branch', ok:!!branch && branch.services.includes(svc.category), detail:`${svc.category} • ${duration} min` })
  checks.push({ key:'dentist-branch', label:'Dentist assigned to branch', ok:!!dentist && dentist.branches.includes(form.branch), detail:dentist ? dentist.branches.join(', ') : 'Dentist not found' })
  checks.push({ key:'dentist-active', label:'Dentist currently available', ok:!!dentist && dentist.available, detail:dentist ? dentist.specialty : 'Dentist not found' })
  checks.push({ key:'dentist-shift', label:'Within dentist shift', ok:!!dentist && start>=toMinutes(dentist.shiftStart) && end<=toMinutes(dentist.shiftEnd), detail:dentist ? `${displayTime(dentist.shiftStart)}–${displayTime(dentist.shiftEnd)}` : 'No dentist schedule' })

  const conflict=appointments.find(a=>a.id!==ignoreId && a.status!=='Cancelled' && a.date===form.date && a.dentistId===form.dentistId && overlap(form.start,duration,a.start,a.duration))
  checks.push({ key:'overlap', label:'No overlapping appointment', ok:!conflict, detail:conflict ? `Conflicts with ${displayTime(conflict.start)}–${displayTime(addMinutes(conflict.start,conflict.duration))}` : 'No conflict found' })

  const valid=checks.every(c=>c.ok)
  const alternatives=[]
  if (!valid && branch && dentist) {
    for (let minute=Math.max(toMinutes(branch.open),toMinutes(dentist.shiftStart)); minute+duration<=Math.min(toMinutes(branch.close),toMinutes(dentist.shiftEnd)); minute+=30) {
      const h=Math.floor(minute/60), m=minute%60, t=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      const candidate={...form,start:t,duration}
      const onlyOverlap=appointments.some(a=>a.id!==ignoreId && a.status!=='Cancelled' && a.date===form.date && a.dentistId===form.dentistId && overlap(t,duration,a.start,a.duration))
      if (!onlyOverlap && branch.status==='Open' && branch.services.includes(svc.category) && dentist.branches.includes(form.branch) && dentist.available) alternatives.push(t)
      if (alternatives.length>=5) break
    }
  }
  return { valid, checks, alternatives, duration, conflict }
}

export function recalcQueue(queue) {
  const priorityRank={Urgent:0,Priority:1,Normal:2}
  const groups={}
  queue.forEach(q=>{
    if (['Completed','No-show'].includes(q.status)) return
    const key=`${q.branch}|${q.dentistId}`
    groups[key] ||= []
    groups[key].push(q)
  })
  Object.values(groups).forEach(list=>list.sort((a,b)=>(priorityRank[a.priority]??2)-(priorityRank[b.priority]??2) || toMinutes(a.checkedIn)-toMinutes(b.checkedIn)))
  const positions={}
  Object.entries(groups).forEach(([key,list])=>list.forEach((q,i)=>positions[q.id]=i+1))
  return queue.map(q=>positions[q.id] ? {...q,position:positions[q.id]} : q)
}

export function queueWaitEstimate(entry, queue, appointments, treatments, dentists) {
  if (!entry || ['Completed','No-show'].includes(entry.status)) return 0
  const same=queue.filter(q=>q.branch===entry.branch && q.dentistId===entry.dentistId && !['Completed','No-show'].includes(q.status))
  const ahead=same.filter(q=>(q.position||99)<(entry.position||99)).length
  const avgDuration=appointments.filter(a=>a.dentistId===entry.dentistId && a.date===TODAY && a.status!=='Cancelled').map(a=>a.duration||30)
  const typical=avgDuration.length ? Math.round(avgDuration.reduce((a,b)=>a+b,0)/avgDuration.length) : 30
  const active=treatments.some(t=>t.dentistId===entry.dentistId && t.date===TODAY && t.status==='In Treatment') ? Math.round(typical*.55) : 0
  const dentistAvailable=dentists.find(d=>d.id===entry.dentistId)?.available !== false
  return dentistAvailable ? Math.max(5, active + ahead*typical) : Math.max(30,(ahead+1)*typical)
}

export function branchCapacity(branchName, state) {
  const dentists=(state.dentists||[]).filter(d=>d.available && d.branches.includes(branchName))
  const activeDentists=Math.max(1,dentists.length)
  const queue=(state.queue||[]).filter(q=>q.branch===branchName && !['Completed','No-show'].includes(q.status))
  const waiting=queue.filter(q=>q.status==='Waiting').length
  const ready=queue.filter(q=>['Called','Treatment Ready'].includes(q.status)).length
  const booked=(state.appointments||[]).filter(a=>a.branch===branchName && a.date===TODAY && a.status!=='Cancelled').length
  const branch=(state.branches||[]).find(b=>b.name===branchName)
  const workload=Math.min(140, Math.round(((waiting*1.2+ready*1.4+booked*.65)/(activeDentists*4))*100))
  const estimate=Math.max(0,Math.round((waiting/activeDentists)*22 + ready*8))
  const threshold=branch?.threshold ?? 80
  return { branch:branchName, activeDentists, waiting, ready, booked, workload, estimate, threshold, overloaded: workload>=threshold || estimate>=35 }
}

export function nextAppointment(patientId, appointments) {
  return appointments.filter(a=>a.patientId===patientId && a.status!=='Cancelled' && a.date>=TODAY).sort((a,b)=>`${a.date}${a.start}`.localeCompare(`${b.date}${b.start}`))[0]
}

export function makeCsv(filename, rows) {
  if (!rows?.length) return
  const keys=Object.keys(rows[0])
  const esc=v=>`"${String(v??'').replaceAll('"','""')}"`
  const text=[keys.map(esc).join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n')
  const blob=new Blob([text],{type:'text/csv;charset=utf-8'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

export function nowLabel() {
  return '2026-09-19 10:08'
}
