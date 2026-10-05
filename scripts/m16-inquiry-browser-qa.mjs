// M16 external-inquiry browser QA. HTTP fixtures only (server rules are covered by the Laravel tests); no social platform is contacted.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m16-inquiry-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m16-browser'
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
const inq=(n,over={})=>({id:`01k00000000000000000000i0${n}`,source:'Facebook',capture:'Recorded manually by Staff',contact:{name:`Contact ${n}`,detail:'@handle'},topic:`Question ${n}`,status:'Open',revision:1,branch:{id:'b1',name:'Branch A'},assigned:{name:'Alyssa Cruz'},patient:null,appointment:null,received_at:'2026-09-28T10:00:00+08:00',responded_at:null,closed_at:null,converted_at:null,...over})
const page1=[inq(5,{topic:XSS,contact:{name:'<b>Bold</b>',detail:'javascript:alert(1)'}}),inq(4),inq(3)]
const page2=[inq(2),inq(1)]
try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'staff,owner,dentist,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={moreFail:false,summaryFail:false,posts:[],calls:0}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path.startsWith('/api/analytics'))return route.fulfill({status:500,json:{message:'analytics unavailable'}})
   if(path==='/api/inquiries/summary'){if(mode.summaryFail)return route.fulfill({status:500,json:{message:'boom'}});return route.fulfill({status:200,json:{data:{open:3,responded:0,closed:0,converted:0,total:3}}})}
   if(path==='/api/inquiries'&&method==='GET'){mode.calls++;const cursor=url.searchParams.get('cursor');if(cursor)return mode.moreFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:page2,meta:{per_page:25,next_cursor:null}}});return route.fulfill({status:200,json:{data:page1,meta:{per_page:25,next_cursor:page1.at(-1).id}}})}
   if(path==='/api/inquiries'&&method==='POST'){mode.posts.push(request.postDataJSON());return route.fulfill({status:201,json:{data:inq(9,{topic:request.postDataJSON().topic,contact:{name:request.postDataJSON().name,detail:null}})}})}
   if(/\/respond$/.test(path)){mode.posts.push({respond:path});return route.fulfill({status:200,json:{data:inq(3,{status:'Responded',revision:2,responded_at:'2026-09-28T11:00:00+08:00'})}})}
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error'&&!/status of (500|403)/.test(m.text()))errors.push(`${role}/${width}: ${m.text()}`)})
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
  if(role==='staff'){
   // dashboard: the real server count, then unavailable (never zero) when the count cannot be loaded
   await page.getByText('Open inquiries').first().waitFor()
   await page.getByText('3',{exact:true}).first().waitFor({timeout:8000});check(await page.getByText('Assigned to you').count()>=1,'the Staff dashboard shows the real server count')
   mode.summaryFail=true
   await page.reload();await page.locator('.workspace-label').waitFor()
   await page.getByText('Unavailable',{exact:true}).first().waitFor({timeout:8000});check(await page.getByText('Everything is on track').count()===0,'a failed count is shown as unavailable, never as zero or "on track"')
   mode.summaryFail=false
   await page.reload();await page.locator('.workspace-label').waitFor()
   await open('Social Inquiries')
   await page.getByRole('heading',{name:'Social Media & External Inquiry Management'}).waitFor()
   await page.getByText('Question 4').first().waitFor();check(true,'the server worklist is shown')
   check(await page.getByText('Prospective Patient').count()===0&&await page.getByText('Nicole Reyes').count()===0,'no demo inquiry appears in a server session')
   check(await page.getByText(/is not connected to Facebook, Instagram, the website or any other platform/).count()>=1,'the screen says no platform is connected')
   check(await page.getByText(/does not mean the clinic has an official account there/).count()>=1&&await page.getByRole('columnheader',{name:'Reported source'}).count()>=1,'the source is presented as reported by Staff, not an official channel')
   check(await page.getByText('Recorded manually by Staff').count()>=1,'source provenance is explicit')
   check(await page.getByText(/\b(Delivered|Synced|Seen)\b/).count()===0,'no delivery/sync/seen claim')
   // malicious content is inert text
   check(await page.getByText(/<script>window\.__xss=2<\/script>/).count()>=1&&await page.locator('.content img[src="x"]').count()===0,'markup in an inquiry renders as text')
   check(await page.evaluate(()=>window.__xss===undefined),'no injected script or handler ran')
   check(await page.locator('.content a[href*="evil.example"]').count()===0,'links inside inquiries are not linked')
   // pagination with a recoverable failure
   await page.getByText(/Showing 3 inquiries\. Older inquiries are available\./).waitFor()
   mode.moreFail=true
   await page.getByRole('button',{name:'Load older inquiries'}).click()
   await page.getByText('Older inquiries unavailable').waitFor();check(true,'a failed later page is explicit')
   mode.moreFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText(/Showing 5 inquiries\. That is all of them\./).waitFor();check(await page.getByText('Question 1').count()>=1,'older inquiries are reachable')
   // capture: only typed fields, manual
   await page.getByLabel('Contact name').fill('Ana Reyes');await page.getByLabel('What they asked').fill('Do you do whitening?')
   await page.getByRole('button',{name:'Record inquiry'}).click()
   await page.getByText('Inquiry recorded and assigned to you.').waitFor({timeout:8000})
   const sent=mode.posts.find(p=>p.name)
   check(sent&&Object.keys(sent).sort().join()==='branch_ref,name,source,topic','only typed fields are sent (no assignee/status/ownership)')
   // respond is labelled as outside the system
   await page.getByRole('button',{name:'Mark responded'}).first().click()
   await page.getByText('Recorded that you responded outside this system.').waitFor({timeout:8000});check(true,'responding is not presented as a delivered message')
  }else{
   if(role==='owner'){
    await page.getByText('Patient communication').waitFor()
    check(await page.getByText('Not available to Owner').count()>=1,'the Owner dashboard does not show an inquiry count it has no authority for')
    check(await page.getByText(/Open inquiries/).count()>=1&&await page.locator('.metric-row',{hasText:'Open inquiries'}).getByText('0',{exact:true}).count()===0,'Owner sees no fabricated inquiry zero')
    await open('Analytics & Reports')
    await page.getByText('Operational Reporting & Analytics').waitFor({timeout:10000})
    await page.waitForTimeout(800)
    const comm=page.locator('text=Communication').first()
    if(await comm.count()){check(await page.getByText('Unavailable',{exact:true}).count()>=1&&await page.getByText(/No authoritative communication count exists yet/).count()>=1,'analytics Communication is unavailable, not a fabricated zero')}
    else check(true,'analytics shows no Communication count without an authoritative source')
   }
   const names=await page.getByRole('button').allInnerTexts()
   check(!names.some(n=>n.trim()==='Social Inquiries'),role+' has no inquiry entry')
   check(mode.calls===0,role+' never loads inquiries')
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
