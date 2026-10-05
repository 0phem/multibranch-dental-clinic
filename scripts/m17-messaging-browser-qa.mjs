// M17 messaging browser QA. HTTP fixtures only (server rules are covered by the Laravel tests); no SMS/e-mail/social channel is contacted.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m17-messaging-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m17-browser'
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
const msg=(n,over={})=>({id:`01k00000000000000000000m0${n}`,body:`Message number ${n}`,sender:{name:'Alyssa Cruz',role:'Staff'},mine:false,sent_at:`2026-09-28T10:0${n}:00+08:00`,...over})
const convs=[{id:'01k0000000000000000000c002',context:'Clinical clarification',status:'Open',revision:1,patient:{id:'p2',code:'PAT-2',name:'Pedro Santos'},branch:{id:'b1',name:'Branch A'},participants:[{name:'Dr. Miguel Reyes',role:'Dentist'}],unread:0,last_message_at:null,closed_at:null},
 {id:'01k0000000000000000000c001',context:'Appointment follow-up',status:'Open',revision:1,patient:{id:'p1',code:'PAT-1',name:'Maria Santos'},branch:{id:'b1',name:'Branch A'},participants:[{name:'Alyssa Cruz',role:'Staff'}],unread:2,last_message_at:'2026-09-28T10:05:00+08:00',closed_at:null}]
