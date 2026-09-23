import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { readCollection, writeCollection } from '../src/persistence.js'
import { clinicNow, setClockSource } from '../src/clock.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'
import { createWorkflowActions } from '../src/workflow.js'
import { validateAppointment } from '../src/logic.js'

beforeEach(()=>setClockSource(()=>new Date('2026-09-19T02:08:00Z')))

const PREFIX='dentalops-v4-'
const KEY=`${PREFIX}dentist-service-assignments`
const seed=()=>structuredClone(data.INITIAL_DENTIST_SERVICE_ASSIGNMENTS)

// Frozen copy of the approved seed Dentist/Service pairs, as they were before this fix.
// Guards against the hotfix silently granting, dropping or changing any capability.
const SEED_PAIRS=[
  ...['svc1','svc2','svc3','svc4','svc5','svc11'].map(s=>['d1',s]),
  ...['svc1','svc6','svc11'].map(s=>['d2',s]),
  ...['svc1','svc7','svc11'].map(s=>['d3',s]),
  ...['svc1','svc4','svc9','svc11'].map(s=>['d4',s]),
  ...['svc1','svc2','svc3','svc5','svc11'].map(s=>['d5',s]),
]
const legacyRows=()=>SEED_PAIRS.map(([dentistId,serviceId])=>({dentistId,serviceId}))
const pairs=rows=>rows.map(r=>`${r.dentistId}/${r.serviceId}`)

// Browser-shaped storage that also records every write so tests can prove reads never mutate.
function memoryStorage(initial={}) {
  const map=new Map(Object.entries(initial)),writes=[]
  return {map,writes,getItem:k=>map.has(k)?map.get(k):null,setItem(k,v){writes.push(k);map.set(k,String(v))},removeItem:k=>map.delete(k)}
}
const stored=rows=>memoryStorage({[KEY]:JSON.stringify(rows)})
const read=storage=>readCollection(storage,KEY,seed())
const assertRecovery=(result,storage,before)=>{
  assert.equal(result.blocked,true)
  assert.match(result.error,/could not be read.*not been overwritten/)
  assert.deepEqual(storage.writes,[])
  assert.equal(storage.map.get(KEY),before)
}

