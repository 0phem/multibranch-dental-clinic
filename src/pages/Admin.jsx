import { pendingHours } from '../phase3-contracts.js'
import { automationSnapshot } from '../orchestration.js'
import React, { useMemo, useRef, useState } from 'react'
import { MODULES, ROLE_INFO } from '../data.js'
import { LOYALTY_PROGRAM, canManageLoyalty, ledgerIssue } from '../loyalty.js'
import { Button, Card, ConfirmDialog, Field, Modal, Notice, PageHeader, Progress, StatCard, Status, Table, Tabs } from '../components.jsx'
import { branchCapacity, dateLabel, dentistName, makeCsv, patientName, peso, uid } from '../logic.js'
import { syncBranchUpdate, syncBranchServiceToggle, syncPersonnelUpdate } from '../reference-data-bridge.js'
import { createUserAccountRemote, deleteUserAccountRemote, fetchUserAccounts, updateUserAccountRemote } from '../user-management-bridge.js'
import { DEFAULT_COUNTRY, normalizePhoneNumber, sanitizePhoneInput } from '../phone.js'

export function BranchesPage({ store }) {
  const { state, actions, toast }=store
  const [selected,setSelected]=useState(state.branches[0]?.id||'')
  const branch=state.branches.find(b=>b.id===selected)
  const [form,setForm]=useState(branch||{})
  React.useEffect(()=>setForm(branch||{}),[selected])
  // Phase 2A: branches/branchServices are backend-authoritative — the API call happens first, and only its
  // confirmed response is adopted into local state (never an optimistic local success ahead of the
  // server). See adoptBranchFromServer/adoptBranchServiceFromServer (administration.js) and the Phase 2A
  // plan, section J/point 8.
  const save=async()=>{
    const result=await syncBranchUpdate(selected,form)
    if(!result.ok)return toast(result.message||'Could not save branch changes.','warning')
    const adopted=actions.adoptBranchFromServer(selected,result.record)
    toast(adopted.ok?'Branch configuration saved.':adopted.message,adopted.ok?'success':'warning')
  }
  const serviceActive=serviceId=>state.branchServices.some(bs=>bs.branchId===selected&&bs.serviceId===serviceId&&bs.active!==false)
  const toggleService=async serviceId=>{
    const result=await syncBranchServiceToggle(selected,serviceId,!serviceActive(serviceId))
    if(!result.ok)return toast(result.message||'Could not update service availability.','warning')
    const adopted=actions.adoptBranchServiceFromServer(selected,serviceId,result.record)
    if(!adopted.ok)toast(adopted.message,'warning')
  }
  return <>
    <PageHeader title="Multi-Branch Clinic Management" text="ERD-aligned branch identity plus the operating data required by scheduling, staffing, patient flow, and reporting." modules={[2]}/>
    <div className="grid-2 admin-config">
      <Card title="Branches" subtitle="Branch identity, location, hours, status, and capacity">
        <div className="branch-selector">{state.branches.map(b=><button key={b.id} className={selected===b.id?'selected':''} onClick={()=>setSelected(b.id)}><div><b>{b.name}</b><small>{b.branchCode} • {b.city}</small></div><Status>{b.status}</Status></button>)}</div>
      </Card>
      {branch&&<Card title={`Configure ${branch.name}`}><div className="form-grid">
        <Field label="Branch name"><input value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></Field>
        <Field label="Branch code"><input value={form.branchCode||''} onChange={e=>setForm({...form,branchCode:e.target.value})}/></Field>
        <Field label="City"><input value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}/></Field>
        <Field label="Branch status"><select value={form.status||'Open'} onChange={e=>setForm({...form,status:e.target.value})}><option>Open</option><option>Temporarily Closed</option><option>Inactive</option></select></Field>
        <Field label="Opening time"><input type="time" value={form.open||'09:00'} onChange={e=>setForm({...form,open:e.target.value})}/></Field>
        <Field label="Closing time"><input type="time" value={form.close||'18:00'} onChange={e=>setForm({...form,close:e.target.value})}/></Field>
        <Field label="Capacity threshold"><input type="number" min="40" max="100" value={form.threshold||80} onChange={e=>setForm({...form,threshold:Number(e.target.value)})}/></Field>
        <Field label="Phone"><input value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></Field>
        <Field label="Address"><textarea value={form.address||''} onChange={e=>setForm({...form,address:e.target.value})}/></Field>
        <div className="span-2"><label className="field-label">Available services <small>Branch services • scheduling reads this catalog directly</small></label><div className="permission-list">{state.services.filter(s=>s.status==='Active').map(service=><label className="check-control" key={service.id}><input type="checkbox" checked={serviceActive(service.id)} onChange={()=>toggleService(service.id)}/><span><b>{service.name}</b><small>{service.category} • {service.duration} min • {peso.format(service.baseFee)}</small></span></label>)}</div></div>
        <Button className="span-2" onClick={save}>Publish Branch Changes</Button>
      </div></Card>}
    </div>
  </>
}