const newest=[msg(5,{body:XSS}),msg(4),msg(3)]
const olderPage=[msg(2),msg(1)]
try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'patient,staff,dentist,owner').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={readBodies:[],olderFail:false,sendFail:true,limited:false,summaryFail:false,sendKeys:[],sendBodies:[],calls:0,reads:0}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path.startsWith('/api/analytics'))return route.fulfill({status:500,json:{message:'x'}})
   if(path==='/api/conversations/summary'){mode.calls++;return mode.summaryFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:{conversations:2,open:2,unread_conversations:1}}})}
   if(path==='/api/conversations'&&method==='GET'){mode.calls++;return route.fulfill({status:200,json:{data:role==='patient'?[convs[1]]:convs,meta:{per_page:25,next_cursor:null}}})}
   if(/\/messages$/.test(path)&&method==='GET'){const cursor=url.searchParams.get('cursor');if(cursor)return mode.olderFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:olderPage,meta:{per_page:30,next_cursor:null}}});return route.fulfill({status:200,json:{data:newest,meta:{per_page:30,next_cursor:newest.at(-1).id}}})}
   if(/\/messages$/.test(path)&&method==='POST'){mode.sendKeys.push(request.headers()['idempotency-key']);mode.sendBodies.push(request.postDataJSON());if(mode.limited)return route.fulfill({status:429,json:{message:'You are sending messages very quickly. Please wait a moment and try again.',code:'messages_rate_limited',retry_after:20}});if(mode.sendFail){mode.sendFail=false;return route.fulfill({status:500,json:{message:'boom'}})}return route.fulfill({status:201,json:{data:msg(9,{body:request.postDataJSON().body,mine:true,sender:{name:'You',role:'Patient'}})}})}
   if(/\/read$/.test(path)){mode.reads++;mode.readBodies.push(request.postDataJSON());return route.fulfill({status:200,json:{data:{read:true}}})}
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error'&&!/status of (500|429|403)/.test(m.text()))errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  const nameOf=label=>label==='Messages'?/^Messages/:label
  const open=async label=>{
   const direct=page.getByRole('button',{name:nameOf(label),exact:label!=='Messages'}).filter({visible:true})
   if(!await direct.count()){
    const menu=page.getByRole('button',{name:/^Menu/}).filter({visible:true})
    if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()
    const dialog=page.locator('dialog[open]')
    if(await dialog.count())return dialog.last().getByRole('button',{name:nameOf(label),exact:label!=='Messages'}).first().click()
   }
   await page.getByRole('button',{name:nameOf(label),exact:label!=='Messages'}).filter({visible:true}).first().click()
  }
  await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
  if(role==='patient'||role==='staff'||role==='dentist'){
   if(role==='patient'){
    const menuBtn=page.getByRole('button',{name:/^Menu/}).filter({visible:true})
    if(await menuBtn.count()){
     await page.waitForTimeout(600)
     check(/1/.test(await menuBtn.first().innerText()),'the unread badge shows the server count (1 conversation with unread messages)')
     mode.summaryFail=true
     await page.reload();await page.locator('.workspace-label').waitFor();await page.waitForTimeout(600)
     check(!/\d/.test(await page.getByRole('button',{name:/^Menu/}).filter({visible:true}).first().innerText()),'an unavailable summary shows no number — never a fabricated zero or count')
     mode.summaryFail=false
     await page.reload();await page.locator('.workspace-label').waitFor()
    }
   }
   await open('Messages')
   await page.getByRole('heading',{name:'Messages',exact:true}).waitFor()
   check(await page.getByText(/Nothing is sent by SMS, e-mail or social media/).count()>=1,'the screen says these are in-app messages only')
   check(await page.getByText(/\b(Delivered|Seen|Typing|Online)\b/).count()===0,'no fake delivered/seen/typing/online state')
   check(await page.getByText('Prospective Patient').count()===0&&await page.getByText('Can I move my appointment if needed?').count()===0,'no demo conversation appears in a server session')
   await page.getByRole('button',{name:/Appointment follow-up/}).click()
   await page.getByText('Message number 4').waitFor()
   await page.waitForTimeout(500)
   check(mode.reads>=1&&mode.readBodies.every(b=>Object.keys(b).join()==='up_to')&&mode.readBodies[0].up_to===newest[0].id,'opening a conversation records read state up to the newest DISPLAYED message, and nothing else is sent')
   check(await page.getByText(/<script>window\.__xss=2<\/script>/).count()>=1&&await page.locator('.content img[src="x"]').count()===0&&await page.evaluate(()=>window.__xss===undefined),'malicious message text renders as inert text')
   check(await page.locator('.content a[href*="evil.example"]').count()===0,'links inside messages are not linked')
   // older history with a recoverable failure
   mode.olderFail=true
   await page.getByRole('button',{name:'Load older messages'}).click()
   await page.getByText('Older messages unavailable').waitFor();check(true,'a failed older page is explicit')
   mode.olderFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('Message number 1').waitFor();check(await page.getByRole('button',{name:'Load older messages'}).count()===0,'older messages are reachable and the button ends with the history')
   // duplicate-safe send: the first attempt fails, the retry reuses the same Idempotency-Key
   await page.getByLabel('Your message').fill('Can you confirm my slot?')
   await page.getByRole('button',{name:'Send message'}).click()
   await page.getByText('Your message was not sent').waitFor();check(await page.getByLabel('Your message').inputValue()==='Can you confirm my slot?','a failed send keeps the typed text')
   await page.getByRole('button',{name:'Try again'}).click()
   await page.getByText('Can you confirm my slot?').last().waitFor({timeout:8000})
   check(mode.sendKeys.length===2&&mode.sendKeys[0]===mode.sendKeys[1]&&mode.sendBodies.every(b=>Object.keys(b).join()==='body'),'the retry reuses the same Idempotency-Key and only {body} is sent')
   // rate limit
   mode.limited=true
   await page.getByLabel('Your message').fill('another');await page.getByRole('button',{name:'Send message'}).click()
   await page.getByText('Please wait a moment',{exact:true}).waitFor();check(await page.getByText(/about 20 seconds/).count()>=1,'the send rate limit is explained with a wait time')
   mode.limited=false
   if(role!=='patient')check(await page.getByRole('button',{name:'Close conversation'}).count()>=1,role+' can close a conversation')
   else check(await page.getByRole('button',{name:'Close conversation'}).count()===0,'a Patient cannot close a conversation')
   if(role==='patient')check(await page.getByText('Pedro Santos').count()===0,'the Patient sees only their own conversation')
  }else{
   const names=await page.getByRole('button').allInnerTexts()
   check(!names.some(n=>n.trim()==='Messages'),'Owner has no Messages entry')
   await page.getByText('Patient communication').waitFor()
   check(await page.getByText('Not available to Owner').count()>=2,'Owner sees no conversation or inquiry count it has no authority for')
   check(await page.locator('.metric-row',{hasText:'Active conversations'}).getByText('0',{exact:true}).count()===0,'Owner sees no fabricated conversation zero')
   check(mode.calls===0,'Owner never loads conversations')
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
