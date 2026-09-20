import { pendingHours } from '../phase3-contracts.js'
import { automationSnapshot } from '../orchestration.js'
import React, { useMemo, useState } from 'react'
import { MODULES, ROLE_INFO, TODAY } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Progress, StatCard, Status, Table, Tabs } from '../components.jsx'
import { branchCapacity, dateLabel, dentistName, makeCsv, patientName, peso, uid } from '../logic.js'

export function BranchesPage({ store }) {
  const { state, setters, toast, log, workflow }=store
  const [selected,setSelected]=useState(state.branches[0]?.id||'')
  const branch=state.branches.find(b=>b.id===selected)
  const [form,setForm]=useState(branch||{})
  React.useEffect(()=>setForm(branch||{}),[selected])
  const save=()=>{
    const {services:legacyServices,...branchPatch}=form
    setters.setBranches(xs=>xs.map(b=>b.id===selected?{...b,...branchPatch}:b))
    workflow('M2','Branch configuration changed',`${form.branchCode||form.name} • dependent availability synchronized`)
    log(ROLE_INFO.owner.name,`Updated branch configuration ${form.name}`,'M2')
    toast('Branch changes published and dependent availability synchronized.','success')
  }
  const serviceActive=serviceId=>state.branchServices.some(bs=>bs.branchId===selected&&bs.serviceId===serviceId&&bs.active!==false)
  const toggleService=serviceId=>{
    setters.setBranchServices(xs=>{
      const existing=xs.find(bs=>bs.branchId===selected&&bs.serviceId===serviceId)
      if(existing)return xs.map(bs=>bs.id===existing.id?{...bs,active:!existing.active}:bs)
      return [...xs,{id:uid('bs'),branchId:selected,serviceId,active:true}]
    })
    workflow('M2→M6/M7','Branch service availability changed',`${selected} • ${serviceId}`,'Success','branch.service.changed')
  }
  return <>
    <PageHeader title="Multi-Branch Clinic Management" text="ERD-aligned branch identity plus the operating data required by scheduling, staffing, patient flow, and reporting." modules={[2]}/>
    <div className="grid-2 admin-config">
      <Card title="Branches" subtitle="BRANCHES: id • branch_name • branch_code • city • branch_status">
        <div className="branch-selector">{state.branches.map(b=><button key={b.id} className={selected===b.id?'selected':''} onClick={()=>setSelected(b.id)}><div><b>{b.name}</b><small>{b.branchCode} • {b.city}</small></div><Status>{b.status}</Status></button>)}</div>
      </Card>
      {branch&&<Card title={`Configure ${branch.name}`}><div className="form-grid">
        <Field label="Branch name"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Branch code" hint="Maps to BRANCHES.branch_code"><input value={form.branchCode||''} onChange={e=>setForm({...form,branchCode:e.target.value})}/></Field>
        <Field label="City" hint="Maps to BRANCHES.city"><input value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}/></Field>
        <Field label="Branch status"><select value={form.status||'Open'} onChange={e=>setForm({...form,status:e.target.value})}><option>Open</option><option>Temporarily Closed</option><option>Inactive</option></select></Field>
        <Field label="Opening time"><input type="time" value={form.open||'09:00'} onChange={e=>setForm({...form,open:e.target.value})}/></Field>
        <Field label="Closing time"><input type="time" value={form.close||'18:00'} onChange={e=>setForm({...form,close:e.target.value})}/></Field>
        <Field label="Capacity threshold"><input type="number" min="40" max="100" value={form.threshold||80} onChange={e=>setForm({...form,threshold:Number(e.target.value)})}/></Field>
        <Field label="Phone"><input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
        <Field label="Address"><textarea value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
        <div className="span-2"><label className="field-label">Available services <small>BRANCH_SERVICES • scheduling reads this catalog directly</small></label><div className="permission-list">{state.services.filter(s=>s.status==='Active').map(service=><label className="check-control" key={service.id}><input type="checkbox" checked={serviceActive(service.id)} onChange={()=>toggleService(service.id)}/><span><b>{service.name}</b><small>{service.category} • {service.duration} min • {peso.format(service.baseFee)}</small></span></label>)}</div></div>
        <Button className="span-2" onClick={save}>Publish Branch Changes</Button>
      </div></Card>}
    </div>
  </>
}

