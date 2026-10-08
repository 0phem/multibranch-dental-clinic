// M21 analytics corrections browser QA. HTTP fixtures only: branch resolution, validation, exact money and the queue day are
// covered by the Laravel tests. No operational record is created or changed; artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m21-analytics-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m21-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const summaryFor=ref=>{const b=branches.find(x=>x.id===ref||x.public_id===ref);return{period:'today',period_label:'Today (Sep 28, 2026)',branch:b?{public_id:b.public_id,name:b.name}:null,
 financials:{total_collected_php:'1500.00',total_gross_php:'2500.00',total_hmo_covered_php:'1000.00',outstanding_balance_php:'0.00',invoices_count:2,paid_invoices_count:1,average_ticket_php:'1500.00'},
 scheduling:{total_appointments:0,confirmed:0,completed:0,cancelled:0,no_show:0,in_treatment:0,completion_rate_pct:null},
 patient_flow:{total_visits:3,served_from_queue:1,current_waiting:2},hmo:{total_cases:1,approved:1,pending:0,withdrawn:0,rejected:0,approved_amount_php:'1000.00'},
 automation:{total_actions:0,success:0,warning:0,failed:0,health_rate_pct:null}}}
const rows=ref=>branches.filter(b=>!ref||b.id===ref||b.public_id===ref).map(b=>({public_id:b.public_id,name:b.name,code:b.branch_code,city:b.city,revenue_collected_php:'1500.00',total_appointments:4,completed_appointments:2,active_queue:b.id==='b2'?0:2,capacity_threshold:80,estimated_wait_minutes:null,is_open:true}))

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
   if(path.startsWith('/api/analytics/')){
    requests.push(`${path} ${url.search}`)
    if(mode.fail)return route.fulfill({status:500,json:{message:'boom'}})
    const ref=url.searchParams.get('branch_id')
    if(path.endsWith('/executive-summary'))return route.fulfill({status:200,json:{data:summaryFor(ref)}})
    if(path.endsWith('/branch-performance'))return route.fulfill({status:200,json:{data:rows(ref)}})
    if(path.endsWith('/export'))return route.fulfill({status:200,headers:{'content-type':'text/csv','Access-Control-Allow-Origin':request.headers()['origin']||base,'Access-Control-Allow-Credentials':'true'},body:'ok\n'})
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
   const label='Analytics & Reports'
   const visible=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
   if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
   await page.getByRole('heading',{name:'Operational Reporting & Analytics',exact:true}).waitFor()
   await page.getByText('Recorded revenue').first().waitFor()
   check(requests.some(r=>r.includes('executive-summary')&&!r.includes('branch_id')),'All Branches sends no branch filter')
   check(await page.getByText('Completion rate: No data').count()===1,'a null completion rate reads "No data"')
   check(await page.locator('.analytics-value',{hasText:'No data'}).count()>=1,'automation health shows "No data"')
   check(await page.getByText(/100%/).count()===0,'no fabricated 100% appears')
   check(await page.getByText('Paid invoices created in this period: 1').count()===1,'the revenue note describes the calculation')
   check(await page.getByText(/wait estimate not configured/).count()>=1,'an unavailable wait estimate is stated, not invented')
   check(await page.getByText(/~\d+ min wait/).count()===0,'no wait-minute figure is shown')
   // capacity is not approved: no workload percentage or bar in a clinic-server session; real queue counts stay visible
   check(await page.locator('.branch-bars > div').count()===3,'all three branches are listed')
   check(await page.getByText('Capacity not configured').count()===3,'each branch says capacity is not configured')
   check(await page.locator('.branch-bars .progress-track').count()===0,'no workload bar is drawn')
   check(await page.locator('.branch-bars').innerText().then(t=>!/\d+\s*%/.test(t)),'no percentage appears in the branch report')
   check(await page.locator('.branch-bars').getByText('2 waiting now').count()===2&&await page.locator('.branch-bars').getByText('0 waiting now').count()===1,'known and zero queue counts stay visible and distinct')
   check(await page.getByText('Offline demo preview').count()===0,'the offline demo label is absent in a server session')
   // choose a branch: the page sends the public ULID, never a number
   await page.locator('select').filter({has:page.locator('option',{hasText:'All Branches'})}).first().selectOption({label:branches[0].name})
   await page.waitForFunction(()=>true)
   await page.getByText(`Branch workload report`).first().waitFor()
   await page.waitForTimeout(300)
   const branchRequests=requests.filter(r=>r.includes('branch_id='))
   check(branchRequests.length>=2,'summary and branch report both carry the selected branch')
   check(branchRequests.every(r=>r.includes(`branch_id=${branches[0].public_id}`)),'the selected branch is sent as its public ULID')
   check(!requests.some(r=>/branch_id=\d+(&|$)/.test(r)),'no numeric branch id is sent')
   check(await page.locator('.branch-bars > div').count()===1&&await page.getByText('Capacity not configured').count()===1,'the branch report shows only the selected branch, still without a percentage')
   // export carries the same reference
   await page.getByRole('button',{name:/Export Report CSV/}).click()
   await page.waitForTimeout(400)
   check(requests.some(r=>r.startsWith('/api/analytics/export')&&r.includes(`branch_id=${branches[0].public_id}`)),'the export uses the same branch reference')
   // failure: explicit, no local demo metrics, recoverable
   mode.fail=true
   await page.locator('select.compact-select').selectOption('This Week')
   await page.getByText('Analytics are unavailable right now').waitFor();check(true,'failure is an explicit unavailable state')
   check(await page.getByText('Recorded revenue').count()===0,'no figures remain after a failed request')
   check(await page.getByText('Branch figures are unavailable.').count()===1,'branch figures are reported unavailable')
   mode.fail=false
   await page.getByRole('button',{name:'Try again'}).click()
   await page.getByText('Recorded revenue').first().waitFor();check(true,'retry recovers')
  }else{
   const menu=page.getByRole('button',{name:'Open navigation',exact:true})
   if(await menu.count())await menu.first().click().catch(()=>{})
   check(await page.getByRole('button',{name:'Analytics & Reports',exact:true}).count()===0,`${role} navigation exposes no analytics`)
   check(!requests.some(r=>r.startsWith('/api/analytics')),`${role} never requests analytics`)
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