export function TeamPage({ store }) {
  const { state, actions, toast }=store
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
  // Phase 2A: dentist/staff profiles are backend-authoritative — same API-first, adopt-confirmed-response
  // pattern as BranchesPage's save/toggleService above.
  const saveDentist=async()=>{
    const result=await syncPersonnelUpdate('dentists',editDentist?.id,editDentist)
    if(!result.ok)return toast(result.message||'Could not save personnel changes.','warning')
    const adopted=actions.adoptPersonnelFromServer('dentists',editDentist.id,result.record)
    if(!adopted.ok)return toast(adopted.message,'warning')
    toast('Personnel changes saved.','success');setEditDentist(null)
  }
  const saveStaff=async()=>{
    const result=await syncPersonnelUpdate('staff',editStaff?.id,editStaff)
    if(!result.ok)return toast(result.message||'Could not save personnel changes.','warning')
    const adopted=actions.adoptPersonnelFromServer('staff',editStaff.id,result.record)
    if(!adopted.ok)return toast(adopted.message,'warning')
    toast('Personnel changes saved.','success');setEditStaff(null)
  }

  return <>
    <PageHeader title="Dentist & Staff Management" text="Personnel records are linked to account access. This screen manages Staff and Dentist profiles, operational shifts, branch assignments, and availability used by scheduling and capacity workflows." modules={[3,15]}/>
    <Notice tone="info" title="Account & personnel synchronization">Create the account first in <b>Access & Roles</b>. Dentist and staff accounts automatically receive a linked personnel profile here. <b>Active</b> comes from the account; <b>Available</b> reflects operational scheduling status.</Notice>
    <Tabs tabs={[{key:'dentists',label:'Dentists',count:state.dentists.length},{key:'staff',label:'Staff',count:state.staff.length}]} active={tab} onChange={setTab}/>
    {tab==='dentists'?<Card title="Dentist profiles & availability" subtitle="License Number • Specialty • Linked Account • Operational availability">
      <Table rows={state.dentists} columns={[
        {key:'name',label:'Dentist'},
        {key:'userId',label:'Linked Account'},
        {key:'licenseNo',label:'License Number'},
        {key:'specialty',label:'Specialty'},
        {key:'branches',label:'Branch assignment',render:d=>d.branches.join(', ')},
        {key:'shift',label:'Shift',render:d=>`${d.shiftStart}–${d.shiftEnd}`},
        {key:'active',label:'Active',render:d=><Status>{accountStatus(d)}</Status>},
        {key:'availability',label:'Available',render:d=><Status>{availableStatus(d)}</Status>},
        {key:'action',label:'Action',render:d=><Button size="sm" variant="ghost" onClick={()=>setEditDentist({...d})}>Edit Profile</Button>}
      ]}/>
    </Card>:<Card title="Clinic Staff profiles" subtitle="Every row is linked to its account when account access exists">
      <Table rows={state.staff} columns={[
        {key:'name',label:'Staff member'},
        {key:'userId',label:'Linked Account'},
        {key:'staffType',label:'Staff title'},
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
        <Field label="Professional role"><input value={editDentist.staffType||'Dentist'} disabled/></Field>
        <Field label="License Number"><input value={editDentist.licenseNo||''} onChange={e=>setEditDentist({...editDentist,licenseNo:e.target.value})}/></Field>
        <Field label="Specialty"><input value={editDentist.specialty||''} onChange={e=>setEditDentist({...editDentist,specialty:e.target.value})}/></Field>
        <Field label="Branch"><select value={editDentist.branches[0]} onChange={e=>setEditDentist({...editDentist,branches:[e.target.value],branchIds:[state.branches.find(b=>b.name===e.target.value)?.id]})}>{state.branches.map(b=><option key={b.id}>{b.name}</option>)}</select></Field>
        <Field label="Assistant"><select value={editDentist.assistantStaffId||''} onChange={e=>setEditDentist({...editDentist,assistantStaffId:e.target.value||null})}><option value="">Unassigned</option>{state.staff.filter(s=>s.staffType==='Dental Assistant').map(a=><option key={a.id} value={a.id}>{a.name} • {a.branch}</option>)}</select></Field>
        <Field label="Shift start"><input type="time" value={editDentist.shiftStart} onChange={e=>setEditDentist({...editDentist,shiftStart:e.target.value})}/></Field>
        <Field label="Shift end"><input type="time" value={editDentist.shiftEnd} onChange={e=>setEditDentist({...editDentist,shiftEnd:e.target.value})}/></Field>
        <label className="check-control span-2"><input type="checkbox" checked={!!editDentist.available} onChange={e=>setEditDentist({...editDentist,available:e.target.checked})}/><span><b>Available for scheduling</b><small>Active account status is controlled in Users & Access; availability is synchronized to scheduling/workload.</small></span></label>
        {branchConflict(editDentist)&&<Notice tone="warning">Current shift conflicts with the selected branch operating hours.</Notice>}
        <Button className="span-2" onClick={saveDentist}>Save & Synchronize Profile</Button>
      </div>}
    </Modal>

    <Modal open={!!editStaff} onClose={()=>setEditStaff(null)} title="Edit staff profile" subtitle="Update the Staff title, branch assignment, shift, and operational availability used by scheduling.">
      {editStaff&&<div className="form-grid">
        <Field label="User / display name" hint={`Linked user: ${editStaff.userId}`}><input value={editStaff.name} disabled/></Field>
        <Field label="Staff title"><input value={editStaff.staffType||''} onChange={e=>setEditStaff({...editStaff,staffType:e.target.value})}/></Field>
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
      <Card title="Report actions" subtitle="Report exports"><div className="action-stack"><Button onClick={()=>makeCsv('branch-capacity.csv',exportRows)}>Export Branch Capacity CSV</Button><Button variant="ghost" onClick={()=>makeCsv('hmo-report.csv',hmo.map(x=>({Patient:patientName(x.patientId,state.patients),Provider:x.provider,Branch:x.branch,Status:x.status,PendingHours:pendingHours(x,state.clock),Reference:x.reference||''})))}>Export HMO CSV</Button><Notice tone="info">Reports are prepared from operational records and can be filtered by branch and reporting period.</Notice></div></Card>
    </div>
  </>
}

export function UsersPage({ store }) {
  const { toast }=store
  const empty={firstName:'',lastName:'',phone:'',email:'',role:'patient',password:'',passwordConfirmation:''}
  const [form,setForm]=useState(empty)
  const [phoneLocal,setPhoneLocal]=useState('')
  const [records,setRecords]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [edit,setEdit]=useState(null)
  const [editPhoneLocal,setEditPhoneLocal]=useState('')
  const [deleteTarget,setDeleteTarget]=useState(null)
  const localPhone=value=>{
    const digits=String(value||'').replace(/\D/g,'')
    if(digits.startsWith('63'))return digits.slice(2,12)
    if(digits.startsWith('0'))return digits.slice(1,11)
    return digits.slice(0,DEFAULT_COUNTRY.digits)
  }
  const load=async()=>{
    setLoading(true);setError('')
    const result=await fetchUserAccounts()
    if(result.ok)setRecords(result.records)
    else setError(result.message||'Could not load user accounts.')
    setLoading(false)
  }
  React.useEffect(()=>{load()},[])
  const add=async()=>{
    const phone=phoneLocal?normalizePhoneNumber(DEFAULT_COUNTRY.dial,phoneLocal):{ok:true,e164:''}
    if(!phone.ok)return toast(phone.reason,'warning')
    setSubmitting(true)
    const result=await createUserAccountRemote({...form,phone:phone.e164})
    setSubmitting(false)
    if(!result.ok)return toast(result.message||'Could not create the Patient account.','warning')
    setRecords(rows=>[...rows,result.record]);setForm(empty);setPhoneLocal('')
    toast('Patient account created.','success')
  }
  const saveEdit=async()=>{
    if(!edit)return
    const phone=editPhoneLocal?normalizePhoneNumber(DEFAULT_COUNTRY.dial,editPhoneLocal):{ok:true,e164:''}
    if(!phone.ok)return toast(phone.reason,'warning')
    setSubmitting(true)
    const result=await updateUserAccountRemote(edit.id,{...edit,phone:phone.e164})
    setSubmitting(false)
    if(!result.ok)return toast(result.message||'Could not save account information.','warning')
    setRecords(rows=>rows.map(row=>row.id===edit.id?result.record:row));setEdit(null)
    toast('Account information saved.','success')
  }
  const remove=async()=>{
    if(!deleteTarget)return
    setSubmitting(true)
    const result=await deleteUserAccountRemote(deleteTarget.id)
    setSubmitting(false)
    if(!result.ok){setDeleteTarget(null);return toast(result.message||'Could not delete this account.','warning')}
    setRecords(rows=>rows.filter(row=>row.id!==deleteTarget.id));setDeleteTarget(null)
    toast('User account deleted.','success')
  }
  return <>
    <PageHeader title="User Management" text="Manage user accounts, roles, and account information." modules={[1]}/>
    <Notice tone="info" title="Current scope">Patient accounts can be created here. Staff and Dentist account creation is unavailable until profile provisioning is migrated. Roles are read-only after creation.</Notice>
    <div className="grid-2 top-gap">
      <Card title="Create user account" subtitle="Create a Patient login with the clinic’s standard account security.">
        <div className="form-grid">
          <Field label="First name" required><input value={form.firstName} onChange={e=>setForm({...form,firstName:e.target.value})}/></Field>
          <Field label="Last name" required><input value={form.lastName} onChange={e=>setForm({...form,lastName:e.target.value})}/></Field>
          <Field label="Mobile number" hint={`Enter 10 digits after ${DEFAULT_COUNTRY.dial}, for example 9171234567.`}><div className="phone-field"><span className="phone-field-code" aria-hidden="true">{DEFAULT_COUNTRY.dial}</span><input type="tel" inputMode="numeric" aria-label="Mobile number" className="phone-field-number" placeholder="9171234567" maxLength={DEFAULT_COUNTRY.digits} value={phoneLocal} onChange={e=>setPhoneLocal(sanitizePhoneInput(e.target.value))}/></div></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field>
          <Field label="Role"><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="patient">Patient</option><option value="staff" disabled>Staff (temporarily unavailable)</option><option value="dentist" disabled>Dentist (temporarily unavailable)</option></select></Field>
          <Field label="Initial Password" required hint="At least 8 characters with letters and numbers."><input type="password" autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></Field>
          <Field label="Confirm Password" required><input type="password" autoComplete="new-password" value={form.passwordConfirmation} onChange={e=>setForm({...form,passwordConfirmation:e.target.value})}/></Field>
          <Button className="span-2" onClick={add} disabled={submitting}>{submitting?'Creating…':'Create Patient Account'}</Button>
        </div>
      </Card>
      <Card title="Account roles" subtitle="Roles are authorization categories. Staff job titles are maintained separately in personnel management."><div className="permission-list"><div><b>Patient</b><span>Patient portal access</span></div><div><b>Staff</b><span>Creation deferred pending profile provisioning</span></div><div><b>Dentist</b><span>Creation deferred pending profile provisioning</span></div></div></Card>
    </div>
    <Card className="top-gap" title="User accounts" subtitle="Only real backend login accounts appear here.">
      {loading?<p className="muted-copy" role="status">Loading user accounts…</p>:error?<Notice tone="warning" title="Couldn’t load user accounts">{error}<Button size="sm" variant="ghost" onClick={load}>Try again</Button></Notice>:<Table rows={records} caption="User accounts" columns={[
        {key:'name',label:'Name'}, {key:'email',label:'Email'}, {key:'phone',label:'Phone',render:u=>u.phone||'—'},
        {key:'role',label:'Role',render:u=>u.role==='owner'?'Owner':u.role==='dentist'?'Dentist':u.role==='staff'?'Staff':'Patient'},
        {key:'action',label:'Actions',render:u=><div className="row-actions"><Button size="sm" variant="ghost" onClick={()=>{setEdit({...u});setEditPhoneLocal(localPhone(u.phone))}}>Edit</Button><Button size="sm" variant="danger" onClick={()=>setDeleteTarget(u)}>Delete</Button></div>}
      ]}/>}
    </Card>
    <Modal open={!!edit} onClose={()=>setEdit(null)} title="Edit user account" subtitle="Role and personnel information are read-only here.">
      {edit&&<div className="form-grid"><Field label="First name" required><input value={edit.firstName} onChange={e=>setEdit({...edit,firstName:e.target.value})}/></Field><Field label="Last name" required><input value={edit.lastName} onChange={e=>setEdit({...edit,lastName:e.target.value})}/></Field><Field label="Email" required><input type="email" value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field><Field label="Mobile number" hint={`Enter 10 digits after ${DEFAULT_COUNTRY.dial}, or leave blank.`}><div className="phone-field"><span className="phone-field-code" aria-hidden="true">{DEFAULT_COUNTRY.dial}</span><input type="tel" inputMode="numeric" aria-label="Mobile number" className="phone-field-number" placeholder="9171234567" maxLength={DEFAULT_COUNTRY.digits} value={editPhoneLocal} onChange={e=>setEditPhoneLocal(sanitizePhoneInput(e.target.value))}/></div></Field><Field label="Role" hint="Role cannot be changed from User Management."><input value={edit.role==='owner'?'Owner':edit.role==='dentist'?'Dentist':edit.role==='staff'?'Staff':'Patient'} readOnly disabled aria-label="Role"/></Field><Button className="span-2" onClick={saveEdit} disabled={submitting}>{submitting?'Saving…':'Save Account Information'}</Button></div>}
    </Modal>
    <ConfirmDialog open={!!deleteTarget} title="Delete user account" onCancel={()=>setDeleteTarget(null)} onConfirm={remove} confirmLabel="Delete account"><p>Delete access for <b>{deleteTarget?.name}</b>? The account will be removed from login while the person and clinical records remain preserved.</p></ConfirmDialog>
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
  const { state, setters, actions, toast, log, session }=store
  const [tab,setTab]=useState('loyalty')
  const [campaign,setCampaign]=useState({name:'',type:'Reactivation',audience:'Patients overdue for routine recall',channel:'SMS',scheduled:'2026-09-25 09:00'})
  const patients=state.patients.filter(p=>canManageLoyalty(state,session,p.id))
  const accounts=Array.isArray(state.loyalty)?state.loyalty.filter(l=>canManageLoyalty(state,session,l?.patientId)):[]
  const [loyaltyForm,setLoyaltyForm]=useState({patientId:patients[0]?.id||'',activity:'Qualified Visit',points:20})
  const recordCommand=useRef({key:'',id:''})
  const createCampaign=()=>{if(!campaign.name)return toast('Enter a campaign name.','warning');setters.setCampaigns(xs=>[{id:uid('camp'),...campaign,status:'Draft',responses:0,reactivated:0},...xs]);log(role==='owner'?ROLE_INFO.owner.name:ROLE_INFO.staff.name,'Created optional engagement campaign','M25');toast('Campaign draft created. Nothing is sent.','success');setCampaign({...campaign,name:''})}
  // M24 writes go through the shared commands, which validate the session, scope, ledger and replay.
  const applyLoyalty=()=>{
    // One command ID per form values and ledger state: a rapid second click replays it instead of recording twice.
    const size=accounts.find(l=>l.patientId===loyaltyForm.patientId)?.history?.length??0, key=`${loyaltyForm.patientId}|${loyaltyForm.activity}|${loyaltyForm.points}|${size}`
    if(recordCommand.current.key!==key)recordCommand.current={key,id:uid('loyalty')}
    const result=actions.recordLoyaltyActivity({patientId:loyaltyForm.patientId,activity:loyaltyForm.activity,points:Number(loyaltyForm.points)},recordCommand.current.id)
    if(!result.ok)return toast(result.message,'warning')
    toast(result.unchanged?'This activity was already recorded.':'Qualified activity recorded and loyalty balance updated once.','success')
  }
  const pendingOf=l=>Array.isArray(l.history)?l.history.find(h=>h?.type==='Redemption Request'&&h.status==='Pending'):null
  const processRedemption=l=>{
    const pending=pendingOf(l)
    if(!pending)return
    const result=actions.processLoyaltyRedemption(l.id,`process:${pending.id||`${l.id}:${l.history.length}`}`)
    if(!result.ok)return toast(result.message,'warning')
    toast(result.unchanged?'This redemption was already processed.':'Redemption processed and loyalty balance updated.','success')
  }
  return <>
    <PageHeader title="Patient Engagement" text="Referral & loyalty administration, and the preview of optional marketing and reactivation campaigns, kept separate from core clinic operations." modules={[24,25]}/>
    <Notice tone="info" title="Approved frontend enhancements">Referral & Loyalty (M24) is implemented as a team-designed prototype program approved for demonstration; it is not an established clinic program. Marketing & Reactivation (M25) is approved; only a limited campaign-draft preview exists today, and full management is planned for a later phase. Neither blocks core care operations.</Notice>
    <Tabs tabs={[{key:'loyalty',label:'Referral & Loyalty • M24'},{key:'campaigns',label:'Marketing & Reactivation • M25'}]} active={tab} onChange={setTab}/>
    {tab==='loyalty'?<>
      <div className="grid-2">
        <Card title="Record qualified referral / loyalty activity" subtitle="Validates activity before applying a configured reward once"><div className="form-grid"><Field label="Patient"><select value={loyaltyForm.patientId} onChange={e=>setLoyaltyForm({...loyaltyForm,patientId:e.target.value})}>{patients.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field><Field label="Activity"><select value={loyaltyForm.activity} onChange={e=>setLoyaltyForm({...loyaltyForm,activity:e.target.value})}><option>Qualified Visit</option><option>Qualified Referral</option></select></Field><Field label="Reward / points"><input type="number" min="1" step="1" value={loyaltyForm.points} onChange={e=>setLoyaltyForm({...loyaltyForm,points:e.target.value})}/></Field><Button onClick={applyLoyalty}>Validate & Apply Reward Once</Button></div></Card>
        <Card title="Referral & loyalty rules"><Notice tone="info">Prototype rules designed by the project team, not historical clinic policy: a Patient can request a {LOYALTY_PROGRAM.redemptionThreshold}-point reward once they have {LOYALTY_PROGRAM.redemptionThreshold} points, only one request can be Pending at a time, and each request is processed once. Points must be whole positive numbers (a prototype validation rule) and are recorded here after a qualified visit or referral. Recording a Patient’s first qualified activity creates their loyalty account and referral code. The reward itself is not defined in this prototype, and referred-Patient tracking is not yet modeled. Actual reward rules would be server-controlled in production.</Notice></Card>
      </div>
      <Card className="top-gap" title="Loyalty accounts"><Table rows={accounts} columns={[{key:'patient',label:'Patient',render:l=>patientName(l.patientId,state.patients)},{key:'code',label:'Referral code',render:l=>l.referralCode},{key:'points',label:'Balance',render:l=>ledgerIssue(l)?'Under review':`${l.points} pts`},{key:'history',label:'Latest activity',render:l=>Array.isArray(l.history)&&l.history[0]?`${l.history[0].type} • ${l.history[0].at}`:'—'},{key:'action',label:'Redemption',render:l=>pendingOf(l)&&!ledgerIssue(l)?<Button size="sm" onClick={()=>processRedemption(l)}>Process request</Button>:'—'}]} /></Card>
    </>:<>
      <div className="grid-2"><Card title="Campaign draft (preview)"><div className="form-grid"><Field label="Campaign name"><input value={campaign.name} onChange={e=>setCampaign({...campaign,name:e.target.value})}/></Field><Field label="Type"><select value={campaign.type} onChange={e=>setCampaign({...campaign,type:e.target.value})}><option>Reactivation</option><option>Feedback</option><option>Engagement</option></select></Field><Field label="Target patient group"><input value={campaign.audience} onChange={e=>setCampaign({...campaign,audience:e.target.value})}/></Field><Field label="Channel"><select value={campaign.channel} onChange={e=>setCampaign({...campaign,channel:e.target.value})}><option>SMS</option><option>Portal</option><option>Email</option></select></Field><Field label="Scheduled outreach"><input value={campaign.scheduled} onChange={e=>setCampaign({...campaign,scheduled:e.target.value})}/></Field><Button onClick={createCampaign}>Create Draft Campaign</Button></div></Card><Card title="Campaign boundaries"><Notice tone="info">Campaign management, targeting and consent rules are planned for a later phase; this draft form is a preview and sends nothing. Operational confirmations, queue notices, delay updates, and follow-up reminders stay separate from marketing and reactivation outreach.</Notice></Card></div>
      <Card className="top-gap" title="Campaigns"><Table rows={state.campaigns} columns={[{key:'name',label:'Campaign'},{key:'type',label:'Type'},{key:'audience',label:'Audience'},{key:'channel',label:'Channel'},{key:'scheduled',label:'Schedule'},{key:'responses',label:'Responses / feedback'},{key:'reactivated',label:'Reactivated'},{key:'status',label:'Status',render:c=><Status>{c.status}</Status>}]} /></Card>
    </>}
  </>
}

export function ModulesPage() {
  const [area,setArea]=useState('All')
  const areas=['All',...new Set(MODULES.map(m=>m.area))]
  const visible=MODULES.filter(m=>area==='All'||m.area===area)
  return <>
    <PageHeader title="25-Module UI Coverage" text="Professor-facing traceability view showing where every documented process is represented in the frontend prototype." modules={[]}/>
    <div className="module-summary"><div><b>25</b><span>Documented modules</span></div><div><b>4</b><span>Main role experiences</span></div><div><b>2</b><span>Approved enhancements</span></div></div>
    <div className="tabs top-gap">{areas.map(a=><button className={area===a?'active':''} key={a} onClick={()=>setArea(a)}>{a}</button>)}</div>
    <div className="module-grid">{visible.map(m=><div className="module-tile" key={m.no}><div className="module-tile-top"><span className="module-badge">M{m.no}{m.enhancement?' • Approved enhancement':''}</span><span>{m.area}</span></div><strong>{m.name}</strong><small>Module owner: {m.owner}</small><div className="role-tags">{m.roles.map(r=><span key={r}>{r==='owner'?'Owner/Admin':r[0].toUpperCase()+r.slice(1)}</span>)}</div><div className="coverage-state">{m.enhancement?(m.implemented?'✓ Implemented prototype (approved enhancement)':m.preview?'Approved enhancement — limited preview; full implementation deferred':'Approved enhancement'):'✓ Represented in final UI'}</div></div>)}</div>
  </>
}