export function TeamPage({ store }) {
  const { state, setters, toast, log, workflow }=store
  const [tab,setTab]=useState('dentists')
  const [editDentist,setEditDentist]=useState(null)
  const [editStaff,setEditStaff]=useState(null)

  const linkedUser=userId=>state.users.find(u=>u.id===userId)
  const accountStatus=profile=>{
    const u=linkedUser(profile.userId)
    return u?.accountStatus||u?.status||'Unlinked'
  }
  const branchConflict=(profile)=>{
    const names=profile.branches||[profile.branch]
    return names.filter(name=>name&&name!=='All Branches').some(name=>{
      const b=state.branches.find(x=>x.name===name)
      return b && profile.shiftStart && profile.shiftEnd && (profile.shiftStart<b.open || profile.shiftEnd>b.close)
    })
  }
  const availableStatus=profile=>{
    if(accountStatus(profile)!=='Active') return 'Unavailable'
    if(branchConflict(profile)) return 'Conflict'
    return profile.available?'Available':'Unavailable'
  }
  const publish=(label)=>{
    workflow('M3','Staff/dentist profile updated',`${label} • scheduling/workload availability synchronized`)
    log(ROLE_INFO.owner.name,`Updated staff/dentist profile: ${label}`,'M3')
    toast('Profile changes published and availability synchronized.','success')
  }
  const saveDentist=()=>{
    if(!editDentist)return
    if(branchConflict(editDentist))return toast('Assignment conflict: shift is outside the assigned branch operating hours.','warning')
    const {name,email,phone,firstName,middleName,lastName,dob,sex,address,assistant,...profile}=editDentist
    setters.setDentists(xs=>xs.map(d=>d.id===editDentist.id?profile:d))
    publish(editDentist.name)
    setEditDentist(null)
  }
  const saveStaff=()=>{
    if(!editStaff)return
    if(branchConflict(editStaff))return toast('Assignment conflict: shift is outside the assigned branch operating hours.','warning')
    const {name,email,phone,firstName,middleName,lastName,dob,sex,address,...profile}=editStaff
    setters.setStaff(xs=>xs.map(s=>s.id===editStaff.id?{...profile,role:profile.staffType}:s))
    publish(editStaff.name)
    setEditStaff(null)
  }

  return <>
    <PageHeader title="Dentist & Staff Management" text="Personnel records are synchronized from Users & Access. This screen manages the linked STAFF_PROFILES data plus operational shift and availability information used by scheduling and capacity workflows." modules={[3,15]}/>
    <Notice tone="info" title="Account & personnel synchronization">Create the account first in <b>Access & Roles</b>. Dentist and staff accounts automatically receive a linked personnel profile here. <b>Active</b> comes from the account; <b>Available</b> reflects operational scheduling status.</Notice>
    <Tabs tabs={[{key:'dentists',label:'Dentists',count:state.dentists.length},{key:'staff',label:'Staff',count:state.staff.length}]} active={tab} onChange={setTab}/>
    {tab==='dentists'?<Card title="Dentist profiles & availability" subtitle="STAFF_PROFILES: user_id • staff_type • license_no • specialization">
      <Table rows={state.dentists} columns={[
        {key:'name',label:'Dentist'},
        {key:'userId',label:'User ID'},
        {key:'licenseNo',label:'License no.'},
        {key:'specialty',label:'Specialization'},
        {key:'branches',label:'Branch assignment',render:d=>d.branches.join(', ')},
        {key:'shift',label:'Shift',render:d=>`${d.shiftStart}–${d.shiftEnd}`},
        {key:'active',label:'Active',render:d=><Status>{accountStatus(d)}</Status>},
        {key:'availability',label:'Available',render:d=><Status>{availableStatus(d)}</Status>},
        {key:'action',label:'Action',render:d=><Button size="sm" variant="ghost" onClick={()=>setEditDentist({...d})}>Edit Profile</Button>}
      ]}/>
    </Card>:<Card title="Clinic staff profiles" subtitle="Every row is linked back to a USERS account through user_id">
      <Table rows={state.staff} columns={[
        {key:'name',label:'Staff member'},
        {key:'userId',label:'User ID'},
        {key:'staffType',label:'Staff type'},
        {key:'licenseNo',label:'License no.'},
        {key:'specialization',label:'Specialization'},
        {key:'branch',label:'Branch'},
        {key:'shift',label:'Shift',render:s=>`${s.shiftStart}–${s.shiftEnd}`},
        {key:'active',label:'Active',render:s=><Status>{accountStatus(s)}</Status>},
        {key:'availability',label:'Available',render:s=><Status>{availableStatus(s)}</Status>},
        {key:'action',label:'Action',render:s=><Button size="sm" variant="ghost" onClick={()=>setEditStaff({...s})}>Edit Profile</Button>}
      ]}/>
    </Card>}

    <Modal open={!!editDentist} onClose={()=>setEditDentist(null)} title="Edit dentist profile" subtitle="Account identity/status stays in Users & Access. This form maintains the linked personnel profile and operational assignment.">
      {editDentist&&<div className="form-grid">
        <Field label="User / display name" hint={`Linked user: ${editDentist.userId}`}><input value={editDentist.name} disabled/></Field>
        <Field label="Staff type"><input value={editDentist.staffType||'Dentist'} disabled/></Field>
        <Field label="License no."><input value={editDentist.licenseNo||''} onChange={e=>setEditDentist({...editDentist,licenseNo:e.target.value})}/></Field>
        <Field label="Specialization"><input value={editDentist.specialty||''} onChange={e=>setEditDentist({...editDentist,specialty:e.target.value})}/></Field>
        <Field label="Branch"><select value={editDentist.branches[0]} onChange={e=>setEditDentist({...editDentist,branches:[e.target.value],branchIds:[state.branches.find(b=>b.name===e.target.value)?.id]})}>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Assistant"><select value={editDentist.assistantStaffId||''} onChange={e=>setEditDentist({...editDentist,assistantStaffId:e.target.value||null})}><option value="">Unassigned</option>{state.staff.filter(s=>s.staffType==='Dental Assistant').map(a=><option key={a.id} value={a.id}>{a.name} • {a.branch}</option>)}</select></Field>
        <Field label="Shift start"><input type="time" value={editDentist.shiftStart} onChange={e=>setEditDentist({...editDentist,shiftStart:e.target.value})}/></Field>
        <Field label="Shift end"><input type="time" value={editDentist.shiftEnd} onChange={e=>setEditDentist({...editDentist,shiftEnd:e.target.value})}/></Field>
        <label className="check-control span-2"><input type="checkbox" checked={!!editDentist.available} onChange={e=>setEditDentist({...editDentist,available:e.target.checked})}/><span><b>Available for scheduling</b><small>Active account status is controlled in Users & Access; availability is synchronized to scheduling/workload.</small></span></label>
        {branchConflict(editDentist)&&<Notice tone="warning">Current shift conflicts with the selected branch operating hours.</Notice>}
        <Button className="span-2" onClick={saveDentist}>Save & Synchronize Profile</Button>
      </div>}
    </Modal>

    <Modal open={!!editStaff} onClose={()=>setEditStaff(null)} title="Edit staff profile" subtitle="This edits the linked STAFF_PROFILES record and the operational fields used by clinic scheduling.">
      {editStaff&&<div className="form-grid">
        <Field label="User / display name" hint={`Linked user: ${editStaff.userId}`}><input value={editStaff.name} disabled/></Field>
        <Field label="Staff type"><input value={editStaff.staffType||''} onChange={e=>setEditStaff({...editStaff,staffType:e.target.value})}/></Field>
        <Field label="License no."><input value={editStaff.licenseNo||''} onChange={e=>setEditStaff({...editStaff,licenseNo:e.target.value})}/></Field>
        <Field label="Specialization"><input value={editStaff.specialization||''} onChange={e=>setEditStaff({...editStaff,specialization:e.target.value})}/></Field>
        <Field label="Branch"><select value={editStaff.branch} onChange={e=>setEditStaff({...editStaff,branch:e.target.value,branchId:state.branches.find(b=>b.name===e.target.value)?.id||null})}><option>All Branches</option>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Shift start"><input type="time" value={editStaff.shiftStart} onChange={e=>setEditStaff({...editStaff,shiftStart:e.target.value})}/></Field>
        <Field label="Shift end"><input type="time" value={editStaff.shiftEnd} onChange={e=>setEditStaff({...editStaff,shiftEnd:e.target.value})}/></Field>
        <label className="check-control span-2"><input type="checkbox" checked={!!editStaff.available} onChange={e=>setEditStaff({...editStaff,available:e.target.checked})}/><span><b>Available for operations</b><small>Availability is separate from the account's Active/Inactive status.</small></span></label>
        {branchConflict(editStaff)&&<Notice tone="warning">Current shift conflicts with the selected branch operating hours.</Notice>}
        <Button className="span-2" onClick={saveStaff}>Save & Synchronize Profile</Button>
      </div>}
    </Modal>
  </>
}

