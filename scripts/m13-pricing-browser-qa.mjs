// M13 Services & Pricing browser QA. HTTP fixtures only (server rules are covered by the Laravel tests); no record is changed.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m13-pricing-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m13-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))


const ver=(id,svc,svcName,branch,kind,amount,from,extra={})=>({id,service:{id:svc,code:svc.toUpperCase(),name:svcName},branch:branch?{id:branch,name:'Branch '+branch}:null,level:branch?'branch':'base',kind,amount,effective_from:from,source:'owner_confirmed',created_at:'2026-09-01T09:00:00+08:00',created_by:{name:'Owner QA'},retracted_at:null,retracted_by:null,...extra})
const versions=[
 ver('01k0000000000000000000p001','svc1','Dental Consultation',null,'priced','1500.50','2026-09-01'),
 ver('01k0000000000000000000p002','svc1','Dental Consultation','b1','priced','1700.00','2026-09-10'),
 ver('01k0000000000000000000p003','svc1','Dental Consultation',null,'priced','1800.00','2099-01-01'),
]
try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'owner,staff,dentist,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={listFail:false,deep:false,deepFail:false,calls:[],posts:[],retracts:[]}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/service-prices'&&method==='GET'&&mode.deep){const cursor=url.searchParams.get('cursor');mode.calls.push(cursor||'first');const n=cursor?Number(cursor.slice(1)):0;if(cursor==='d20'&&mode.deepFail)return route.fulfill({status:500,json:{message:'boom'}});return route.fulfill({status:200,json:{data:n===0?versions:[],meta:{per_page:100,next_cursor:n>=21?null:'d'+(n+1)}}})}
   if(path==='/api/service-prices'&&method==='GET')return mode.listFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:versions}})
   if(/^\/api\/services\/[^/]+\/prices$/.test(path)&&method==='POST'){mode.posts.push(request.postDataJSON());return route.fulfill({status:201,json:{data:ver('01k0000000000000000000p009','svc2','Oral Prophylaxis',null,'priced','1234.00','2099-02-01')}})}
   if(/retract$/.test(path)){mode.retracts.push(path);return route.fulfill({status:200,json:{data:{...versions[2],retracted_at:'2026-09-28T10:00:00+08:00',retracted_by:{name:'Owner QA'}}}})}
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
  if(role==='owner'){
   mode.listFail=true
   await open('Services & Pricing')
   await page.getByText('Prices could not be loaded').waitFor();check(true,'a failed price load is explicit')
   check(await page.getByRole('columnheader',{name:'Confirmed base price today'}).count()===0,'no price table (and no fallback price) while the load failed')
   mode.listFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByRole('columnheader',{name:'Confirmed base price today'}).waitFor();check(true,'Retry recovers')
   check(await page.getByText('₱1,500.50').count()>=1,'the confirmed base price in effect is shown with exact decimals')
   check(await page.getByText('₱1,800.00').count()===0,'a scheduled future price is not shown as current')
   check(await page.getByText(/No confirmed price/).count()>=1,'a service without a confirmed price says so honestly')
   check(await page.getByText(/reference fee/i).count()===0,'no reference/demo fee is shown beside confirmed prices')
   await page.getByRole('button',{name:'Manage prices'}).first().click()
   await page.getByText('Scheduled').first().waitFor();check(true,'future versions are labelled Scheduled')
   const amount=page.getByLabel(/Confirmed price/)
   check((await amount.inputValue())==='','the price field is never pre-filled from the reference fee')
   await amount.fill('1234.00')
   const date=page.getByLabel('Effective from');await date.fill('2099-02-01')
   await page.getByRole('button',{name:'Review price change'}).click()
   await page.getByRole('button',{name:'Confirm price'}).click()
   await page.getByText('Confirmed price saved.').waitFor({timeout:8000})
   check(mode.posts.length===1&&mode.posts[0].amount==='1234.00'&&typeof mode.posts[0].amount==='string','the amount travels as a decimal string')
   check(!('source' in mode.posts[0])&&!('created_by_user_id' in mode.posts[0])&&!('status' in mode.posts[0]),'no server-assigned field is ever sent')
   // a price history longer than the automatic bound stays reachable and never claims to be complete
   mode.deep=true;mode.deepFail=true;mode.calls=[]
   await page.reload();await page.locator('.workspace-label').waitFor();await open('Services & Pricing')
   await page.getByText('Only part of the price history is loaded').waitFor({timeout:8000})
   check(mode.calls.length===20,'the automatic fetch stopped at its bound ('+mode.calls.length+' requests)')
   check(await page.getByText('Load the full history first').count()>=1,'no price is stated as "in effect" while the history is incomplete')
   await page.getByRole('button',{name:'Load older price versions'}).click()
   await page.getByRole('button',{name:'Retry',exact:true}).waitFor({timeout:5000});check(true,'a failed later page is explicit and retryable')
   mode.deepFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('Only part of the price history is loaded').waitFor({state:'detached',timeout:8000})
   check(await page.getByText('₱1,500.50').count()>=1,'the current price appears once the whole history is loaded')
  }else{
   const names=await page.getByRole('button').allInnerTexts()
   check(!names.some(n=>n.trim()==='Services & Pricing'),role+' has no pricing management entry')
   check(await page.getByRole('columnheader',{name:/Confirmed base price/}).count()===0,role+' sees no price administration')
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
