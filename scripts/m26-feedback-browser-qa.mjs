// M26 feedback foundation browser QA. HTTP fixtures only (server rules are covered by the Laravel tests).
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m26-feedback-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m26-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))


const XSS='<img src=x onerror="window.__xss=1"><script>window.__xss=2</script> https://evil.example/x'
const visit=n=>({id:`01k00000000000000000000v0${n}`,date:`2026-09-2${n}`,services:['Oral Prophylaxis']})
const mine=(n,over={})=>({id:`01k00000000000000000000f0${n}`,visit:visit(1),body:`My feedback ${n}`,submitted_at:`2026-09-28T10:0${n}:00+08:00`,...over})
const review=(n,over={})=>({id:`01k00000000000000000000r0${n}`,submitted_at:`2026-09-28T10:0${n}:00+08:00`,patient:{id:'p',code:`PAT-${n}`,name:`Patient ${n}`},visit:{id:'v',date:'2026-09-28'},branch:{id:'b1',name:'Branch A'},excerpt:`Excerpt ${n}`,truncated:false,...over})
try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'patient,owner,staff,dentist').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={olderFail:false,sendFail:true,limited:false,keys:[],bodies:[],calls:0,sent:[]}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path.startsWith('/api/analytics'))return route.fulfill({status:500,json:{message:'x'}})
   if(path==='/api/feedback/eligible-visits'){mode.calls++;return route.fulfill({status:200,json:{data:[visit(2),visit(1)],meta:{per_page:25,next_cursor:null}}})}
   if(path==='/api/feedback/mine'){mode.calls++;const cursor=url.searchParams.get('cursor');if(cursor)return mode.olderFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:[mine(1)],meta:{per_page:25,next_cursor:null}}});return route.fulfill({status:200,json:{data:[mine(3,{body:XSS}),mine(2),...mode.sent],meta:{per_page:25,next_cursor:'01k00000000000000000000f02'}}})}
   if(path==='/api/feedback'&&method==='POST'){mode.keys.push(request.headers()['idempotency-key']);mode.bodies.push(request.postDataJSON());if(mode.limited)return route.fulfill({status:429,json:{message:'You are submitting feedback very quickly.',code:'feedback_rate_limited',retry_after:15}});if(mode.sendFail){mode.sendFail=false;return route.fulfill({status:500,json:{message:'boom'}})}return route.fulfill({status:201,json:{data:mine(9,{body:request.postDataJSON().body})}})}
   if(path==='/api/feedback'&&method==='GET'){mode.calls++;return role==='patient'?route.fulfill({status:200,json:{data:[],meta:{per_page:25,next_cursor:null}}}):route.fulfill({status:403,json:{message:'Forbidden.'}})}
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error'&&!/status of (500|429|403)/.test(m.text()))errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  const nameOf=label=>/^(Share Feedback|Share feedback)$/.test(label)?/^Share [Ff]eedback$/:label
  const open=async label=>{
   const direct=page.getByRole('button',{name:nameOf(label),exact:typeof nameOf(label)==='string'}).filter({visible:true})
   if(!await direct.count()){
    const menu=page.getByRole('button',{name:/^Menu/}).filter({visible:true})
    if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()
    const dialog=page.locator('dialog[open]')
    if(await dialog.count())return dialog.last().getByRole('button',{name:nameOf(label),exact:typeof nameOf(label)==='string'}).first().click()
   }
   await page.getByRole('button',{name:nameOf(label),exact:typeof nameOf(label)==='string'}).filter({visible:true}).first().click()
  }
  await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
  if(role==='patient'){
   await open('Share Feedback')
   await page.getByRole('heading',{name:'Share feedback',exact:true}).waitFor()
   check(await page.getByText(/it is not anonymous/).count()>=1&&await page.getByText(/has not set a response time/).count()>=1,'the page makes no response-time or anonymity promise')
   check(await page.getByText(/\b(star|rating|category|survey|testimonial)\b/i).count()===0,'no rating, category, survey or testimonial UI')
   // own history first: malicious text inert, older page failure + retry
   await page.getByText('My feedback 2').waitFor()
   check(await page.getByText(/<script>window\.__xss=2<\/script>/).count()>=1&&await page.locator('.content img[src="x"]').count()===0&&await page.evaluate(()=>window.__xss===undefined),'malicious feedback text renders as inert text')
   check(await page.locator('.content a[href*="evil.example"]').count()===0,'links inside feedback are not linked')
   mode.olderFail=true
   await page.getByRole('button',{name:'Load older entries'}).click()
   await page.getByText('Older entries unavailable').waitFor();check(true,'a failed older page is explicit')
   mode.olderFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('My feedback 1').waitFor();check(await page.getByText(/Showing 3 entries\. That is all of them\./).count()>=1,'older entries are reachable and the end is stated')
   // duplicate-safe submission
   await page.getByLabel('Which visit?').selectOption({index:1})
   await page.getByLabel('Your feedback').fill('Thank you for the care.')
   await page.getByRole('button',{name:'Send feedback'}).click()
   await page.getByText('Your feedback was not sent').waitFor();check(await page.getByLabel('Your feedback').inputValue()==='Thank you for the care.','a failed send keeps the typed text')
   await page.getByRole('button',{name:'Try again'}).click()
   await page.getByText('Your feedback was saved.').waitFor({timeout:8000})
   check(mode.keys.length===2&&mode.keys[0]===mode.keys[1]&&mode.bodies.every(b=>Object.keys(b).sort().join()==='body,visit_id'),'the retry reuses the same Idempotency-Key and only {visit_id, body} is sent')
   mode.limited=true
   await page.getByLabel('Which visit?').selectOption({index:1});await page.getByLabel('Your feedback').fill('again');await page.getByRole('button',{name:'Send feedback'}).click()
   await page.getByText('Please wait a moment',{exact:true}).waitFor();check(await page.getByText(/about 15 seconds/).count()>=1,'the rate limit is explained with a wait time')
  }else{
   const names=await page.getByRole('button').allInnerTexts()
   check(!names.some(n=>/Feedback/i.test(n.trim())),role+' has no feedback navigation entry')
   if(role==='owner'){
    await page.getByText('Patient communication').waitFor()
    check(await page.getByText(/feedback|satisfaction|complaint/i).count()===0,'Owner dashboard has no feedback counter, link or metric')
   }
   check(mode.calls===0,role+' never loads feedback')
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