export function AnalyticsPage({ activeBranch, store }) {
  const { state }=store
  const [period,setPeriod]=useState('Today')
  const branchFilter=x=>activeBranch==='All Branches'||x.branch===activeBranch
  const appts=state.appointments.filter(branchFilter)
  const queue=state.queue.filter(branchFilter)
  const hmo=state.hmo.filter(branchFilter)
  const paid=state.invoices.filter(i=>i.status==='Paid'&&branchFilter(i))
  const metrics=[
    {name:'Scheduling',value:appts.filter(a=>a.status==='Confirmed').length,note:'Confirmed appointment records',module:'M6–M7'},
    {name:'Queue / patient flow',value:queue.filter(q=>q.status==='Completed').length,note:'Completed queue records',module:'M9–M10'},
    {name:'HMO processing',value:hmo.filter(h=>h.status==='Approved').length,note:'Approved provider outcomes',module:'M12–M14'},
    {name:'Communication',value:state.inquiries.filter(i=>i.status==='Responded').length+state.conversations.filter(c=>c.status==='Closed').length,note:'Responded/closed communication records',module:'M16–M18'},
    {name:'Recorded revenue',value:peso.format(paid.reduce((s,i)=>s+i.total,0)),note:'Paid transaction records',module:'M11'},
  ]
  const exportRows=state.branches.map(b=>{const c=branchCapacity(b.name,state);return {Branch:b.name,Workload:c.workload,Waiting:c.waiting,Booked:c.booked,EstimatedWait:c.estimate,Threshold:c.threshold}})
  return <>
    <PageHeader title="Operational Reporting & Analytics" text="Cross-cutting KPI layer for queue, scheduling, workload, HMO, communication, and patient flow. Reports are filtered by branch and period before management review." modules={[21]} aside={<select className="compact-select" value={period} onChange={e=>setPeriod(e.target.value)}><option>Today</option><option>This Week</option><option>This Month</option></select>}/>
    <div className="cards-3">{metrics.map(m=><Card key={m.name} title={m.name}><div className="analytics-value">{m.value}</div><p className="muted-copy">{m.note}</p><span className="module-inline">{m.module}</span></Card>)}</div>
    <div className="grid-2 top-gap">
      <Card title="Branch workload report"><div className="branch-bars">{state.branches.filter(b=>activeBranch==='All Branches'||b.name===activeBranch).map(b=>{const c=branchCapacity(b.name,state);return <div key={b.id}><div className="bar-label"><span>{b.name}</span><b>{c.workload}%</b></div><Progress value={c.workload} threshold={c.threshold}/><small>{c.waiting} waiting • {c.booked} booked • ~{c.estimate} min wait</small></div>})}</div></Card>
      <Card title="Report actions" subtitle="Report exports"><div className="action-stack"><Button onClick={()=>makeCsv('dentalops-branch-capacity.csv',exportRows)}>Export Branch Capacity CSV</Button><Button variant="ghost" onClick={()=>makeCsv('dentalops-hmo-report.csv',hmo.map(x=>({Patient:patientName(x.patientId,state.patients),Provider:x.provider,Branch:x.branch,Status:x.status,PendingHours:pendingHours(x,state.clock),Reference:x.reference||''})))}>Export HMO CSV</Button><Notice tone="info">Reports are prepared from operational records and can be filtered by branch and reporting period.</Notice></div></Card>
    </div>
  </>
}