// The exact collections/seeds the browser store persists, taken from the store itself so a
// newly added collection cannot dodge the seed→persist→reload check.
function persistedCollections() {
  const source=readFileSync(new URL('../src/store.jsx',import.meta.url),'utf8')
  const found=[...source.matchAll(/usePersist\('([a-z-]+)',(INITIAL_[A-Z_]+|\[\])/g)]
  return found.map(([,key,initial])=>[key,initial==='[]'?[]:structuredClone(data[initial])])
}

test('store persistence inventory is fully discovered',()=>{
  const keys=persistedCollections().map(([key])=>key)
  assert.equal(keys.length,26)
  assert.ok(keys.includes('dentist-service-assignments'))
  assert.ok(keys.includes('check-ins'))
  assert.ok(keys.includes('booking-drafts'))
})

test('fresh seed of every persisted collection saves and reloads without recovery (real browser failure path)',()=>{
  const storage=memoryStorage()
  const collections=persistedCollections()
  for(const [key,initial] of collections){
    const first=readCollection(storage,`${PREFIX}${key}`,initial)
    assert.equal(first.blocked,false,`${key} first load`)
    assert.equal(writeCollection(storage,`${PREFIX}${key}`,first.value).ok,true)
  }
  for(let reload=1;reload<=3;reload++)for(const [key,initial] of collections){
    const again=readCollection(storage,`${PREFIX}${key}`,initial)
    assert.equal(again.blocked,false,`${key} reload ${reload}: ${again.error}`)
    assert.deepEqual(again.value,initial,`${key} reload ${reload} content`)
  }
})

test('fresh Dentist/service assignment seed carries canonical unique IDs',()=>{
  const rows=seed()
  assert.equal(rows.length,21)
  assert.ok(rows.every(r=>typeof r.id==='string'&&r.id.trim()))
  assert.equal(new Set(rows.map(r=>r.id)).size,rows.length)
  assert.equal(new Set(pairs(rows)).size,rows.length)
  assert.deepEqual(pairs(rows),pairs(legacyRows()))
})

test('assignment seed still points at real Dentists and Services',()=>{
  for(const r of seed()){
    assert.ok(data.INITIAL_DENTISTS.some(d=>d.id===r.dentistId),r.id)
    assert.ok(data.INITIAL_SERVICES.some(s=>s.id===r.serviceId),r.id)
  }
})

test('assignment IDs are deterministic and follow the branch-service ID convention',()=>{
  assert.equal(data.dentistServiceAssignmentId('d1','svc2'),'dsa-d1-svc2')
  assert.equal(data.dentistServiceAssignmentId('d1','svc2'),data.dentistServiceAssignmentId('d1','svc2'))
  assert.notEqual(data.dentistServiceAssignmentId('d1','svc2'),data.dentistServiceAssignmentId('d2','svc2'))
  assert.deepEqual(seed().map(r=>r.id),SEED_PAIRS.map(([d,s])=>`dsa-${d}-${s}`))
})

test('assignment serialization round-trips without loss',()=>{
  const rows=seed()
  assert.deepEqual(JSON.parse(JSON.stringify(rows)),rows)
})

test('assignments persist, reload and stay byte-stable across repeated reloads',()=>{
  const storage=memoryStorage()
  const first=readCollection(storage,KEY,seed())
  assert.equal(writeCollection(storage,KEY,first.value).ok,true)
  const snapshot=storage.map.get(KEY)
  let value
  for(let i=0;i<4;i++){
    const result=read(storage)
    assert.equal(result.blocked,false,result.error)
    value=result.value
    assert.equal(writeCollection(storage,KEY,value).ok,true)
    assert.equal(storage.map.get(KEY),snapshot)
  }
  assert.deepEqual(value,seed())
})

test('Dentist ↔ Branch ↔ Service relationships are identical before and after reload',()=>{
  const triples=rows=>{
    const state={dentists:data.INITIAL_DENTISTS,branches:data.INITIAL_BRANCHES,branchServices:data.INITIAL_BRANCH_SERVICES,dentistServiceAssignments:rows}
    return state.dentists.flatMap(d=>d.branches.flatMap(name=>{
      const branch=state.branches.find(b=>b.name===name)
      return state.branchServices.filter(bs=>bs.branchId===branch.id&&bs.active!==false&&state.dentistServiceAssignments.some(a=>a.dentistId===d.id&&a.serviceId===bs.serviceId&&a.isAuthorized!==false)).map(bs=>`${d.id}/${branch.id}/${bs.serviceId}`)
    })).sort()
  }
  const expected=triples(legacyRows())
  assert.ok(expected.length>0)
  const storage=memoryStorage()
  writeCollection(storage,KEY,seed())
  assert.deepEqual(triples(read(storage).value),expected)
  assert.deepEqual(triples(seed()),expected)
  const migrated=read(stored(legacyRows())).value
  assert.deepEqual(triples(migrated),expected)
})

test('scheduler capability filtering is unchanged after a legacy-storage reload',()=>{
  const reloaded=read(stored(legacyRows())).value
  const state=normalizeClinicState({
    persons:data.INITIAL_PERSONS,services:data.INITIAL_SERVICES,branchServices:data.INITIAL_BRANCH_SERVICES,dentistServiceAssignments:reloaded,
    branches:data.INITIAL_BRANCHES,dentists:data.INITIAL_DENTISTS,staff:data.INITIAL_STAFF,patients:data.INITIAL_PATIENTS,users:data.INITIAL_USERS,
    appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[],
  })
  const capable=(dentistId,branchId,serviceId)=>validateAppointment({patientId:'p1',branchId,dentistId,serviceId,date:'2026-09-19',start:'11:00'},state,null,clinicNow(),false).checks.find(c=>c.key==='dentist-service').ok
  for(const [d,s] of SEED_PAIRS)assert.equal(capable(d,'b1',s),true,`${d}/${s}`)
  assert.equal(capable('d2','b1','svc2'),false)
  assert.equal(capable('d1','b1','svc6'),false)
  assert.equal(capable('d3','b2','svc4'),false)
  const granted=data.INITIAL_DENTISTS.flatMap(d=>data.INITIAL_SERVICES.filter(s=>capable(d.id,'b1',s.id)).map(s=>`${d.id}/${s.id}`)).sort()
  assert.deepEqual(granted,SEED_PAIRS.map(p=>p.join('/')).sort())
})

// ---- Legacy compatibility -------------------------------------------------------------------

test('legacy saved assignments without IDs load with deterministic IDs instead of triggering recovery',()=>{
  const storage=stored(legacyRows())
  const before=storage.map.get(KEY)
  const result=read(storage)
  assert.equal(result.blocked,false,result.error)
  assert.equal(result.error,null)
  assert.deepEqual(result.value,seed())
  assert.equal(JSON.stringify(result.value),JSON.stringify(seed()),'migrated legacy rows serialize identically to a fresh seed')
  assert.deepEqual(storage.writes,[])
  assert.equal(storage.map.get(KEY),before)
})

test('legacy migration is idempotent once written back',()=>{
  const storage=stored(legacyRows())
  const first=read(storage).value
  writeCollection(storage,KEY,first)
  const second=read(storage)
  assert.equal(second.blocked,false)
  assert.deepEqual(second.value,first)
  assert.equal(readCollection(storage,KEY,[]).value.length,21)
})

test('a customized legacy subset is preserved exactly and grants nothing new',()=>{
  const subset=[{dentistId:'d3',serviceId:'svc7'},{dentistId:'d1',serviceId:'svc1'}]
  const result=read(stored(subset))
  assert.equal(result.blocked,false)
  assert.deepEqual(pairs(result.value),['d3/svc7','d1/svc1'])
  assert.equal(result.value.length,2)
})

test('legacy rows keep extra fields, including an explicit revoked authorization',()=>{
  const result=read(stored([{dentistId:'d1',serviceId:'svc1',isAuthorized:false,note:'kept'}]))
  assert.equal(result.blocked,false)
  assert.deepEqual(result.value,[{id:'dsa-d1-svc1',dentistId:'d1',serviceId:'svc1',isAuthorized:false,note:'kept'}])
})

test('rows that already have IDs are never rewritten, even beside legacy rows',()=>{
  const result=read(stored([{id:'custom-1',dentistId:'d1',serviceId:'svc1'},{dentistId:'d2',serviceId:'svc6'}]))
  assert.equal(result.blocked,false)
  assert.deepEqual(result.value.map(r=>r.id),['custom-1','dsa-d2-svc6'])
})

test('reading legacy assignments does not create workflow or audit events',()=>{
  const storage=stored(legacyRows())
  const base={
    persons:data.INITIAL_PERSONS,services:data.INITIAL_SERVICES,branchServices:data.INITIAL_BRANCH_SERVICES,branches:data.INITIAL_BRANCHES,dentists:data.INITIAL_DENTISTS,
    staff:data.INITIAL_STAFF,patients:data.INITIAL_PATIENTS,users:data.INITIAL_USERS,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],
    followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:structuredClone(data.INITIAL_WORKFLOW_LOG),audit:structuredClone(data.INITIAL_AUDIT),
  }
  const before=normalizeClinicState({...base,dentistServiceAssignments:seed()})
  const after=normalizeClinicState({...base,dentistServiceAssignments:read(storage).value})
  assert.deepEqual(after.workflowLog,before.workflowLog)
  assert.deepEqual(after.audit,before.audit)
  assert.deepEqual(after.workflowLog,data.INITIAL_WORKFLOW_LOG)
  assert.deepEqual(storage.writes,[])
})

