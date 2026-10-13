// M9 live-queue truthfulness browser QA. HTTP FIXTURES ONLY (no live backend, no operational record is created or changed):
// branch scope, the clinic day and the 500-row cap are enforced by the Laravel tests; this script checks what the React views
// show for fixture responses. Artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m9-live-queue-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m9-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())

const row=(n,status,branch=branches[0],extra={})=>({id:`01K0000000000000000Q${String(n).padStart(6,'0')}`,status,priority:'Normal',priority_reason:null,queue_number:n,position:status==='Temporarily Away'?null:n,revision:1,clinic_date:today,closed_at:null,
 branch:{id:branch.id,name:branch.name},dentist:{id:dentists[0].id,name:'QA Dentist'},visit:{id:`01K0000000000000000V${String(n).padStart(6,'0')}`,status:'Checked In',source:'walk_in',revision:1,arrived_at:`${today}T09:0${n%10}:00+08:00`},
 patient:{id:`01K0000000000000000P${String(n).padStart(6,'0')}`,code:`PAT-${1000+n}`,name:`Queue Patient ${n}`},service:{id:services[0].id,name:services[0].name},appointment:null,...extra})
// A: Branch A has Waiting x2, Called, Treatment Ready, Temporarily Away, Served (not counted); Branch B has Waiting + Called.
const scenarios={
 normal:()=>[row(1,'Waiting'),row(2,'Waiting'),row(3,'Called'),row(4,'Treatment Ready'),row(5,'Temporarily Away'),row(6,'Served'),row(7,'Waiting',branches[1]),row(8,'Called',branches[1])],
 empty:()=>[],
 capped:()=>Array.from({length:500},(_,i)=>row(i+1,'Waiting')),
}

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'owner,staff,dentist,patient').split(',')){
  const variants=width===1024&&role!=='patient'?['normal','empty','capped','fail']:['normal']
  for(const variant of variants){
   const context=await browser.newContext({viewport:{width,height:900}})
   const queueRequests=[]
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
   await context.route('**/api/**',route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname
    const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
    const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,dentist:role==='dentist'?{id:dentists[0].id}:null}
    if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
    if(path==='/api/queue'){
     queueRequests.push(url.search)
     if(variant==='fail')return route.fulfill({status:500,json:{message:'boom'}})
     const rows=scenarios[variant==='fail'?'normal':variant]()
     return route.fulfill({status:200,json:{data:role==='staff'?rows.filter(r=>r.branch.id===branches[0].id):rows}})
    }
    if(path==='/api/queue/mine')return route.fulfill({status:200,json:{data:null}})
    const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
    return route.fulfill({status:200,json:{data:values[path]??[]}})
   })
   const page=await context.newPage()
   page.on('pageerror',e=>errors.push(`${role}/${width}/${variant}: ${e.message}`))
   page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}/${variant}: ${m.text()}`)})
   await page.emulateMedia({reducedMotion:'reduce'})
   await page.goto(`${base}/#sign-in`)
   await page.locator('.workspace-label').waitFor()
   const go=async label=>{
    const visible=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
    if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
    await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
   }
   const body=async()=>page.locator('main').innerText()
   const tag=`${role}/${width}/${variant}`
   if(role==='patient'){
    await page.waitForTimeout(600)
    const text=await page.locator('body').innerText()
    check(!/Awaiting treatment|Temporarily Away \d|Live queue by branch/.test(text),`${tag}: Patient screens show no staff queue counts`)
    check(!queueRequests.length,`${tag}: a Patient never requests the clinic queue list`)
   }else{
    // dashboard
    await page.waitForTimeout(700)
    const dash=await body()
    if(variant==='normal'||variant==='empty'){
     if(role!=='dentist')check(/Awaiting treatment/i.test(dash),`${tag}: dashboard labels the awaiting count`)
     check(!/~\d+ min|\d+\s*% workload|\bHealthy\b|\bAttention\b/.test(dash),`${tag}: dashboard has no wait estimate, workload % or Healthy/Attention label`)
    }
    if(role==='owner'||role==='staff'){
     const text=await page.locator('.stat-card',{hasText:'Awaiting treatment'}).first().innerText()
     if(variant==='normal'){
      const expected=role==='staff'?'4':'6' // staff scope returns Branch A only: Waiting 2 + Called + Treatment Ready; owner also has Branch B: +2
      check(new RegExp(`\\b${expected}\\b`).test(text),`${tag}: awaiting = Waiting + Called + Treatment Ready (${expected}); got ${text.replace(/\n/g,' ')}`)
      check(/Waiting \+ Called \+ Treatment Ready/i.test(text),`${tag}: combined count defines its states`)
     }
     if(variant==='empty')check(/\b0\b/.test(text),`${tag}: zero shown after a successful empty response`)
     if(variant==='capped'||variant==='fail'){check(!/\b0\b|\b500\b/.test(text.split('\n')[1]||''),`${tag}: no number after an incomplete/failed response`);check(/Unavailable/i.test(text),`${tag}: card says Unavailable`)}
     check(!/Healthy|Attention|\d+%/.test(await page.locator('main').innerText()),`${tag}: no capacity labels on the dashboard`)
    }
    await page.screenshot({path:`${output}/${role}-${width}-${variant}-dashboard.png`,fullPage:true})
    if(role==='owner'&&variant==='normal'){
     check(await page.getByRole('button',{name:'Open queue',exact:true}).count()===0,`${tag}: no link to a queue page the Owner cannot open`)
     await page.getByRole('button',{name:'Branch details',exact:true}).click()
     await page.getByRole('heading',{name:'Live Queue by Branch',exact:true}).waitFor();check(true,`${tag}: the dashboard link opens Live Queue by Branch`)
     await go('Executive Dashboard')
    }
    // queue page (the Owner navigation has no queue page)
    if(role!=='owner'){
      await go(role==='dentist'?'My Queue':'Live Queue')
      await page.getByRole('heading',{name:role==='dentist'?'My Patient Queue':'Patient Queue',exact:true}).waitFor()
      await page.waitForTimeout(400)
      const q=await body()
      check(!/Est\. wait/.test(q),`${tag}: no estimated-wait column in a clinic-server session`)
      if(variant==='normal'){
       check(['Waiting','Called','Treatment Ready','Temporarily Away'].every(t=>q.toLowerCase().includes(t.toLowerCase())),`${tag}: all four status counts are labelled`)
       check(/Served patients are not counted/.test(q),`${tag}: Served exclusion is stated`)
       const cols=await page.locator('.queue-count-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length)
       check(cols===(width<=1024?2:4),`${tag}: count cards use ${width<=1024?2:4} columns; got ${cols}`)
      }
      if(variant==='capped'||variant==='fail')check(/Live queue counts unavailable/i.test(q)&&await page.locator('.stats-grid[aria-label="Live queue counts for today"]').count()===0,`${tag}: unavailable notice, no count cards`)
      if(variant==='empty')check(await page.locator('.stats-grid[aria-label="Live queue counts for today"] .stat-value',{hasText:'0'}).count()===4,`${tag}: four zeros after a complete empty response`)
      check(queueRequests.every(s=>s===`?date=${today}`),`${tag}: the queue is requested for the Asia/Manila clinic day ${today}`)
    }
    if(role!=='owner')await page.screenshot({path:`${output}/${role}-${width}-${variant}-queue.png`,fullPage:true})
    // capacity page
    if(role==='owner'||role==='staff'){
     await go('Live Queue by Branch')
     await page.getByRole('heading',{name:'Live Queue by Branch',exact:true}).waitFor()
     const c=await body()
     check(!/Threshold|Healthy|Attention|\d+\s*%|~\s*\d+\s*min|alternative/.test(c),`${tag}: capacity page has no threshold, percentage, minute estimate, status label or alternative-branch output`)
     if(variant==='normal'){
      check(/Branch A[\s\S]*4 awaiting/.test(c),`${tag}: Branch A awaiting 4`)
      if(role==='owner')check(/Branch B[\s\S]*2 awaiting/.test(c)&&/Branch C[\s\S]*0 awaiting/.test(c),`${tag}: Branch B 2 and Branch C 0 (complete response)`)
     }
    }
   }
   await page.screenshot({path:`${output}/${role}-${width}-${variant}.png`,fullPage:true})
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
   check(overflow===0,`${tag} overflow: ${overflow}`)
   results.push({role,width,variant,overflow})
   await context.close()
  }
 }

 // ---- overlapping requests: a slow OLDER response must not overwrite a newer one (staff, 1024) -------------------------
 {
  const context=await browser.newContext({viewport:{width:1024,height:900}})
  let n=0
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname
   const me={id:'01K00000000000000000000010',role:'staff',email:'staff.reception@example.test',name:'QA account',account_status:'Active',branch_scopes:[{id:'b1'}],patient:null,dentist:null}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/queue'){
    const k=++n
    if(k===1){await new Promise(r=>setTimeout(r,2500));return route.fulfill({status:200,json:{data:scenarios.normal().filter(r=>r.branch.id===branches[0].id)}})} // OLD response, arrives last
    return route.fulfill({status:200,json:{data:[]}}) // newer response: complete and empty
   }
   if(path==='/api/queue/mine')return route.fulfill({status:200,json:{data:null}})
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()
  const visible=page.getByRole('button',{name:'Live Queue',exact:true}).filter({visible:true})
  if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
  await page.getByRole('button',{name:'Live Queue',exact:true}).filter({visible:true}).first().click()
  await page.getByRole('heading',{name:'Patient Queue',exact:true}).waitFor()
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange'))) // second request while the first is still pending
  await page.locator('.stats-grid[aria-label="Live queue counts for today"] .stat-value',{hasText:'0'}).first().waitFor()
  check(true,'newer empty response shows zeros')
  await page.waitForTimeout(3200) // the older response now arrives
  check(await page.locator('.stats-grid[aria-label="Live queue counts for today"] .stat-value',{hasText:'0'}).count()===4,'the late older response did not overwrite the newer counts')
  check(n>=2,'two overlapping queue requests were made')
  await context.close()
 }
 // ---- Asia/Manila midnight: counts sent before midnight are not shown after it (staff, 1024; Playwright fake clock) -----
 {
  const context=await browser.newContext({viewport:{width:1024,height:900}})
  const dayOf=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date(iso))
  const start='2026-09-19T15:59:20Z' // 23:59:20 on 2026-09-19 in Manila
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  const dates=[]
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),path=url.pathname
   const me={id:'01K00000000000000000000010',role:'staff',email:'staff.reception@example.test',name:'QA account',account_status:'Active',branch_scopes:[{id:'b1'}],patient:null,dentist:null}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/queue'){
    const date=url.searchParams.get('date');dates.push(date)
    if(date==='2026-09-20')await new Promise(r=>setTimeout(r,2500)) // the new-day response is slow
    return route.fulfill({status:200,json:{data:scenarios.normal().filter(r=>r.branch.id===branches[0].id).map(r=>({...r,clinic_date:date}))}})
   }
   if(path==='/api/queue/mine')return route.fulfill({status:200,json:{data:null}})
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  await page.clock.install({time:new Date(start)})
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()
  const visible=page.getByRole('button',{name:'Live Queue',exact:true}).filter({visible:true})
  if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
  await page.getByRole('button',{name:'Live Queue',exact:true}).filter({visible:true}).first().click()
  await page.getByRole('heading',{name:'Patient Queue',exact:true}).waitFor()
  await page.locator('.stats-grid[aria-label="Live queue counts for today"]').waitFor()
  check(dates[0]==='2026-09-19'&&dayOf(start)==='2026-09-19','before midnight the queue is requested for 2026-09-19')
  await page.clock.runFor(45000) // crosses 00:00 Manila; the 15 s ticker and 30 s poll fire
  await page.getByText(/out of date for today|Loading the live queue/i).first().waitFor({timeout:2000})
  check(await page.locator('.stats-grid[aria-label="Live queue counts for today"]').count()===0,'after midnight the old day\'s counts are not shown while the new day loads')
  check(dates.includes('2026-09-20'),'after midnight the queue is requested for the new Manila day 2026-09-20')
  await page.waitForTimeout(3200)
  await page.clock.runFor(1000)
  await page.locator('.stats-grid[aria-label="Live queue counts for today"]').waitFor({timeout:3000})
  check(true,'counts return once the new day\'s complete response arrives')
  await context.close()
 }
 const unexpected=errors.filter(e=>!/status of 500/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