export function UsersPage({ store }) {
  const { state, actions, toast }=store
  const empty={firstName:'',middleName:'',lastName:'',phone:'',username:'',email:'',roleName:'Receptionist',branchId:'b1',accountStatus:'Active'}
  const [form,setForm]=useState(empty)
  const permissionMap={
    Patient:['patient-portal'],
    Receptionist:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'],
    Dentist:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'],
    'Dental Assistant':['queue','clinical-records'],
    'HMO Coordinator':['hmo','patient-demographics','messages'],
    Cashier:['billing','patient-demographics'],
    'Patient Engagement Staff':['inquiries','messages','engagement'],
    'Owner / Admin':['all']
  }
  const staffRoles=new Set(['Receptionist','Dental Assistant','HMO Coordinator','Cashier','Patient Engagement Staff'])
  const profileSync=u=>{
    if(u.roleName==='Dentist') return state.dentists.some(d=>d.userId===u.id)?'Dentist profile linked':'Missing profile'
    if(staffRoles.has(u.roleName)) return state.staff.some(s=>s.userId===u.id)?'Staff profile linked':'Missing profile'
    if(u.roleName==='Patient') return state.patients.some(p=>p.userId===u.id)?'Patient record linked':'Missing patient link'
    return 'Not required'
  }
  const add=()=>{
    const result=actions.createUserAccount(form)
    if(!result.ok)return toast(result.message,'warning')
    toast(form.roleName==='Dentist'||staffRoles.has(form.roleName)?'Account created and linked personnel profile synchronized.':form.roleName==='Patient'?'Patient portal account and patient record linked.':'Account created.','success')
    setForm(empty)
  }
  const toggle=u=>{
    const result=actions.toggleUserStatus(u.id)
    if(!result.ok)return toast(result.message,'warning')
    toast(`Account is now ${result.status}. Linked personnel availability was synchronized when applicable.`,'success')
  }
  const branchScoped=!['Owner / Admin','Patient'].includes(form.roleName)
  return <>
    <PageHeader title="People & Access • User Accounts" text="PERSONS stores the single identity/contact record. USERS stores authentication/account state. Dentist/Staff/Patient profiles are linked automatically so the same person is not encoded twice." modules={[1,3,4]}/>
    <Notice tone="info" title="Identity model">Identity and contact details are stored once and shared by the linked user, staff, dentist, or patient profile.</Notice>
    <div className="grid-2 top-gap">
      <Card title="Create user account" subtitle="Owner/Admin can create Patient, Dentist, Staff subrole, or Owner/Admin accounts">
        <div className="form-grid">
          <Field label="First name" required><input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></Field>
          <Field label="Middle name" hint="Optional"><input value={form.middleName} onChange={e=>setForm({...form,middleName:e.target.value})}/></Field>
          <Field label="Last name" required><input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></Field>
          <Field label="Phone"><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
          <Field label="Username" required><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
          <Field label="Role"><select value={form.roleName} onChange={e=>setForm({...form,roleName:e.target.value,branchId:['Owner / Admin','Patient'].includes(e.target.value)?'':form.branchId||'b1'})}>{Object.keys(permissionMap).map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Branch scope" hint={branchScoped?'Required for operational clinic roles':'Not applicable'}><select disabled={!branchScoped} value={branchScoped?form.branchId:''} onChange={e=>setForm({...form,branchId:e.target.value})}>{!branchScoped?<option value="">Not branch-bound</option>:state.branches.map(b=><option key={b.id} value={b.id}>{b.branchCode} • {b.name}</option>)}</select></Field>
          <Field label="Account status"><select value={form.accountStatus} onChange={e=>setForm({...form,accountStatus:e.target.value})}><option>Active</option><option>Inactive</option></select></Field>
          <Button className="span-2" onClick={add}>Create Linked Account</Button>
        </div>
      </Card>
      <Card title="Permission profiles"><div className="permission-list">{Object.entries(permissionMap).map(([role,perms])=><div key={role}><b>{role}</b><span>{perms.join(' • ')}</span></div>)}</div></Card>
    </div>
    <Card className="top-gap" title="Authorized users" subtitle="Identity is resolved from PERSONS; profile linkage shows which operational record shares that same person.">
      <Table rows={state.users} columns={[
        {key:'name',label:'Person'},
        {key:'username',label:'Username',render:u=>u.username||u.login},
        {key:'email',label:'Email'},
        {key:'roleName',label:'Role',render:u=>u.roleName||u.role},
        {key:'branch',label:'Branch scope'},
        {key:'profile',label:'Linked profile',render:u=>profileSync({...u,roleName:u.roleName||u.role})},
        {key:'status',label:'Account status',render:u=><Status>{u.accountStatus||u.status}</Status>},
        {key:'action',label:'Action',render:u=>(u.roleName||u.role)!=='Owner / Admin'?<Button size="sm" variant={(u.accountStatus||u.status)==='Active'?'danger':'ghost'} onClick={()=>toggle(u)}>{(u.accountStatus||u.status)==='Active'?'Deactivate':'Activate'}</Button>:null}
      ]}/>
    </Card>
  </>
}

export function AutomationPage({ store }) {
  const { state }=store
  const monitor=automationSnapshot(state)
  if(store.session&&store.session.role!=='owner')return <Notice>Automation monitoring is available to Owner/Admin.</Notice>
  const success=monitor.success
  const failed=monitor.failed.length
  const rate=state.workflowLog.length?Math.round((success/state.workflowLog.length)*100):100
  return <>
    <PageHeader kicker="System orchestration" title="Automation monitor" text="Monitor recorded frontend actions, failures, and warnings. Rules are read-only. No server workers, external delivery, or background scheduler are connected."/>
    <div className="stats-grid">
      <StatCard label="Automation health" value={`${rate}%`} hint="Successful recorded actions"/>
      <StatCard label="Active rules" value={state.automations.filter(r=>r.enabled).length} hint="Approved workflow rules" tone="blue"/>
      <StatCard label="Failed actions" value={failed} hint="Recorded failed attempts" tone="amber"/>
      <StatCard label="Recent events" value={state.workflowLog.length} hint="Central activity feed" tone="purple"/>
    </div>
    <div className="grid-2">
      <Card title="Workflow health" subtitle="Protected automation rules currently in effect">
        <div className="automation-rule-list">{state.automations.map(r=><div className="automation-rule-row" key={r.id}><div className="automation-rule-icon">{r.enabled?'✓':'—'}</div><div><b>{r.event}</b><span>{r.action}</span><small>{r.targetModule} • {r.condition}</small></div><Status>{r.enabled?'Active':'Inactive'}</Status></div>)}</div>
      </Card>
      <Card title="Recorded exceptions" subtitle="Historical failed attempts and warnings; current case status determines the next action">
        <div className="alert-list">{[...monitor.failed,...monitor.warnings].length?[...monitor.failed,...monitor.warnings].map(x=><div className="alert warning" key={x.id}><div><b>{x.event}</b><span>{x.result}</span><small>{x.createdAt||x.at} • {x.entityType||'Legacy record'} {x.entityId||''}</small></div><Status>{x.status}</Status></div>):<Notice tone="success" title="No recorded exceptions">No failed attempts or warnings are present in the current activity history.</Notice>}</div>
      </Card>
    </div>
    <Card className="top-gap" title="Recent automation activity" subtitle="Central audit trail of system events and triggered actions">
      <Table rows={state.workflowLog} columns={[
        {key:'at',label:'Time'},
        {key:'module',label:'Workflow'},
        {key:'entity',label:'Affected record',render:e=>`${e.entityType||'Legacy'} • ${e.entityId||'Not linked'}`},
        {key:'actor',label:'Actor',render:e=>state.users.find(u=>u.id===e.actorUserId)?.name||e.actorUserId||'Historical record'},
        {key:'event',label:'Event'},
        {key:'result',label:'Result'},
        {key:'status',label:'Status',render:r=><Status>{r.status}</Status>}
      ]}/>
    </Card>
  </>
}

export function EngagementPage({ role, store }) {
  const { state, setters, toast, log }=store
  const [tab,setTab]=useState('loyalty')
  const [campaign,setCampaign]=useState({name:'',type:'Reactivation',audience:'Patients overdue for routine recall',channel:'SMS',scheduled:'2026-09-25 09:00'})
  const [loyaltyForm,setLoyaltyForm]=useState({patientId:state.patients[0]?.id||'',activity:'Qualified Visit',points:20})
  const createCampaign=()=>{if(!campaign.name)return toast('Enter a campaign name.','warning');setters.setCampaigns(xs=>[{id:uid('camp'),...campaign,status:'Draft',responses:0,reactivated:0},...xs]);log(role==='owner'?ROLE_INFO.owner.name:ROLE_INFO.staff.name,'Created optional engagement campaign','M25');toast('Proposed Enhancement campaign created as a draft.','success');setCampaign({...campaign,name:''})}
  const applyLoyalty=()=>{
    const current=state.loyalty.find(l=>l.patientId===loyaltyForm.patientId)
    const points=Number(loyaltyForm.points||0)
    if(points<=0)return toast('Enter a positive points value.','warning')
    if(current){
      const duplicate=current.history.some(h=>h.at===TODAY&&h.type===loyaltyForm.activity&&h.points===points)
      if(duplicate)return toast('Duplicate reward prevented by the configured reward rule.','warning')
      setters.setLoyalty(xs=>xs.map(l=>l.patientId===loyaltyForm.patientId?{...l,points:l.points+points,history:[{at:TODAY,type:loyaltyForm.activity,detail:'Admin-verified qualified activity',points},...l.history]}:l))
    } else {
      const patient=state.patients.find(p=>p.id===loyaltyForm.patientId)
      setters.setLoyalty(xs=>[{id:uid('loy'),patientId:loyaltyForm.patientId,referralCode:`DANA-${patient?.name?.split(' ')[0]?.toUpperCase()||'PATIENT'}-${String(Date.now()).slice(-2)}`,points,history:[{at:TODAY,type:loyaltyForm.activity,detail:'Admin-verified qualified activity',points}]},...xs])
    }
    log(role==='owner'?ROLE_INFO.owner.name:ROLE_INFO.staff.name,'Recorded qualified referral/loyalty activity','M24');toast('Qualified activity recorded and loyalty balance updated once.','success')
  }
  const processRedemption=l=>{const pending=l.history.find(h=>h.type==='Redemption Request'&&h.status==='Pending');if(!pending)return;if(l.points<50)return toast('Patient does not have enough points for the demo redemption rule.','warning');setters.setLoyalty(xs=>xs.map(x=>x.id===l.id?{...x,points:x.points-50,history:[{at:TODAY,type:'Redemption',detail:'50-point reward redeemed',points:-50,status:'Processed'},...x.history.map(h=>h===pending?{...h,status:'Processed'}:h)]}:x));log(role==='owner'?ROLE_INFO.owner.name:ROLE_INFO.staff.name,'Processed loyalty redemption','M24');toast('Redemption processed and loyalty balance updated.','success')}
  return <>
    <PageHeader title="Patient Engagement Enhancements" text="Proposed Enhancements only — referral/loyalty administration and optional marketing/reactivation campaigns, clearly separated from core clinic operations." modules={[24,25]}/>
    <Notice tone="warning" title="Proposed Enhancement (PE)">Modules 24–25 were not presented as client-stated requirements. They remain optional and should be defended as future/pilot enhancements.</Notice>
    <Tabs tabs={[{key:'loyalty',label:'Referral & Loyalty • M24'},{key:'campaigns',label:'Marketing & Reactivation • M25'}]} active={tab} onChange={setTab}/>
    {tab==='loyalty'?<>
      <div className="grid-2">
        <Card title="Record qualified referral / loyalty activity" subtitle="Validates activity before applying a configured reward once"><div className="form-grid"><Field label="Patient"><select value={loyaltyForm.patientId} onChange={e=>setLoyaltyForm({...loyaltyForm,patientId:e.target.value})}>{state.patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Activity"><select value={loyaltyForm.activity} onChange={e=>setLoyaltyForm({...loyaltyForm,activity:e.target.value})}><option>Qualified Visit</option><option>Qualified Referral</option></select></Field><Field label="Reward / points"><input type="number" min="1" value={loyaltyForm.points} onChange={e=>setLoyaltyForm({...loyaltyForm,points:e.target.value})}/></Field><Button onClick={applyLoyalty}>Validate & Apply Reward Once</Button></div></Card>
        <Card title="Referral & loyalty rules"><Notice tone="info">The frontend represents referral code generation, qualified activity verification, duplicate prevention, balance updates, redemption visibility, and history. Actual reward rules would be server-controlled in production.</Notice></Card>
      </div>
      <Card className="top-gap" title="Loyalty accounts"><Table rows={state.loyalty} columns={[{key:'patient',label:'Patient',render:l=>patientName(l.patientId,state.patients)},{key:'code',label:'Referral code',render:l=>l.referralCode},{key:'points',label:'Balance',render:l=>`${l.points} pts`},{key:'history',label:'Latest activity',render:l=>l.history[0]?`${l.history[0].type} • ${l.history[0].at}`:'—'},{key:'action',label:'Redemption',render:l=>l.history.some(h=>h.type==='Redemption Request'&&h.status==='Pending')?<Button size="sm" onClick={()=>processRedemption(l)}>Process request</Button>:'—'}]} /></Card>
    </>:<>
      <div className="grid-2"><Card title="Create optional campaign"><div className="form-grid"><Field label="Campaign name"><input value={campaign.name} onChange={e=>setCampaign({...campaign,name:e.target.value})}/></Field><Field label="Type"><select value={campaign.type} onChange={e=>setCampaign({...campaign,type:e.target.value})}><option>Reactivation</option><option>Feedback</option><option>Engagement</option></select></Field><Field label="Target patient group"><input value={campaign.audience} onChange={e=>setCampaign({...campaign,audience:e.target.value})}/></Field><Field label="Channel"><select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})}><option>SMS</option><option>Portal</option><option>Email</option></select></Field><Field label="Scheduled outreach"><input value={campaign.scheduled} onChange={e=>setCampaign({...campaign,scheduled:e.target.value})}/></Field><Button onClick={createCampaign}>Create Draft Campaign</Button></div></Card><Card title="PE boundaries"><Notice tone="info">Operational confirmations, queue notices, delay updates, and follow-up reminders stay separate from optional marketing and reactivation outreach.</Notice></Card></div>
      <Card className="top-gap" title="Campaigns"><Table rows={state.campaigns} columns={[{key:'name',label:'Campaign'},{key:'type',label:'Type'},{key:'audience',label:'Audience'},{key:'channel',label:'Channel'},{key:'scheduled',label:'Schedule'},{key:'responses',label:'Responses / feedback'},{key:'reactivated',label:'Reactivated'},{key:'status',label:'Status',render:c=><Status>{c.status}</Status>}]} /></Card>
    </>}
  </>
}

