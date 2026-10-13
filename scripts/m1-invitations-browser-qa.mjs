// M1 employee invitations + M18 dispatch wording, browser QA. HTTP FIXTURES ONLY (no live backend; nothing is created
// on any database). Server rules are covered by backend/tests/Feature/Identity/EmployeeInvitationTest.php.
// Usage: PLAYWRIGHT_MODULE=<playwright/index.mjs> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m1-invitations-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m1-browser'
await mkdir(output,{recursive:true})
let checks=0;const results=[],errors=[]
const check=(v,m)=>{assert.ok(v,m);checks++}
const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id)}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))
const TOKEN='Q'.repeat(30)+'z9'.repeat(17)
const inv=(over={})=>({id:'01KINVITE00000000000000001',name:'Rina Lopez',email:'rina@example.test',role:'staff',title:'Receptionist',branch:{id:'b1',name:'Branch A'},status:'Invited',issued_at:'2026-10-13T09:00:00+08:00',expires_at:'2026-10-16T09:00:00+08:00',expired:false,last_delivery:{status:'logged_only'},...over})

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number)){
  // ---------------- Owner: invite, validation, resend, cancel ----------------
  {
   const context=await browser.newContext({viewport:{width,height:900}})
   const state={rows:[],posts:[]}
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
   await context.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,method=req.method()
    if(path==='/api/me')return route.fulfill({json:{data:{id:'01K00000000000000000000010',role:'owner',email:'owner@example.test',name:'QA Owner',account_status:'Active',branch_scopes:[],patient:null,dentist:null}}})
    if(path==='/api/employee-invitations'&&method==='GET')return route.fulfill({json:{data:state.rows}})
    if(path==='/api/employee-invitations'&&method==='POST'){
     const body=JSON.parse(req.postData()||'{}');state.posts.push(body)
     if(body.email==='taken@example.test')return route.fulfill({status:422,json:{message:'This email address is already registered.',errors:{email:['This email address is already registered.']}}})
     const row=inv({email:body.email,name:`${body.first_name} ${body.last_name}`});state.rows=[row]
     return route.fulfill({status:201,json:{data:row,delivery:{status:'logged_only',message:'Recorded in the local mail log only. No email was sent to the recipient (the mail transport is not configured for delivery).'}}})
    }
    if(/\/resend$/.test(path)){state.rows=[inv({status:'Invited',last_delivery:{status:'transport_accepted'}})];return route.fulfill({json:{data:state.rows[0],delivery:{status:'transport_accepted',message:'Accepted by the mail transport. Delivery to the recipient’s inbox is not confirmed.'}}})}
    if(/\/cancel$/.test(path)){state.rows=[inv({status:'Revoked'})];return route.fulfill({json:{data:state.rows[0]}})}
    if(path==='/api/users')return route.fulfill({json:{data:[{id:'01KOWNER',name:'QA Owner',first_name:'QA',last_name:'Owner',email:'owner@example.test',phone:null,role:'owner'},{id:'01KSTAFF',name:'Rina Lopez',first_name:'Rina',last_name:'Lopez',email:'rina@example.test',phone:null,role:'staff'}]}})
    if(path==='/api/users/01KSTAFF/branch-scopes'){
     if(method==='PUT'){const body=JSON.parse(req.postData()||'{}');state.scopePut=body;state.scopes=body.branch_refs}
     return route.fulfill({json:{data:{user:{id:'01KSTAFF',role:'staff'},branch_scopes:(state.scopes||['b1']).map(id=>({id,name:branches.find(b=>b.id===id).name}))}}})
    }
    const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
    return route.fulfill({json:{data:values[path]??[]}})
   })
   const page=await context.newPage()
   page.on('pageerror',e=>errors.push(`owner/${width}: ${e.message}`))
   page.on('console',m=>{if(m.type()==='error')errors.push(`owner/${width}: ${m.text()}`)})
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
   const visible=page.getByRole('button',{name:'User Management',exact:true}).filter({visible:true})
   if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   await page.getByRole('button',{name:'User Management',exact:true}).filter({visible:true}).first().click()
   await page.getByRole('heading',{name:'Invite an employee'}).waitFor()
   await page.getByText('No open invitations.').waitFor();check(true,`owner/${width}: empty list only after a successful load`)
   const card=page.locator('section.card',{has:page.getByRole('heading',{name:'Invite an employee'})})
   check(await card.locator('input[type=password]').count()===0,`owner/${width}: the Owner never sets an employee password`)
   const roles=await card.locator('select').first().locator('option').allInnerTexts()
   check(JSON.stringify(roles)===JSON.stringify(['Staff','Dentist']),`owner/${width}: only Staff and Dentist are invitable (${roles})`)
   await card.getByLabel('Email').fill('taken@example.test')
   await card.getByLabel('First name').fill('Rina');await card.getByLabel('Last name').fill('Lopez')
   await card.getByLabel('Job title').fill('Receptionist')
   await card.getByLabel('Branch').selectOption('b1')
   await card.getByLabel('Shift starts').fill('09:00');await card.getByLabel('Shift ends').fill('17:00')
   await card.getByRole('button',{name:'Send invitation'}).click()
   await page.getByText('Invitation not created').waitFor()
   check(await card.getByText('This email address is already registered.').count()>=1,`owner/${width}: a server field error is shown on the field`)
   await card.getByLabel('Email').fill('rina@example.test')
   await card.getByRole('button',{name:'Send invitation'}).click()
   await page.getByText('Invitation not emailed').waitFor()
   const n=await page.locator('main').innerText()
   check(/local mail log only/.test(n)&&!/\bdelivered\b|successfully/i.test(n),`owner/${width}: logged-only send is reported as not emailed`)
   check(state.posts.at(-1).branch_ref==='b1'&&state.posts.at(-1).role==='staff'&&!('password' in state.posts.at(-1)),`owner/${width}: payload carries branch and role, no password`)
   check(await page.getByText('Recorded locally only (not emailed)').count()===1,`owner/${width}: list shows the last send outcome`)
   await page.screenshot({path:`${output}/owner-${width}-invited.png`,fullPage:true})
   await page.getByRole('button',{name:'Resend'}).click()
   await page.getByText(/Resent to Rina Lopez/).waitFor()
   check(/not confirmed/.test(await page.locator('main').innerText()),`owner/${width}: transport acceptance says inbox delivery is not confirmed`)
   await page.getByRole('button',{name:'Cancel',exact:true}).click()
   const dialog=page.getByRole('dialog');await dialog.waitFor()
   await dialog.getByRole('button',{name:'Cancel invitation'}).click()
   await page.getByText('Invitation cancelled').waitFor()
   check(await page.getByRole('button',{name:'Reopen and send'}).count()===1,`owner/${width}: a cancelled invitation can be reopened`)
   // Staff authorization branch access (existing Owner-only scope command)
   check(await page.getByRole('button',{name:'Branch access'}).count()===1,`owner/${width}: only the Staff row offers Branch access`)
   await page.getByRole('button',{name:'Branch access'}).click()
   const sd=page.getByRole('dialog');await sd.getByText('Saved access: Branch A.').waitFor()
   check(await sd.getByRole('button',{name:'Save branch access'}).isDisabled(),`owner/${width}: nothing to save until access changes`)
   await sd.getByLabel('Branch B').check()
   await sd.getByRole('button',{name:'Save branch access'}).click()
   await sd.getByText('Saved access: Branch A, Branch B.').waitFor()
   check(JSON.stringify(state.scopePut)===JSON.stringify({branch_refs:['b1','b2']}),`owner/${width}: the server receives exactly the chosen branches`)
   await page.screenshot({path:`${output}/owner-${width}-branch-access.png`})
   await sd.getByRole('button',{name:'Close',exact:true}).click()
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
   check(overflow===0,`owner/${width} overflow ${overflow}`)
   results.push({width,role:'owner',overflow})
   await context.close()
  }
  // ---------------- public accept page ----------------
  {
   const context=await browser.newContext({viewport:{width,height:900}})
   let mode='fail'
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
   await context.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path==='/api/me')return route.fulfill({status:401,json:{message:'Unauthenticated.'}})
    if(path==='/api/invitations/accept')return mode==='fail'?route.fulfill({status:422,json:{message:'Invalid.',errors:{token:['This invitation link is not valid or has expired. Ask the clinic Owner to send a new one.']}}}):route.fulfill({json:{data:{accepted:true}}})
    return route.fulfill({json:{data:[]}})
   })
   const page=await context.newPage()
   page.on('pageerror',e=>errors.push(`accept/${width}: ${e.message}`))
   await page.goto(`${base}/#accept-invitation?email=rina%40example.test&token=${TOKEN}`)
   await page.getByRole('heading',{name:'Set your password'}).waitFor()
   check(!(await page.evaluate(()=>location.href)).includes(TOKEN),`accept/${width}: the token is removed from the address bar`)
   check(/Choose a password for rina@example\.test/.test(await page.locator('main').innerText()),`accept/${width}: the invited email is shown`)
   const pw=page.locator('input[type=password]')
   await pw.nth(0).fill('Passw0rd1');await pw.nth(1).fill('Different1')
   await page.getByRole('button',{name:'Set password'}).click()
   check(await page.getByText('The passwords do not match.').count()===1,`accept/${width}: mismatch is caught before sending`)
   await pw.nth(1).fill('Passw0rd1')
   await page.getByRole('button',{name:'Set password'}).click()
   await page.getByText(/not valid or has expired/).waitFor();check(true,`accept/${width}: the generic server failure is shown`)
   mode='ok'
   await page.getByRole('button',{name:'Set password'}).click()
   await page.getByText('Password set').waitFor()
   await page.screenshot({path:`${output}/accept-${width}-done.png`,fullPage:true})
   await page.getByRole('button',{name:'Go to sign in'}).click()
   await page.getByRole('heading',{name:'Welcome back'}).waitFor();check(true,`accept/${width}: continues to sign in`)
   await page.goto(`${base}/#accept-invitation?email=x`)
   await page.reload()
   await page.getByText('Link not recognised').waitFor()
   check(await page.locator('input[type=password]').count()===0,`accept/${width}: a malformed link shows no form`)
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
   check(overflow===0,`accept/${width} overflow ${overflow}`)
   await context.close()
  }
 }

 // ---------------- the activated employee opens THEIR OWN workspace (server-driven identity) ----------------
 for(const width of [375,1440]){
  for(const who of ['staff','dentist']){
   const context=await browser.newContext({viewport:{width,height:900}})
   const UID=who==='staff'?'01KNEWSTAFF000000000000001':'01KNEWDENT0000000000000001'
   const profile=who==='staff'?{id:'s-01knew',userId:UID,personId:'per-s-01knew',name:'Rina Lopez',title:'Front Desk Lead',branchId:'b2',branch:'Branch B',shiftStart:'09:00:00',shiftEnd:'17:00:00',available:false}
    :{id:'d-01knew',userId:UID,personId:'per-d-01knew',name:'Ana Reyes',branch_ids:['b1'],service_ids:[],shiftStart:'09:00:00',shiftEnd:'17:00:00',available:false}
   const me={id:UID,role:who,email:who==='staff'?'rina@example.test':'ana@example.test',name:who==='staff'?'Rina Lopez':'Ana Reyes',first_name:who==='staff'?'Rina':'Ana',last_name:who==='staff'?'Lopez':'Reyes',account_status:'Active',branch_scopes:who==='staff'?[{id:'b2',name:'Branch B'}]:[],patient:null,
    employee:who==='staff'?{profile_id:'s-01knew',branch_id:'b2',title:'Front Desk Lead'}:{profile_id:'d-01knew',branch_id:'b1',title:null}}
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
   await context.route('**/api/**',route=>{
    const path=new URL(route.request().url()).pathname
    if(path==='/api/me')return route.fulfill({json:{data:me}})
    const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':who==='dentist'?[...dentists,profile]:dentists,'/api/staff':who==='staff'?[...staff,profile]:staff}
    return route.fulfill({json:{data:values[path]??[]}})
   })
   const page=await context.newPage()
   page.on('pageerror',e=>errors.push(`${who}-new/${width}: ${e.message}`))
   await page.goto(`${base}/#sign-in`)
   await page.locator('.workspace-label').waitFor({timeout:15000})
   await page.locator('main h1').first().waitFor({timeout:15000}) // the role's home page has rendered
   const body=await page.locator('body').innerText()
   const wide=width>=1024 // the name sits in the sidebar, which is a menu on narrow screens
   check(who==='staff'?(!wide||/Rina Lopez/.test(body))&&/Branch B/.test(body):(!wide||/Ana Reyes/.test(body))&&/Branch A/.test(body),`${who}-new/${width}: the workspace is the invited person's own, at their branch`)
   check(!/Alyssa Cruz|Miguel Reyes/.test(body),`${who}-new/${width}: never the demo identity`)
   check(!/no workspace|configured yet/i.test(body),`${who}-new/${width}: no fail-closed message`)
   await page.screenshot({path:`${output}/${who}-new-${width}.png`,fullPage:false})
   await context.close()
  }
 }
 const unexpected=errors.filter(e=>!/status of (401|422)/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
