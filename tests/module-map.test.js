import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { serverAppointment } from './support/server-appointments.js'
import { DOMAIN_MODULE, LEGACY_MODULE_DOMAIN, eventModuleLabel, legacyModuleDomains, recordDomains, ruleTargetLabel } from '../src/module-map.js'

setClockSource(()=>new Date('2026-09-19T02:08:00Z'))
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
function fixture() {
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([key,name])=>[key,structuredClone(data[`INITIAL_${name}`])]))
  let state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[]})
  const session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:patch=>{state=normalizeClinicState({...state,...patch})}})
  return {actions,get state(){return state},addAppointment:row=>{state=normalizeClinicState({...state,appointments:[...state.appointments,row]})}}
}
const ok=result=>{assert.equal(result.ok,true,result.message);return result.record}

const CANONICAL=[
  [1,'User & Access Management','Licanda'],[2,'Multi-Branch Clinic Management','Licanda'],[3,'Dentist & Staff Management','Licanda'],
  [4,'Patient Records Management','Ecal'],[5,'Treatment & Clinical Workflow Management','Ecal'],[6,'Appointment Booking & Smart Scheduling Management','Alejo'],
  [7,'Patient AI Chatbot Management','Alejo'],[8,'Patient Check-In Management','Alejo'],[9,'Patient Queue Management','Alejo'],
  [10,'Clinic Capacity, Waiting-Time & Workforce Management','Alejo'],[11,'Billing, Payment & Receipt Management','Ecal'],
  [12,'HMO Case, Coverage & Follow-Up Management','Delos Santos'],[13,'Service, Procedure & Pricing Management','Licanda'],
  [14,'Patient Forms, Documents & Consent Management','Delos Santos'],[15,'Clinic Configuration & Business Rules Management','Licanda'],
  [16,'Social Media Inquiry Management','Millar'],[17,'Unified Patient Messaging Management','Millar'],[18,'Real-Time Notification & Reminder Management','Millar'],
  [19,'Digital Prescription & OCR-Assisted Management','Ecal'],[20,'Treatment Follow-Up & Recall Management','Ecal'],
  [21,'Operational Analytics & Executive Intelligence','Delos Santos'],[22,'Audit Trail & Activity Monitoring Management','Delos Santos'],
  [23,'Integrated Workflow & Automation Control','Delos Santos'],[24,'Referral & Loyalty Management','Millar'],
  [25,'Marketing, Reactivation & Patient Engagement Management','Millar'],
]

test('MODULES matches the canonical 25-module structure, owners and PE designation',()=>{
  assert.deepEqual(data.MODULES.map(m=>[m.no,m.name,m.owner.split(',')[0]]),CANONICAL)
  assert.deepEqual(data.MODULES.filter(m=>m.pe).map(m=>m.no),[24,25])
  // Newly defined modules that are not built yet must not claim full representation.
  for(const no of [7,13,14,15,22])assert.ok(data.MODULES.find(m=>m.no===no).coverage,`M${no} states its real coverage`)
})

test('every current module has exactly one stable domain key',()=>{
  assert.deepEqual(Object.values(DOMAIN_MODULE).sort((a,b)=>a-b),data.MODULES.map(m=>m.no))
})

test('new workflow and audit records store stable domain keys, never module numbers',()=>{
  const f=fixture()
  // M6 cutover: the appointment is server-confirmed; the local adapter records its event under the domain key.
  const appointment=serverAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'})
  f.addAppointment(appointment)
  ok(f.actions.recordAppointmentEvent(appointment.id,'created'))
  const created=f.state.workflowLog.find(e=>e.eventType==='appointment.created')
  assert.equal(created.domain,'appointment');assert.equal('module' in created,false)
  assert.equal(eventModuleLabel(created),'M6')
  // M12: HMO events are server case history (hmo_case_events) now; the browser no longer records hmo.* workflow events.
  assert.equal(f.state.workflowLog.some(e=>e.eventType?.startsWith('hmo.')),false)
  assert.ok(f.state.audit.every(a=>!('module' in a)&&typeof a.domain==='string'))
})

test('historical records keep their old meaning: old M13/M14 HMO never read as new M13/M14',()=>{
  assert.equal(eventModuleLabel({module:'M13'}),'M12')
  assert.equal(eventModuleLabel({module:'M14'}),'M12')
  assert.equal(eventModuleLabel({module:'M12–M14'}),'M12')
  assert.equal(eventModuleLabel({module:'M6→M7'}),'M6')
  assert.equal(eventModuleLabel({module:'M10 / M15'}),'M10')
  assert.equal(eventModuleLabel({module:'M22'}),'M21')
  assert.equal(eventModuleLabel({module:'M5→M12'}),'M5→M12')
  assert.equal(eventModuleLabel({module:'M16→M17→M6'}),'M16→M17→M6')
  // The same number means different things depending on whether the record predates the restructure.
  assert.equal(eventModuleLabel({domain:'service'}),'M13')
  assert.deepEqual(recordDomains({module:'M13'}),['hmo'])
  assert.equal(eventModuleLabel({}),'—');assert.equal(eventModuleLabel({module:'unknown'}),'—')
  assert.deepEqual(legacyModuleDomains('M7'),['appointment'])
  assert.equal(Object.keys(LEGACY_MODULE_DOMAIN).length,25)
})

test('automation rule targets use domains; persisted legacy targets still display under the old meaning',()=>{
  for(const rule of data.INITIAL_AUTOMATIONS){
    assert.equal('targetModule' in rule,false,rule.id)
    assert.ok(rule.targetDomains.every(domain=>DOMAIN_MODULE[domain]),rule.id)
  }
  assert.equal(ruleTargetLabel(data.INITIAL_AUTOMATIONS.find(r=>r.id==='r2')),'M12')
  assert.equal(ruleTargetLabel({targetModule:'M6 / M7 / M18'}),'M6 / M18')
  assert.equal(ruleTargetLabel({targetModule:'M14'}),'M12')
})

test('seeded workflow and audit records use valid domain keys',()=>{
  for(const record of [...data.INITIAL_WORKFLOW_LOG,...data.INITIAL_AUDIT]){
    assert.equal('module' in record,false,record.id)
    assert.ok(recordDomains(record).length>0,record.id)
  }
})

test('event writers no longer emit numbered module tags as durable identity',()=>{
  for(const path of ['src/workflow.js','src/communication.js','src/loyalty.js','src/phase2.js','src/administration.js','src/booking-drafts.js','src/registration.js','src/identity-bridge.js','src/orchestration.js','src/store.jsx','src/data.js']){
    const source=read(path).replace(/\/\/.*$/gm,'')
    assert.doesNotMatch(source,/module:\s*'M\d|,\s*'M\d+(?:\s*[→–/]\s*M?\d+)*'\s*,/,path)
  }
})
