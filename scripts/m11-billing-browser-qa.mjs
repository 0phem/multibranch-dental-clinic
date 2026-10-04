// M11 billing & payment browser QA. HTTP fixtures only: server arithmetic, state machine, HMO gate, provider verification and
// webhooks are covered by the Laravel tests. No real payment provider is contacted and no record is changed; artifacts go
// outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m11-billing-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m11-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const I1='01j0000000000000000000i001',I2='01j0000000000000000000i002',I3='01j0000000000000000000i003',I4='01j0000000000000000000i004'
const line=(unit,qty=1)=>({id:'l',service:{id:'svc1',code:'OP',name:'Oral Prophylaxis'},quantity:qty,unit_price:unit,line_total:unit})
const inv=(id,n,over={})=>({id,invoice_number:`INV-2026-00000${n}`,status:'Issued',revision:3,treatment_id:'t',visit_id:'v',patient:{id:'p',code:'PAT-0001',name:'Qa Patient'},branch:{id:'b1',name:'Branch A'},lines:[line('1500.00')],gross_amount:'1500.00',hmo_coverage_amount:'0.00',patient_responsibility_amount:'1500.00',paid_amount:'0.00',balance:'1500.00',hmo_status:null,settlement_type:null,issued_at:'2026-09-28T10:00:00+08:00',paid_at:null,payment:null,receipt:null,history:[],...over})
const paid=(id,n)=>inv(id,n,{status:'Paid',paid_amount:'1500.00',balance:'0.00',paid_at:'2026-09-28T11:00:00+08:00',payment:{id:'pay',amount:'1500.00',method:'Cash',external_reference:null,recorded_at:'2026-09-28T11:00:00+08:00'},receipt:{id:'r',number:'RCT-2026-000001',amount:'1500.00',method:'Cash',external_reference:null,issued_at:'2026-09-28T11:00:00+08:00'}})
const fullHmo=inv(I3,3,{status:'Paid',hmo_coverage_amount:'1500.00',patient_responsibility_amount:'0.00',paid_amount:'0.00',balance:'0.00',hmo_status:'Approved',settlement_type:'full_hmo_coverage',paid_at:'2026-09-28T10:00:00+08:00'})
const draft=inv(I4,4,{status:'Draft',revision:1,issued_at:null})
const older=[paid('01j0000000000000000000i005',5),paid('01j0000000000000000000i006',6)]

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'patient,staff,owner,dentist').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const mode={fail:false,flip:false,checkoutFail:true,moreFail:false}
  const requests=[]
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',async route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   requests.push(`${method} ${path}`)
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   const cursor=url.searchParams.get('cursor')
   if(path==='/api/invoices/mine'){
    if(mode.fail)return route.fulfill({status:500,json:{message:'boom'}})
    if(cursor)return mode.moreFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:older,meta:{per_page:25,next_cursor:null}}})
    return route.fulfill({status:200,json:{data:[mode.flip?paid(I1,1):inv(I1,1),paid(I2,2),fullHmo],meta:{per_page:25,next_cursor:'01j0000000000000000000i003'}}})
   }
   if(path===`/api/invoices/${I1}`&&method==='GET')return route.fulfill({status:200,json:{data:mode.flip?paid(I1,1):inv(I1,1)}})
   if(path==='/api/invoices'&&method==='GET'){
    if(mode.fail)return route.fulfill({status:500,json:{message:'boom'}})
    if(cursor)return mode.moreFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:older,meta:{per_page:50,next_cursor:null}}})
    return route.fulfill({status:200,json:{data:[draft,inv(I1,1),fullHmo],meta:{per_page:50,next_cursor:'01j0000000000000000000i003'}}})
   }
   if(path==='/api/billing/treatments')return route.fulfill({status:200,json:{data:[]}})
   if(path===`/api/invoices/${I1}/paymongo-checkout`){mode.checkoutCalls=(mode.checkoutCalls||0)+1;if(mode.checkoutSlow)await new Promise(r=>setTimeout(r,700));return mode.checkoutFail?route.fulfill({status:502,json:{message:'The payment provider could not start this payment. No payment was started.',code:'payment_gateway_error'}}):route.fulfill({status:200,json:{data:{checkout_url:'https://checkout.invalid/x'}}})}
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  const open=async label=>{
   const direct=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
   if(!await direct.count()){
    const menu=page.getByRole('button',{name:'Menu',exact:true}).filter({visible:true})
    if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   }
   await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
  }

  if(role==='patient'){
   // The payment provider's success redirect arrives with ?payment=success&ref=<invoice>. It must not be believed.
   await page.goto(`${base}/?payment=success&ref=${I1}#sign-in`)
   await page.locator('.workspace-label').waitFor()
   await open('Receipts & Payments')
   await page.getByText('INV-2026-000001').first().waitFor()
   await page.getByText('Confirming your payment').waitFor()
   check(await page.getByText('Payment Successful').count()===0&&await page.getByText('Payment received').count()===0,'a success redirect alone shows no payment confirmation')
   check(await page.getByRole('button',{name:/Pay Online/}).count()>=1,'the invoice is still payable while the server says Issued')
   mode.flip=true
   await page.getByText('Payment received').waitFor({timeout:15000});check(true,'the banner follows the server once the invoice is Paid')
   check(await page.getByRole('button',{name:/Pay Online/}).count()===0,'a settled invoice offers no payment')
   // truthful receipt / full-HMO display
   check(await page.getByText(/Receipt available:/).count()>=1,'a real receipt is shown for a real payment')
   const hmoCard=page.locator('[id^="invoice-"]').filter({hasText:'INV-2026-000003'})
   check(await hmoCard.getByText(/Receipt available/).count()===0,'full HMO coverage shows no receipt')
   check(await hmoCard.getByText(/HMO/i).count()>=1,'full HMO coverage is labelled as such')
   // paging: older invoices are reachable, never silently omitted, and a failed next page is recoverable
   mode.flip=false
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor();await open('Receipts & Payments')
   await page.getByText(/Showing 3 invoices\. Older invoices are available\./).waitFor()
   check(await page.getByText('INV-2026-000005').count()===0,'older invoices are not shown before they are loaded')
   mode.moreFail=true
   await page.getByRole('button',{name:'Load older invoices'}).click()
   await page.getByText('Older invoices unavailable').waitFor();check(await page.getByText('INV-2026-000001').count()>=1,'a failed next page keeps the loaded invoices')
   mode.moreFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('INV-2026-000005').first().waitFor();await page.getByText(/Showing 5 invoices\. That is all of your invoices\./).waitFor()
   check(await page.getByRole('button',{name:'Load older invoices'}).count()===0,'no further page is offered after the last one')
   check(await page.getByText('INV-2026-000006').count()>=1,'every older invoice is reachable')
   // checkout refusal is explicit
   mode.flip=false;mode.checkoutFail=true
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor();await open('Receipts & Payments')
   await page.getByRole('button',{name:/Pay Online/}).first().click()
   await page.getByText('The payment provider could not start this payment. No payment was started.').waitFor();check(true,'a refused checkout is explained')
   check(!page.url().includes('checkout'),'the browser was not sent to a payment page')
   // repeated activation while a checkout is being created sends ONE request; a redirect alone never shows Paid
   mode.checkoutFail=false;mode.checkoutSlow=true;mode.checkoutCalls=0
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor();await open('Receipts & Payments')
   const payBtn=page.getByRole('button',{name:/Pay Online/}).first()
   await payBtn.click();await payBtn.click({force:true,timeout:1500}).catch(()=>{});await payBtn.dispatchEvent('click').catch(()=>{})
   await page.waitForTimeout(1200)
   check(mode.checkoutCalls===1,'repeated Pay activation created one checkout request ('+mode.checkoutCalls+')')
   mode.checkoutSlow=false;mode.checkoutFail=true
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor();await open('Receipts & Payments')
   // load failure
   mode.fail=true
   await page.reload();await page.locator('.workspace-label').waitFor();await open('Receipts & Payments')
   await page.getByText('Invoices unavailable').waitFor();check(await page.getByText('INV-2026-000001').count()===0,'a failed load shows no invoices')
   mode.fail=false
   await page.getByRole('button',{name:'Retry',exact:true}).click()
   await page.getByText('INV-2026-000001').first().waitFor();check(true,'retry recovers')
  }else if(role==='staff'){
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
   await open('Billing & Payments')
   await page.getByRole('heading',{name:'Billing & Payments',exact:true}).waitFor()
   await page.getByText('INV-2026-000001').first().waitFor()
   check(await page.getByText(/Historical demo/i).count()===0,'no demo billing records')
   await page.getByText(/Showing 3 invoices\. Older invoices are available\./).waitFor()
   mode.moreFail=true
   await page.getByRole('button',{name:'Load older invoices'}).click()
   await page.getByText('Older invoices unavailable').waitFor();check(true,'a failed next page is explicit for Staff')
   mode.moreFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).first().click()
   await page.getByText(/Showing 5 invoices\. That is all invoices in your scope\./).waitFor();check(await page.getByText('INV-2026-000005').count()>=1,'Staff reach older invoices')
   await page.getByText('INV-2026-000003').first().click()
   check(await page.getByText(/fully covered; no payment collected/).count()>=1,'full HMO settlement is described truthfully')
   await page.getByText('INV-2026-000004').first().click()
   check(await page.getByRole('button',{name:'Review Invoice'}).count()>=1,'Staff can review a Draft')
   mode.fail=true
   await page.reload();await page.locator('.workspace-label').waitFor();await open('Billing & Payments')
   await page.getByText('Billing records unavailable').first().waitFor();check(true,'a failed load is explicit')
   check(await page.getByText('INV-2026-000001').count()===0,'no invoices are shown after a failed load')
   mode.fail=false
   await page.getByRole('button',{name:'Retry',exact:true}).first().click()
   await page.getByText('INV-2026-000001').first().waitFor();check(true,'retry recovers')
  }else{
   // Owner and Dentist have no billing screen; their financial access is API-level only (Owner read-only, Dentist none).
   await page.goto(`${base}/#sign-in`);await page.locator('.workspace-label').waitFor()
   const menu=page.getByRole('button',{name:'Open navigation',exact:true})
   if(await menu.count())await menu.first().click().catch(()=>{})
   check(await page.getByRole('button',{name:/Billing/}).count()===0,`${role} navigation exposes no billing`)
   check(!requests.some(r=>r.includes('/api/invoices')),`${role} session never requests invoices`)
  }
  await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(overflow===0,`${role}/${width} overflow: ${overflow}`)
  results.push({role,width,overflow})
  await context.close()
 }
 const unexpected=errors.filter(e=>!/status of (500|502)/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
