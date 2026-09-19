import React, { useMemo, useState } from 'react'
import { MODULES, ROLE_INFO, TODAY } from '../data.js'
import { Button, Card, Field, Modal, Notice, PageHeader, Progress, Status, Table, Tabs } from '../components.jsx'
import { branchCapacity, dateLabel, dentistName, makeCsv, patientName, peso, uid } from '../logic.js'

export function BranchesPage({ store }) {
  const { state, setters, toast, log, workflow }=store
  const [selected,setSelected]=useState(state.branches[0]?.id||'')
  const branch=state.branches.find(b=>b.id===selected)
  const [form,setForm]=useState(branch||{})
  React.useEffect(()=>setForm(branch||{}),[selected])
  const save=()=>{
    setters.setBranches(xs=>xs.map(b=>b.id===selected?{...b,...form}:b))
    workflow('M2','Branch configuration changed',`${form.branchCode||form.name} • dependent availability synchronized`)
    log(ROLE_INFO.owner.name,`Updated branch configuration ${form.name}`,'M2')
    toast('Branch changes published and dependent availability synchronized.','success')
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
        <Field label="Available service categories"><textarea value={(form.services||[]).join(', ')} onChange={e=>setForm({...form,services:e.target.value.split(',').map(x=>x.trim()).filter(Boolean)})}/></Field>
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
    setters.setDentists(xs=>xs.map(d=>d.id===editDentist.id?editDentist:d))
    publish(editDentist.name)
    setEditDentist(null)
  }
  const saveStaff=()=>{
    if(!editStaff)return
    if(branchConflict(editStaff))return toast('Assignment conflict: shift is outside the assigned branch operating hours.','warning')
    setters.setStaff(xs=>xs.map(s=>s.id===editStaff.id?{...editStaff,role:editStaff.staffType}:s))
    publish(editStaff.name)
    setEditStaff(null)
  }

  return <>
    <PageHeader title="Dentist & Staff Management" text="Personnel records are synchronized from Users & Access. This screen manages the linked STAFF_PROFILES data plus operational shift and availability information used by scheduling and capacity workflows." modules={[3,15]}/>
    <Notice tone="info" title="M1 → M3 synchronization">Create the account first in <b>Users & Access</b>. If the role is Dentist or clinic Staff, the system automatically creates the linked personnel profile here. <b>Active</b> comes from the user account; <b>Available</b> is the operational scheduling status.</Notice>
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
        <Field label="Branch"><select value={editDentist.branches[0]} onChange={e=>setEditDentist({...editDentist,branches:[e.target.value]})}>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Assistant"><input value={editDentist.assistant||''} onChange={e=>setEditDentist({...editDentist,assistant:e.target.value})}/></Field>
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
        <Field label="Branch"><select value={editStaff.branch} onChange={e=>setEditStaff({...editStaff,branch:e.target.value})}><option>All Branches</option>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
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
      <Card title="Report actions" subtitle="Frontend-only demonstration"><div className="action-stack"><Button onClick={()=>makeCsv('dentalops-branch-capacity.csv',exportRows)}>Export Branch Capacity CSV</Button><Button variant="ghost" onClick={()=>makeCsv('dentalops-hmo-report.csv',hmo.map(x=>({Patient:patientName(x.patientId,state.patients),Provider:x.provider,Branch:x.branch,Status:x.status,PendingHours:x.pendingHours,Reference:x.reference||''})))}>Export HMO CSV</Button><Notice tone="info">A real backend would calculate approved KPI definitions from persisted operational events. This prototype demonstrates the final filtering, reporting, and export experience.</Notice></div></Card>
    </div>
  </>
}

