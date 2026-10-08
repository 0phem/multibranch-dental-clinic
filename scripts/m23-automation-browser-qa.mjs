// M23 automation truthfulness browser QA. HTTP fixtures only (not a live backend): rule evaluation, validation, authorization
// and the no-data health value are covered by the Laravel tests. No operational record is created; artifacts go outside the repo.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright index.mjs> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m23-automation-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m23-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const rules=[
 {id:'r1',rule_code:'R1_APPT_LIFECYCLE',name:'Appointment created / moved / cancelled',action:'Reserve or release slot; update calendar; notify patient',condition:'Valid appointment lifecycle change',owner:'Scheduling',is_active:true},
 {id:'r4',rule_code:'R4_TREATMENT_DOWNSTREAM',name:'Treatment completed',action:'Create billing, prescription, or follow-up task as applicable',condition:'Dentist marks prescription/follow-up required',owner:'Clinical',is_active:true}]
const emptySnapshot={health_rate:null,execution_model:'evaluation_only',total_actions:0,success_count:0,warning_count:0,failed_count:0,active_rules_count:2,rules,recent_actions:[],recent_exceptions:[]}
const action={id:'a1',rule_code:'R2_HMO_FOLLOWUP_REMINDER',rule_name:'HMO pending timer updated',event_type:'hmo.pending.timer.updated',status:'Warning',execution:'evaluation_only',summary_kind:'evaluation_result',result_summary:'HMO pending time 20h meets the 12-hour demonstration threshold (an unconfirmed project value, not clinic policy). Evaluation only: no follow-up task or notification was created.',executed_at_human:'2026-09-28 10:00',aggregate:{type:'manual_evaluation',id:'eval_R2'},actor:{name:'Owner'}}
const legacy={id:'a0',rule_code:'R4_TREATMENT_DOWNSTREAM',rule_name:'Treatment completed',event_type:'clinical.treatment.completed',status:'Success',execution:'evaluation_only',summary_kind:'legacy_proposed_description',result_summary:'Treatment completed: Draft invoice created; Recall / follow-up obligation staged.',executed_at_human:'2026-09-20 10:00',aggregate:null,actor:null}
const fullSnapshot={...emptySnapshot,health_rate:50,total_actions:2,success_count:1,warning_count:1,recent_actions:[action,legacy],recent_exceptions:[action]}

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'owner,staff,dentist,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const requests=[],dispatches=[]
  const mode={fail:false,full:false}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path.startsWith('/api/automation/')){
    requests.push(path)
    if(path.endsWith('/dispatch')){dispatches.push(JSON.parse(request.postData()||'{}'));return route.fulfill({status:201,json:{data:action,message:'Rule was evaluated and the evaluation was recorded with status Warning. No business action was performed.'}})}
    if(mode.fail)return route.fulfill({status:500,json:{message:'boom'}})
    if(path.endsWith('/snapshot'))return route.fulfill({status:200,json:{data:mode.full?fullSnapshot:emptySnapshot}})
   }
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()

  if(role==='owner'){
   const label='Automation Monitor'
   const visible=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
   if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
   await page.getByRole('heading',{name:'Automation monitor',exact:true}).waitFor()
   await page.getByText('Evaluation health').first().waitFor()
   await page.getByText('No recorded exceptions').waitFor()
   // empty history: genuinely no data, never 100%
   check(await page.locator('.stats-grid').innerText().then(t=>/No data/.test(t)&&!/100%/.test(t)),'an empty history reads "No data", not 100%')
   check(await page.getByText('No recorded exceptions').count()===1,'a genuine empty exception list is stated')
   check(await page.getByText('Approved workflow rules').count()===0&&await page.getByText('Successful recorded actions').count()===0,'no approved-rules or successful-actions claim')
   check(await page.getByText(/does not create invoices, tasks, notifications or messages/).count()===1,'the page states that the module only evaluates')
   check(await page.getByText(/Proposed action \(not performed by this module\)/).count()===2,'rule actions are labelled proposed, not performed')
   check(await page.getByText('Offline demo preview').count()===0,'no offline label in a server session')
   // observation input only where an observation exists; R4 never takes clinical flags
   check(await page.getByLabel('Hours the HMO case has been pending').count()===1,'R2 asks for an observation')
   // blank / out-of-range values cannot be submitted
   check(await page.getByRole('button',{name:'Run Rule Evaluation'}).isDisabled(),'R2 cannot run without an observation')
   await page.getByLabel('Hours the HMO case has been pending').fill('9000')
   check(await page.getByRole('button',{name:'Run Rule Evaluation'}).isDisabled(),'R2 cannot run above the server limit')
   await page.getByLabel('Hours the HMO case has been pending').fill('20')
   await page.getByRole('button',{name:'Run Rule Evaluation'}).click()
   await page.waitForTimeout(300)
   check(dispatches.length===1&&dispatches[0].rule_code==='R2_HMO_FOLLOWUP_REMINDER'&&dispatches[0].payload.pending_hours===20,'R2 sends its typed observation as a number')
   await page.locator('select').filter({has:page.locator('option',{hasText:'R4'})}).first().selectOption('R4_TREATMENT_DOWNSTREAM')
   check(await page.getByLabel('Hours the HMO case has been pending').count()===0,'R4 shows no observation input')
   await page.getByRole('button',{name:'Run Rule Evaluation'}).click()
   await page.waitForTimeout(300)
   const r4=dispatches[1]
   check(r4&&r4.rule_code==='R4_TREATMENT_DOWNSTREAM'&&!('followup_required' in r4.payload)&&!('prescription_required' in r4.payload),'R4 never sends a clinical flag')
   // populated history, including an older row whose wording described an action
   mode.full=true
   await page.getByRole('button',{name:/Refresh Snapshot/}).click()
   await page.getByText('Draft invoice created').first().waitFor()
   check(await page.locator('.stats-grid').innerText().then(t=>/50%/.test(t)),'a real mixed history shows its exact rate')
   check(await page.getByText(/Evaluation only — no business action was performed/).count()>=1,'a current evaluation row carries the evaluation-only note')
   check(await page.getByText(/Legacy description of a proposed action \(nothing was executed\)/).count()>=1,'older wording is identified as a legacy proposed-action description')
   check(await page.getByText(/this older wording is a proposed action, not evidence that anything was done/).count()===1,'the legacy row says it is not evidence of any action')
   check(await page.getByText(/Each run records a separate evaluation/).count()===1,'repeated manual runs are stated to be independent')
   // failure: explicit, nothing invented, recoverable
   mode.fail=true
   await page.getByRole('button',{name:/Refresh Snapshot/}).click()
   await page.getByText('The automation record is unavailable right now').waitFor();check(true,'failure is an explicit unavailable state')
   check(await page.getByText('Draft invoice created').count()===0&&await page.getByText('Exceptions unavailable').count()===1,'no figures or "no exceptions" claim after a failed load')
   check(await page.locator('.stats-grid').innerText().then(t=>/No data/.test(t)),'health shows "No data" while unavailable')
   mode.fail=false
   await page.getByRole('button',{name:'Try again'}).click()
   await page.getByText('Draft invoice created').first().waitFor();check(true,'retry recovers')
  }else{
   const menu=page.getByRole('button',{name:'Open navigation',exact:true})
   if(await menu.count())await menu.first().click().catch(()=>{})
   check(await page.getByRole('button',{name:'Automation Monitor',exact:true}).count()===0,`${role} navigation exposes no automation monitor`)
   check(requests.length===0,`${role} never requests automation data`)
  }
  await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(overflow===0,`${role}/${width} overflow: ${overflow}`)
  results.push({role,width,overflow})
  await context.close()
 }
 const unexpected=errors.filter(e=>!/status of (500)/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
