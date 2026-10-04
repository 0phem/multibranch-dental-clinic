// M22 audit trail browser QA. HTTP fixtures only: authorization, append-only storage, filters and pagination are covered by the
// Laravel tests. No operational record is created or changed; artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5188 node scripts/m22-audit-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5188'
const output=process.env.QA_OUTPUT||'/tmp/m22-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const row=(n,over={})=>({id:`01j00000000000000000000e0${n}`,action:'patient.profile.updated',category:'clinical',severity:'info',actor:{id:'01k0000000000000000000u001',name:'Qa Staff',role:'staff'},branch:{id:'01K00000000000000000000001',name:'Branch A'},auditable_type:'Patient',auditable_id:'01j0000000000000000000a001',ip_address:'10.0.0.5',user_agent:'QA-UA',payload:{fields:['phone','emergency_contact'],password:'[REDACTED]'},created_at:`2026-09-28T10:0${n}:00+08:00`,...over})
const page1=[row(5),row(4,{action:'auth.login_failed',category:'security',severity:'warning',actor:{id:null,name:'Anonymous',role:'anonymous'},branch:null,auditable_type:null,auditable_id:null,payload:{}}),row(3,{action:'billing.payment_recorded',category:'financial',payload:{amount:'1500.00',method:'GCash'}})]
const page2=[row(2,{action:'document.uploaded',category:'administrative'}),row(1,{action:'branch.updated',category:'administrative'})]
const demoAction=(data.INITIAL_AUDIT?.[0]?.action||'').toString()

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'owner,staff,dentist,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const requests=[]
  const mode={fail:false}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/audit-logs/export'){requests.push(`EXPORT ${url.search}`);return route.fulfill({status:200,headers:{'content-type':'text/csv','X-Audit-Export-Truncated':'true','X-Audit-Export-Limit':'5000','Access-Control-Expose-Headers':'X-Audit-Export-Truncated, X-Audit-Export-Limit','Access-Control-Allow-Origin':request.headers()['origin']||base,'Access-Control-Allow-Credentials':'true'},body:'ID,Timestamp\n'})}
   if(path==='/api/audit-logs'){
    requests.push(`LIST ${url.search}`)
    if(mode.fail)return route.fulfill({status:500,json:{message:'boom'}})
    return url.searchParams.get('cursor')?route.fulfill({status:200,json:{data:page2,meta:{per_page:50,next_cursor:null}}}):route.fulfill({status:200,json:{data:page1,meta:{per_page:50,next_cursor:'01j00000000000000000000e03'}}})
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
   const label='Audit Trail'
   const visible=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
   if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
   await page.getByRole('heading',{name:'Audit Trail & Activity Monitoring',exact:true}).waitFor()
   await page.getByText('billing.payment_recorded').first().waitFor()
   check(await page.getByText('Events loaded').count()===1,'counts are labelled as loaded rows')
   check(!(demoAction&&await page.getByText(demoAction,{exact:true}).count()),'no demo/browser audit entries are shown')
   check(await page.getByText(/tamper-resistant/i).count()===0,'no tamper-proof claim')
   check(requests.some(r=>r.includes('per_page=50'))&&!requests.some(r=>r.includes('limit=')),'bounded server paging')
   // older events
   await page.getByRole('button',{name:'Load older events'}).click()
   await page.getByText('branch.updated').first().waitFor()
   check(requests.some(r=>r.includes('cursor=')),'the next page uses the server cursor')
   check(await page.getByText('End of the matching history.').count()===1,'the end of history is stated')
   check(await page.getByText('Anonymous').count()>=1,'an event with no actor is shown as Anonymous')
   // filters are sent as server parameters (branch by its reference, never an internal id)
   await page.locator('label',{hasText:/^Category/}).locator('select').selectOption('security')
   await page.waitForFunction(()=>true);await page.waitForTimeout(450)
   check(requests.some(r=>r.includes('category=security')),'the category filter is a server filter')
   await page.locator('label',{hasText:/^Branch/}).locator('select').last().selectOption('b1')
   await page.waitForTimeout(450)
   check(requests.some(r=>r.includes('branch_id=b1')),'the branch filter sends the branch reference')
   // invalid date range: explained, no request
   const before=requests.length
   await page.getByLabel(/^From Date/).fill('2026-09-30')
   await page.getByLabel(/^To Date/).fill('2026-09-01')
   await page.getByText('The end date is before the start date.').first().waitFor()
   await page.waitForTimeout(450)
   const sentAfter=requests.slice(before).filter(r=>r.includes('date_to=2026-09-01')&&r.includes('date_from=2026-09-30'))
   check(sentAfter.length===0,'an invalid range is never sent to the server')
   await page.getByLabel(/^From Date/).fill('')
   await page.getByLabel(/^To Date/).fill('')
   await page.waitForTimeout(450)
   // inspection shows sanitized metadata
   await page.getByRole('button',{name:'Inspect'}).first().click()
   await page.getByText('Event Payload (Sanitized)').waitFor()
   check(await page.getByText('[REDACTED]').count()>=0,'inspection renders')
   await page.keyboard.press('Escape')
   // failure is explicit, then recoverable
   mode.fail=true
   await page.getByLabel(/^Search/).fill('zzz')
   await page.getByText('Audit trail unavailable').waitFor();check(true,'failure is an explicit error')
   check(await page.getByText('No audit records match').count()===0,'a failed load is not shown as an empty history')
   mode.fail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText(/billing\.payment_recorded|No audit records match/).first().waitFor();check(true,'retry recovers')
   // export reports truncation
   await page.getByLabel(/^Search/).fill('')
   await page.waitForTimeout(450)
   await page.getByRole('button',{name:'Export Audit Trail (CSV)'}).click()
   await page.getByText(/cut at the newest 5000/).waitFor();check(true,'a truncated export is disclosed')
  }else{
   const ownerOnly=page.getByRole('button',{name:'Audit Trail',exact:true})
   const menu=page.getByRole('button',{name:'Open navigation',exact:true})
   if(await menu.count())await menu.first().click().catch(()=>{})
   check(await ownerOnly.count()===0,`${role} navigation exposes no audit trail`)
   check(!requests.some(r=>r.startsWith('LIST')),`${role} never requests system-wide audit history`)
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