export function UsersPage({ store }) {
  const { state, setters, toast, log, workflow }=store
  const [form,setForm]=useState({name:'',username:'',email:'',roleName:'Receptionist',branchId:'b1',accountStatus:'Active'})
  const permissionMap={
    Receptionist:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'],
    Dentist:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'],
    'Dental Assistant':['queue','clinical-records'],
    'HMO Coordinator':['hmo','patient-demographics','messages'],
    Cashier:['billing','patient-demographics'],
    'Patient Engagement Staff':['inquiries','messages','engagement'],
    'Owner / Admin':['all']
  }
  const staffRoles=new Set(['Receptionist','Dental Assistant','HMO Coordinator','Cashier','Patient Engagement Staff'])
  const branchName=branchId=>state.branches.find(b=>b.id===branchId)?.name||'All Branches'
  const profileSync=u=>{
    if(u.roleName==='Dentist') return state.dentists.some(d=>d.userId===u.id)?'Dentist profile linked':'Missing profile'
    if(staffRoles.has(u.roleName)) return state.staff.some(s=>s.userId===u.id)?'Staff profile linked':'Missing profile'
    return 'Not required'
  }
  const add=()=>{
    const name=form.name.trim(), username=form.username.trim(), email=form.email.trim().toLowerCase()
    if(!name||!username||!email)return toast('Display name, username, and email are required.','warning')
    if(state.users.some(u=>(u.username||u.login).toLowerCase()===username.toLowerCase()))return toast('Username must be unique.','warning')
    if(state.users.some(u=>(u.email||'').toLowerCase()===email))return toast('Email must be unique.','warning')
    const id=uid('u')
    const roleName=form.roleName
    const selectedBranch=roleName==='Owner / Admin'?'All Branches':branchName(form.branchId)
    const selectedBranchId=roleName==='Owner / Admin'?null:form.branchId
    const u={
      id,name,username,login:username,email,roleName,role:roleName,
      branchId:selectedBranchId,branch:selectedBranch,
      accountStatus:form.accountStatus,status:form.accountStatus,
      permissions:permissionMap[roleName]||[],lastLogin:'Never'
    }
    setters.setUsers(xs=>[...xs,u])

    if(roleName==='Dentist'){
      const b=state.branches.find(x=>x.id===selectedBranchId)
      setters.setDentists(xs=>[...xs,{
        id:uid('d'),userId:id,staffType:'Dentist',licenseNo:'',name,
        branches:[selectedBranch],specialty:'Unspecified',shiftStart:b?.open||'09:00',shiftEnd:b?.close||'18:00',
        available:form.accountStatus==='Active',assistant:'Unassigned'
      }])
      workflow('M1→M3','User account created / role synchronized',`${username} • Dentist STAFF_PROFILES record created`)
    } else if(staffRoles.has(roleName)){
      const b=state.branches.find(x=>x.id===selectedBranchId)
      setters.setStaff(xs=>[...xs,{
        id:uid('s'),userId:id,staffType:roleName,licenseNo:'—',specialization:roleName,
        name,role:roleName,branch:selectedBranch,shiftStart:b?.open||'09:00',shiftEnd:b?.close||'18:00',
        available:form.accountStatus==='Active'
      }])
      workflow('M1→M3','User account created / role synchronized',`${username} • Staff STAFF_PROFILES record created`)
    }

    log(ROLE_INFO.owner.name,`Created user ${username} (${roleName})`,'M1')
    toast(roleName==='Owner / Admin'?'Owner/Admin account created.':'User account created and personnel profile synchronized.','success')
    setForm({name:'',username:'',email:'',roleName:'Receptionist',branchId:'b1',accountStatus:'Active'})
  }
  const toggle=u=>{
    const current=u.accountStatus||u.status
    const next=current==='Active'?'Inactive':'Active'
    setters.setUsers(xs=>xs.map(x=>x.id===u.id?{...x,accountStatus:next,status:next}:x))
    workflow('M1→M3','Account status changed',`${u.username||u.login} • ${next} • linked availability recalculated`)
    log(ROLE_INFO.owner.name,`${next==='Active'?'Activated':'Deactivated'} user ${u.username||u.login}`,'M1')
    toast('Account status updated and linked personnel availability recalculated.','success')
  }
  return <>
    <PageHeader title="User, Role & Access Management" text="Owner/Admin creates the clinic user account here. The form now follows the ERD USERS fields and automatically synchronizes Dentist/Staff accounts into Module 3." modules={[1]}/>
    <Notice tone="info" title="ERD mapping">USERS uses <b>branch_id, username, email, role_name, account_status</b>. The prototype also keeps a display name for the UI; the backend ERD should add a name/profile field if that value must be persisted.</Notice>
    <div className="grid-2 top-gap">
      <Card title="Create user account" subtitle="Account creation happens here under the Owner/Admin UI">
        <div className="form-grid">
          <Field label="Display / full name" required hint="Frontend profile label; not currently a USERS column in the ERD"><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
          <Field label="Username" required hint="USERS.username • unique"><input value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/></Field>
          <Field label="Email" required hint="USERS.email • unique"><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
          <Field label="Role name" hint="USERS.role_name"><select value={form.roleName} onChange={e=>setForm({...form,roleName:e.target.value,branchId:e.target.value==='Owner / Admin'?'':form.branchId||'b1'})}>{Object.keys(permissionMap).map(r=><option key={r}>{r}</option>)}</select></Field>
          <Field label="Branch access" hint="USERS.branch_id"><select disabled={form.roleName==='Owner / Admin'} value={form.roleName==='Owner / Admin'?'':form.branchId} onChange={e=>setForm({...form,branchId:e.target.value})}>{form.roleName==='Owner / Admin'?<option value="">All Branches</option>:state.branches.map(b=><option key={b.id} value={b.id}>{b.branchCode} • {b.name}</option>)}</select></Field>
          <Field label="Account status" hint="USERS.account_status"><select value={form.accountStatus} onChange={e=>setForm({...form,accountStatus:e.target.value})}><option>Active</option><option>Inactive</option></select></Field>
          <Button className="span-2" onClick={add}>Create Account & Synchronize Profile</Button>
        </div>
      </Card>
      <Card title="Permission profiles"><div className="permission-list">{Object.entries(permissionMap).map(([role,perms])=><div key={role}><b>{role}</b><span>{perms.join(' • ')}</span></div>)}</div></Card>
    </div>
    <Card className="top-gap" title="Authorized users" subtitle="Dentist and clinic-staff accounts automatically link to STAFF_PROFILES (Module 3).">
      <Table rows={state.users} columns={[
        {key:'name',label:'Display name'},
        {key:'username',label:'Username',render:u=>u.username||u.login},
        {key:'email',label:'Email',render:u=>u.email||'—'},
        {key:'roleName',label:'Role name',render:u=>u.roleName||u.role},
        {key:'branch',label:'Branch access'},
        {key:'permissions',label:'Permission scope',render:u=><span className="permissions-cell">{u.permissions.join(', ')}</span>},
        {key:'profile',label:'M3 profile',render:u=>profileSync({...u,roleName:u.roleName||u.role})},
        {key:'status',label:'Account status',render:u=><Status>{u.accountStatus||u.status}</Status>},
        {key:'action',label:'Action',render:u=>(u.roleName||u.role)!=='Owner / Admin'?<Button size="sm" variant={(u.accountStatus||u.status)==='Active'?'danger':'ghost'} onClick={()=>toggle(u)}>{(u.accountStatus||u.status)==='Active'?'Deactivate':'Activate'}</Button>:null}
      ]}/>
    </Card>
  </>
}