// ---- Malformed and corrupt data still requires recovery -------------------------------------

const malformed={
  'missing serviceId':[{dentistId:'d1'}],
  'missing dentistId':[{serviceId:'svc1'}],
  'non-string dentistId':[{dentistId:1,serviceId:'svc1'}],
  'blank serviceId':[{dentistId:'d1',serviceId:'  '}],
  'empty row':[{}],
  'null id':[{id:null,dentistId:'d1',serviceId:'svc1'}],
  'blank id':[{id:'  ',dentistId:'d1',serviceId:'svc1'}],
  'numeric id':[{id:7,dentistId:'d1',serviceId:'svc1'}],
  'ID row without a Dentist/Service pair':[{id:'x1'}],
  'duplicate legacy pair':[{dentistId:'d1',serviceId:'svc1'},{dentistId:'d1',serviceId:'svc1'}],
  'duplicate pair with different IDs':[{id:'a',dentistId:'d1',serviceId:'svc1'},{id:'b',dentistId:'d1',serviceId:'svc1'}],
  'duplicate explicit IDs':[{id:'a',dentistId:'d1',serviceId:'svc1'},{id:'a',dentistId:'d2',serviceId:'svc6'}],
  'explicit ID colliding with a derived ID':[{id:'dsa-d2-svc6',dentistId:'d1',serviceId:'svc1'},{dentistId:'d2',serviceId:'svc6'}],
  'ambiguous derived ID':[{dentistId:'d1-a',serviceId:'b'},{dentistId:'d1',serviceId:'a-b'}],
  'non-boolean authorization':[{dentistId:'d1',serviceId:'svc1',isAuthorized:'no'}],
  'string row':['d1/svc1'],
  'null row':[null],
  'array row':[['d1','svc1']],
  'object instead of a collection':{dentistId:'d1',serviceId:'svc1'},
  'a good row beside a bad row':[{dentistId:'d1',serviceId:'svc1'},{dentistId:'d2'}],
}
for(const [name,rows] of Object.entries(malformed))test(`malformed assignments require recovery and are never rewritten: ${name}`,()=>{
  const storage=stored(rows),before=storage.map.get(KEY)
  assertRecovery(read(storage),storage,before)
})

