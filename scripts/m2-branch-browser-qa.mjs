// HTTP fixtures only. Real authorization and branch integrity are covered by backend tests.
// No clinic records are changed; artifacts go outside the repository.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
import {clinic} from '../src/clinic-config.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5185'
const output=process.env.QA_OUTPUT||'/tmp/m2-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}
const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,operating_data_status:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))
async function navigate(page,label){
 const button=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
 if(!await button.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
 await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
}
try{
 for(const width of [375,430,768,1024,1440])for(const role of ['patient','staff','dentist','owner']){
  const context=await browser.newContext({viewport:{width,height:900}})
  let fail=false
  await context.route('**/api/**',route=>{
   const path=new URL(route.request().url()).pathname
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011'}:null}
   const values={'/api/me':me,'/api/branches':fail?null:branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??(path==='/api/branches'?null:[])}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()
  if(role==='owner'){
   await navigate(page,'Branches')
   await page.getByRole('heading',{name:'Multi-Branch Clinic Management',exact:true}).waitFor()
   check(await page.locator('.branch-selector button').count()===3,'three operational records')
   for(const b of branches){
    await page.locator('.branch-selector button').filter({hasText:b.name}).click()
    await page.waitForFunction(name=>[...document.querySelectorAll('input')].some(input=>input.value===name),b.name)
    check(await page.getByRole('textbox',{name:'Branch name',exact:true}).inputValue()===b.name,'selection retains identity')
   }
   check(await page.getByText(/Operating hours, branch phone numbers and capacity settings need clinic confirmation/).count()===1,'unconfirmed data disclosed')
  }else if(role==='patient'){
   await page.getByRole('button',{name:/^(Book|Book Appointment)$/}).filter({visible:true}).first().click()
   await page.getByRole('button',{name:/Manual Appointment/}).click()
   await page.getByRole('heading',{name:'Which clinic works best for you?'}).waitFor()
   check(await page.getByText('Confirm opening hours with the clinic',{exact:false}).count()===3,'Patient does not see unconfirmed hours as clinic facts')
  }else if(role==='staff'){
   await navigate(page,'Check-In')
   await page.getByRole('heading',{name:'Patient check-in',exact:true}).waitFor()
   check(await page.locator('.branch-lock').innerText().then(t=>t.includes('Branch A')),'Staff assigned branch retained')
   check(await page.locator('.branch-scope select').count()===0,'no Owner switcher for Staff')
  }else if(role==='dentist'){
   await navigate(page,'My Queue')
   await page.getByRole('heading',{name:'My Patient Queue',exact:true}).waitFor()
   check(await page.locator('.branch-scope select').count()===0,'no Owner switcher for Dentist')
  }
  await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(overflow===0,`${role}/${width} overflow: ${overflow}`)
  results.push({role,width,overflow})
  fail=true
  await page.reload()
  await page.getByRole('heading',{name:'Couldn’t load clinic data'}).waitFor()
  check(await page.locator('.workspace-label').count()===0,'malformed catalog never falls back to workspace')
  fail=false
  await page.getByRole('button',{name:/Try again|Retry/}).click()
  await page.locator('.workspace-label').waitFor();check(true,'reference retry recovers')
  await context.close()
 }
 for(const width of [375,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900}})
  await context.route('**/api/me',r=>r.fulfill({status:401,json:{message:'Unauthenticated.'}}))
  await context.route('**/*.tile.openstreetmap.org/**',r=>r.abort())
  await context.route('**/tile.openstreetmap.org/**',r=>r.abort())
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&!/401|ERR_FAILED/.test(m.text()))errors.push(m.text())})
  await page.goto(base)
  await page.locator('#locations').scrollIntoViewIfNeeded()
  for(const b of clinic.branches){
   check(await page.locator('.site-branch-card h3').filter({hasText:b.name}).count()===1,'approved public name')
   check(await page.locator('.site-branch-card address').filter({hasText:b.address}).count()===1,'approved public address')
  }
  await page.getByText('Map unavailable',{exact:true}).waitFor()
  check(await page.locator('.clinic-pin').count()===3,'three numbered pins remain on tile failure')
  check(await page.locator('.site-map-canvas').evaluate(e=>getComputedStyle(e).pointerEvents)==='none','map does not capture gestures')
  check(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)===0,'public overflow')
  await page.screenshot({path:`${output}/public-${width}.png`,fullPage:true})
  await context.close()
 }
 check(errors.length===0,JSON.stringify(errors))
 const report={checks,results,errors,mode:'HTTP fixtures; no operational identity reconciliation'}
 await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
}finally{await browser.close()}