export function LoyaltyPage({ store }) {
  const { state, setters, toast, log }=store
  const pid=ROLE_INFO.patient.patientId
  const account=state.loyalty.find(l=>l.patientId===pid)
  const requestRedemption=()=>{
    if(!account)return
    if(account.history.some(h=>h.type==='Redemption Request'&&h.status==='Pending')) return toast('A redemption request is already pending staff processing.','warning')
    setters.setLoyalty(xs=>xs.map(l=>l.id===account.id?{...l,history:[{at:TODAY,type:'Redemption Request',detail:'Patient requested reward redemption',points:0,status:'Pending'},...l.history]}:l))
    log(ROLE_INFO.patient.name,'Requested loyalty redemption','M24');toast('Redemption request submitted for clinic staff processing.','success')
  }
  return <>
    <PageHeader title="Referral & Loyalty" text="Proposed Enhancement only — optional referral identifiers, qualified activity, points, redemption requests, duplicate prevention, and referral/loyalty history." modules={[24]}/>
    <Notice tone="warning" title="Proposed Enhancement (PE)">Referral and loyalty were not presented as a client-stated requirement. This UI is an optional future enhancement.</Notice>
    {account?<div className="grid-2 top-gap"><Card title="My referral & loyalty"><div className="loyalty-card"><small>Available points</small><div className="points">{account.points}<span> points</span></div><small>Referral code</small><div className="referral-big">{account.referralCode}</div><Button onClick={requestRedemption}>Request Redemption</Button></div></Card><Card title="Loyalty history"><Table rows={account.history.map((x,i)=>({...x,id:i}))} columns={[{key:'at',label:'Date'},{key:'type',label:'Activity'},{key:'detail',label:'Details'},{key:'points',label:'Points',render:x=>x.points>0?`+${x.points}`:String(x.points)},{key:'status',label:'Status',render:x=>x.status?<Status>{x.status}</Status>:'—'}]} /></Card></div>:<Notice>No loyalty account is available in the demo data.</Notice>}
  </>
}