test('unparseable saved assignments still trigger recovery and are preserved',()=>{
  const storage=memoryStorage({[KEY]:'{broken'})
  assertRecovery(read(storage),storage,'{broken')
})

test('recovery message names the assignment collection so the workspace notice appears',()=>{
  const storage=stored([{dentistId:'d1'}])
  const {error}=read(storage)
  assert.match(error,/^Saved dentist-service-assignments data could not be read\./)
  assert.ok(error.includes('could not be read'))
})

test('genuinely corrupt assignments block only that collection and leave every other saved collection readable',()=>{
  const storage=memoryStorage()
  const collections=persistedCollections()
  for(const [key,initial] of collections)writeCollection(storage,`${PREFIX}${key}`,initial)
  storage.map.set(KEY,JSON.stringify([{dentistId:'d1'}]))
  storage.writes.length=0
  const blocked=collections.filter(([key,initial])=>readCollection(storage,`${PREFIX}${key}`,initial).blocked).map(([key])=>key)
  assert.deepEqual(blocked,['dentist-service-assignments'])
  assert.deepEqual(storage.writes,[])
})

test('ID validation is not weakened for any other collection',()=>{
  const assignmentShaped=[{dentistId:'d1',serviceId:'svc1'}]
  for(const key of ['appointments','branch-services','services','dentists','queue','check-ins']){
    const storage=memoryStorage({[`${PREFIX}${key}`]:JSON.stringify(assignmentShaped)}),before=storage.map.get(`${PREFIX}${key}`)
    const result=readCollection(storage,`${PREFIX}${key}`,[])
    assert.equal(result.blocked,true,key)
    assert.deepEqual(storage.writes,[])
    assert.equal(storage.map.get(`${PREFIX}${key}`),before)
  }
  for(const rows of [[{code:'x'}],[{id:''}],[{id:5}],[null],[[]],{}])assert.equal(readCollection(memoryStorage({[`${PREFIX}services`]:JSON.stringify(rows)}),`${PREFIX}services`,[]).blocked,true)
})

// ---- Referential integrity ------------------------------------------------------------------
// readCollection owns structure only. Dentist/Service references are resolved against the canonical
// `dentists`/`services` collections at every point of use, so a dangling assignment is retained (never
// silently dropped) but is inert: it can never authorize anything.

const ORPHAN={id:'dsa-nonexistent-dentist-nonexistent-service',dentistId:'nonexistent-dentist',serviceId:'nonexistent-service'}
const ORPHANS=[
  ORPHAN,
  {id:'dsa-nonexistent-dentist-svc1',dentistId:'nonexistent-dentist',serviceId:'svc1'},
  {id:'dsa-d1-nonexistent-service',dentistId:'d1',serviceId:'nonexistent-service'},
]
function workspace(assignments) {
  const base={
    persons:data.INITIAL_PERSONS,services:data.INITIAL_SERVICES,branchServices:data.INITIAL_BRANCH_SERVICES,branches:data.INITIAL_BRANCHES,dentists:data.INITIAL_DENTISTS,
    staff:data.INITIAL_STAFF,patients:data.INITIAL_PATIENTS,users:data.INITIAL_USERS,automations:data.INITIAL_AUTOMATIONS,appointments:[],queue:[],checkIns:[],treatments:[],
    invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:structuredClone(data.INITIAL_WORKFLOW_LOG),audit:structuredClone(data.INITIAL_AUDIT),
  }
  let state=normalizeClinicState({...base,dentistServiceAssignments:assignments})
  let session=sessionForRole('staff',state)
  const actions=createWorkflowActions({getState:()=>state,getSession:()=>session,commit:p=>{state=normalizeClinicState({...state,...p})}})
  return {actions,get state(){return state},role(role){session=sessionForRole(role,state)}}
}
// The capability check is Dentist × Service; branch availability is a separate check (covered above).
const capabilityMatrix=state=>data.INITIAL_DENTISTS.flatMap(d=>data.INITIAL_SERVICES.filter(s=>
  validateAppointment({patientId:'p1',branchId:'b1',dentistId:d.id,serviceId:s.id,date:'2026-09-19',start:'11:00'},state,null,clinicNow(),false).checks.find(c=>c.key==='dentist-service').ok
).map(s=>`${d.id}/${s.id}`)).sort()

