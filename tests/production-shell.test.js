import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as data from '../src/data.js'
import { canAccessPage } from '../src/safeguards.js'
import { normalizeClinicState, sessionForRole } from '../src/contracts.js'

// Public clinic website leads to real authentication. No demo-reset control, demo sign-in shortcut,
// persona picker or professor-facing coverage page may be exposed.
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8')
const app=read('src/App.jsx'), layout=read('src/layout.jsx'), store=read('src/store.jsx'), admin=read('src/pages/Admin.jsx')

test('public clinic entry leads to real Login and Patient registration, never a persona picker',()=>{
  assert.match(app,/if \(!role\) return <>[\s\S]*?<Login onLogin=\{login\}/)
  assert.match(app,/<PublicSite\/>/)
  assert.doesNotMatch(app,/RolePicker|persona/i)
  // Role comes only from the backend-authenticated session.
  assert.match(app,/const role=store\.session\?\.role\?\?null/)
})

test('no demo reset or demo sign-in shortcut is reachable from the application',()=>{
  for(const [name,source] of [['App.jsx',app],['layout.jsx',layout],['store.jsx',store]]){
    assert.doesNotMatch(source,/resetDemo|Reset demo|demo workspace/i,name)
    assert.doesNotMatch(source,/loginPatientByEmail/,name)
  }
  assert.doesNotMatch(store,/localStorage\.removeItem/,'the store never bulk-clears saved workspaces')
})

test('the professor-facing Module Coverage page is gone and no role can navigate to it',()=>{
  assert.doesNotMatch(admin,/ModulesPage|Professor-facing|25-Module UI Coverage/)
  assert.doesNotMatch(app,/'modules'/)
  assert.equal(data.MODULES.length,25,'canonical module data itself is kept')
})

test('every role still reaches its application pages under current auth rules',()=>{
  const seedKeys={persons:'PERSONS',services:'SERVICES',branchServices:'BRANCH_SERVICES',dentistServiceAssignments:'DENTIST_SERVICE_ASSIGNMENTS',branches:'BRANCHES',dentists:'DENTISTS',staff:'STAFF',patients:'PATIENTS',users:'USERS'}
  const seeds=Object.fromEntries(Object.entries(seedKeys).map(([key,name])=>[key,structuredClone(data[`INITIAL_${name}`])]))
  const state=normalizeClinicState({...seeds,appointments:[],queue:[],checkIns:[],treatments:[],invoices:[],prescriptions:[],followups:[],hmo:[],conversations:[],inquiries:[],notifications:[],workflowLog:[],audit:[]})
  for(const role of ['patient','staff','dentist','owner']){
    const session=sessionForRole(role,state)
    assert.equal(canAccessPage(state,session,'dashboard'),true,`${role} dashboard`)
    assert.equal(canAccessPage(state,session,'modules'),false,`${role} has no coverage page`)
    const reachable=data.NAV[role].filter(([key])=>canAccessPage(state,session,key))
    assert.ok(reachable.length>1,`${role} keeps application navigation`)
  }
})