export function ModulesPage() {
  const [area,setArea]=useState('All')
  const areas=['All',...new Set(MODULES.map(m=>m.area))]
  const visible=MODULES.filter(m=>area==='All'||m.area===area)
  return <>
    <PageHeader title="25-Module UI Coverage" text="Professor-facing traceability view showing where every documented process is represented in the frontend prototype." modules={[]}/>
    <div className="module-summary"><div><b>25</b><span>Documented modules</span></div><div><b>4</b><span>Main role experiences</span></div><div><b>2</b><span>Proposed Enhancements</span></div></div>
    <div className="tabs top-gap">{areas.map(a=><button className={area===a?'active':''} key={a} onClick={()=>setArea(a)}>{a}</button>)}</div>
    <div className="module-grid">{visible.map(m=><div className="module-tile" key={m.no}><div className="module-tile-top"><span className={`module-badge ${m.pe?'pe':''}`}>M{m.no}{m.pe?' • PE':''}</span><span>{m.area}</span></div><strong>{m.name}</strong><small>Module owner: {m.owner}</small><div className="role-tags">{m.roles.map(r=><span key={r}>{r==='owner'?'Owner/Admin':r[0].toUpperCase()+r.slice(1)}</span>)}</div><div className="coverage-state">✓ Represented in final UI</div></div>)}</div>
  </>
}