test('a structurally valid assignment for a nonexistent Dentist and Service loads without recovery and is preserved, not dropped',()=>{
  const storage=stored([...legacyRows(),ORPHAN])
  const result=read(storage)
  assert.equal(result.blocked,false,result.error)
  assert.equal(result.value.length,22)
  assert.deepEqual(result.value.at(-1),ORPHAN)
  assert.deepEqual(storage.writes,[])
  writeCollection(storage,KEY,result.value)
  const again=read(storage)
  assert.equal(again.blocked,false)
  assert.deepEqual(again.value,result.value)
})

test('dangling assignments reach canonical state unchanged and grant no Dentist capability',()=>{
  const clean=workspace(seed()),withOrphans=workspace([...seed(),...ORPHANS])
  assert.equal(withOrphans.state.dentistServiceAssignments.length,seed().length+ORPHANS.length)
  assert.deepEqual(capabilityMatrix(withOrphans.state),capabilityMatrix(clean.state))
  assert.deepEqual(capabilityMatrix(withOrphans.state),SEED_PAIRS.map(p=>p.join('/')).sort())
})

test('the exact nonexistent Dentist/Service pair fails the shared scheduler on existence, not just capability',()=>{
  const {state}=workspace([...seed(),ORPHAN])
  const check=validateAppointment({patientId:'p1',branchId:'b1',dentistId:ORPHAN.dentistId,serviceId:ORPHAN.serviceId,date:'2026-09-19',start:'11:00'},state,null,clinicNow(),false)
  const failed=check.checks.filter(c=>!c.ok).map(c=>c.key)
  assert.equal(check.valid,false)
  for(const key of ['service-exists','service','dentist','dentist-service'])assert.ok(failed.includes(key),key)
})

test('shared booking command rejects every dangling assignment and creates no appointment',()=>{
  const f=workspace([...seed(),...ORPHANS])
  const form={patientId:'p1',branchId:'b1',date:'2026-09-19',start:'11:00'}
  for(const [dentistId,serviceId] of [[ORPHAN.dentistId,ORPHAN.serviceId],['nonexistent-dentist','svc1'],['d1','nonexistent-service']])
    assert.equal(f.actions.saveAppointment({...form,dentistId,serviceId}).ok,false,`${dentistId}/${serviceId}`)
  assert.equal(f.state.appointments.length,0)
  assert.equal(f.actions.saveAppointment({...form,dentistId:'d1',serviceId:'svc1'}).ok,true)
})

test('a dangling assignment cannot authorize a performed procedure for a real encounter',()=>{
  const f=workspace([...seed(),...ORPHANS])
  const a=f.actions.saveAppointment({patientId:'p1',branchId:'b1',dentistId:'d1',serviceId:'svc1',date:'2026-09-19',start:'11:00'}).record
  const q=f.actions.checkInAppointment(a.id).record
  f.role('dentist')
  assert.equal(f.actions.updateQueue(q.id,'Called').ok,true)
  assert.equal(f.actions.saveTreatment({queueEntryId:q.id}).ok,true)
  const performed=serviceId=>f.actions.saveTreatment({queueEntryId:q.id,procedures:[{serviceId,quantity:1}]}).ok
  assert.equal(performed('nonexistent-service'),false)
  assert.equal(performed('svc6'),false)
  assert.equal(performed('svc1'),true)
})

test('dangling assignments create no workflow or audit events and remain out of ID-validation exemptions',()=>{
  const before=workspace(seed()).state,after=workspace([...seed(),...ORPHANS]).state
  assert.deepEqual(after.workflowLog,before.workflowLog)
  assert.deepEqual(after.audit,before.audit)
  // Referential validity is not a reason to relax structural validation: an orphan without an ID or pair is still recovery.
  for(const bad of [{dentistId:'nonexistent-dentist'},{id:'x',serviceId:'nonexistent-service'},{...ORPHAN,id:''}]){
    const storage=stored([bad]),raw=storage.map.get(KEY)
    assertRecovery(read(storage),storage,raw)
  }
})
