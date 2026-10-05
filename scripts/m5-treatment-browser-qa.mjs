// M5 Treatment browser QA. HTTP fixtures only (server rules are covered by the Laravel tests); no record is changed.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m5-treatment-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m5-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const T=n=>`01k0000000000000000000t0${n}`
const mine=(n,summary,service)=>({id:T(n),date:`2026-09-${10+n}`,procedure_summary:summary,services:[{name:service}],dentist:{name:'Dr. QA Dentist'}})
const pages={first:[mine(3,'Cleaning procedure three','Oral Prophylaxis'),mine(2,'Filling procedure two','Tooth Filling')],second:[mine(1,'Consultation procedure one','Dental Consultation')]}
try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'patient,staff,owner,dentist').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={secondFail:false,deep:false,deepFail:false,treatmentCalls:[]}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/treatments/mine'){
    const cursor=url.searchParams.get('cursor');mode.treatmentCalls.push(cursor||'first')
    if(mode.deep){const n=cursor?Number(cursor.slice(1)):0;if(cursor==='d20'&&mode.deepFail)return route.fulfill({status:500,json:{message:'boom'}});return route.fulfill({status:200,json:{data:[mine(3,'Deep record '+n,'Oral Prophylaxis')],meta:{per_page:100,next_cursor:n>=22?null:'d'+(n+1)}}})}
    if(!cursor)return route.fulfill({status:200,json:{data:pages.first,meta:{per_page:100,next_cursor:T(2)}}})
    return mode.secondFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:pages.second,meta:{per_page:100,next_cursor:null}}})
   }
   if(path==='/api/treatments')return route.fulfill({status:200,json:{data:[],meta:{current_page:1,last_page:1}}})
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error'&&!/status of 500/.test(m.text()))errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  const open=async label=>{
   const direct=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
   if(!await direct.count()){
    const menu=page.getByRole('button',{name:'Menu',exact:true}).filter({visible:true})
    if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   }
   await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
  }
  await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
  const navNames=async()=>page.getByRole('button').allInnerTexts()
  if(role==='patient'){
   await open('Visits')
   await page.getByRole('heading',{name:/Visits/}).first().waitFor()
   await page.waitForTimeout(1500)
   check(mode.treatmentCalls.includes(T(2)),'the Patient history followed the server cursor to its second page ('+mode.treatmentCalls.join(',')+')')
   check(await page.getByText(/Historical demo/i).count()===0,'no demo treatment is presented')
   // a failed later page is an explicit, recoverable error — never a silently shorter history
   mode.secondFail=true;mode.treatmentCalls=[]
   await page.reload();await page.locator('.workspace-label').waitFor();await open('Visits')
   await page.getByText(/couldn.t be loaded/).first().waitFor({timeout:8000});check(true,'a failed later page is shown as an error')
   mode.secondFail=false
   await page.getByRole('button',{name:'Try again'}).or(page.getByRole('button',{name:'Retry'})).first().click()
   await page.waitForTimeout(1500)
   check(await page.getByText(/couldn.t be loaded/).count()===0,'the history recovers after retry')
   check(await page.getByRole('button',{name:/Start Treatment|Complete Treatment/}).count()===0,'a Patient has no clinical action')
   // a history longer than the automatic bound stays reachable through an explicit, recoverable continuation
   mode.deep=true;mode.treatmentCalls=[]
   await page.reload();await page.locator('.workspace-label').waitFor();await open('Visits')
   await page.getByText('Only part of your treatment history is shown').waitFor({timeout:8000})
   check(mode.treatmentCalls.length===20&&!mode.treatmentCalls.includes('d22'),'the automatic fetch stopped at its bound ('+mode.treatmentCalls.length+' requests)')
   mode.deepFail=true
   await page.getByRole('button',{name:'Load older treatment records'}).click()
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor({timeout:5000});check(true,'a failed continuation is explicit')
   mode.deepFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('Only part of your treatment history is shown').waitFor({state:'detached',timeout:8000})
   check(mode.treatmentCalls.includes('d22'),'the continuation reached the end of the history (cursor null)')
   mode.deep=false
  }else if(role==='dentist'){
   await open('Treatment')
   await page.getByText('No encounter selected').waitFor();check(true,'Treatment opens only from an encounter: no demo treatment is shown')
   check(await page.getByRole('button',{name:/Complete Treatment|Start Treatment/}).count()===0,'no clinical action without a server encounter')
   check(await page.getByText(/Historical demo/i).count()===0,'no demo clinical record')
  }else{
   const names=await navNames()
   check(!names.some(n=>n.trim()==='Treatment'),role+' has no Treatment workspace entry')
   check(await page.getByRole('button',{name:/Start Treatment|Complete Treatment|Save Treatment Progress/}).count()===0,role+' has no clinical mutation control')
  }
  const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-document.documentElement.clientWidth))
  check(overflow===0,`no horizontal overflow ${role}/${width}`)
  results.push({role,width,overflow})
  await context.close()
 }
}finally{
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors},null,2))
 await browser.close()
}
console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
if(errors.length)console.error(errors.slice(0,8).join('\n'))