export function AutomationPage({ store }) {
  const { state, setters, toast, log }=store
  const toggle=r=>{
    setters.setAutomations(xs=>xs.map(x=>x.id===r.id?{...x,enabled:!x.enabled,isActive:!x.enabled}:x))
    log(ROLE_INFO.owner.name,`${r.enabled?'Disabled':'Enabled'} automation ${r.id}`,'M23')
    toast('Automation rule status updated.','success')
  }
  return <>
    <PageHeader title="Integrated Workflow & Automation Control" text="ERD-aligned control view: WORKFLOW_RULES define triggers/targets, while SYSTEM_EVENTS and AUTOMATED_ACTIONS form the execution history shown below." modules={[23]}/>
    <Card title="Automation rules" subtitle="Input/reference logic from WORKFLOW_RULES">
      <Table rows={state.automations} columns={[
        {key:'event',label:'Workflow event'},
        {key:'triggerEvent',label:'Trigger event'},
        {key:'targetModule',label:'Target module'},
        {key:'condition',label:'Rule condition'},
        {key:'action',label:'Target action'},
        {key:'result',label:'Last result',render:r=><Status>{r.lastResult}</Status>},
        {key:'enabled',label:'Active',render:r=><Status>{r.enabled?'Active':'Inactive'}</Status>},
        {key:'action2',label:'Control',render:r=><Button size="sm" variant="ghost" onClick={()=>toggle(r)}>{r.enabled?'Disable':'Enable'}</Button>}
      ]}/>
    </Card>
    <Card className="top-gap" title="Central automation activity feed" subtitle="Output/history view combining SYSTEM_EVENTS and AUTOMATED_ACTIONS">
      <Table rows={state.workflowLog} columns={[
        {key:'at',label:'Time'},
        {key:'module',label:'Source / target module'},
        {key:'event',label:'System event'},
        {key:'result',label:'Automated action / execution result'},
        {key:'status',label:'Execution state',render:r=><Status>{r.status}</Status>}
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
      if(duplicate)return toast('Duplicate reward prevented by the prototype rule.','warning')
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
      <div className="grid-2"><Card title="Create optional campaign"><div className="form-grid"><Field label="Campaign name"><input value={campaign.name} onChange={e=>setCampaign({...campaign,name:e.target.value})}/></Field><Field label="Type"><select value={campaign.type} onChange={e=>setCampaign({...campaign,type:e.target.value})}><option>Reactivation</option><option>Feedback</option><option>Engagement</option></select></Field><Field label="Target patient group"><input value={campaign.audience} onChange={e=>setCampaign({...campaign,audience:e.target.value})}/></Field><Field label="Channel"><select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})}><option>SMS</option><option>Portal</option><option>Email</option></select></Field><Field label="Scheduled outreach"><input value={campaign.scheduled} onChange={e=>setCampaign({...campaign,scheduled:e.target.value})}/></Field><Button onClick={createCampaign}>Create Draft Campaign</Button></div></Card><Card title="PE boundaries"><Notice tone="info">Operational confirmations, queue notices, delay updates, and follow-up reminders belong to Module 18. Marketing/reactivation outreach belongs here in Module 25.</Notice></Card></div>
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
