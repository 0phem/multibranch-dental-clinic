// M4 Patient record browser QA. HTTP fixtures only: backend authorization, binding and concurrency are covered by the
// Laravel tests. No operational record is created or changed; artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5186 node scripts/m4-patient-records-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5186'
const output=process.env.QA_OUTPUT||'/tmp/m4-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const SERVER_ID='01j0000000000000000000a001',NEW_ID='01j0000000000000000000a002',IDLE_ID='01j0000000000000000000a003',OWN_ID='01K00000000000000000000011'
const today=new Date(Date.now()+8*3600e3).toISOString().slice(0,10)
const record=(id,over={})=>({id,code:'PAT-0101',name:'Qa Server',first_name:'Qa',last_name:'Server',date_of_birth:'1991-02-03',sex:'Female',phone:'+639171234567',emergency_contact:'Qa Contact',revision:1,
  email:'qa.server@example.test',address:'1 Qa Street',preferred_branch:{id:'b1',name:'Branch A'},has_portal_account:false,profile_access:'full',created_at:'2026-09-01T09:00:00+08:00',updated_at:'2026-09-01T09:00:00+08:00',...over})
const identityView=r=>({id:r.id,code:r.code,name:r.name,first_name:r.first_name,last_name:r.last_name,date_of_birth:r.date_of_birth,phone:r.phone,profile_access:'identity'})
const appointmentRow={id:'01k0000000000000000000ap01',code:'APT-0101',patient:{id:SERVER_ID,code:'PAT-0101',name:'Qa Server'},branch:{id:'b1',name:'Branch A'},service:{id:'svc1',name:'Oral Prophylaxis'},dentist:{id:'d1',name:'Dr. Miguel Reyes'},
  date:today,start_time:'10:00',end_time:'10:30',duration_minutes:30,starts_at:`${today}T10:00:00+08:00`,ends_at:`${today}T10:30:00+08:00`,status:'Confirmed',revision:1,source:'front_desk',assignment_method:'selected',notes:null,history:null}

async function openPatients(page){
 const button=page.getByRole('button',{name:'Patient Records',exact:true}).filter({visible:true})
 if(!await button.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
 await page.getByRole('button',{name:'Patient Records',exact:true}).filter({visible:true}).first().click()
 await page.getByRole('heading',{name:'Centralized Patient Records',exact:true}).waitFor()
}

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'staff,dentist,owner,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const sent=[]
  const mode={getFails:false,conflict:false,revision:1,searchFails:false}
  const gets=[]
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:OWN_ID,code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/patients'&&method==='GET'){
    if(mode.searchFails)return route.fulfill({status:500,json:{message:'boom'}})
    return route.fulfill({status:200,json:{data:[{id:SERVER_ID,code:'PAT-0101',name:'Qa Server',first_name:'Qa',last_name:'Server',phone:'+639171234567',date_of_birth:'1991-02-03'},{id:IDLE_ID,code:'PAT-0103',name:'Idle Identity',first_name:'Idle',last_name:'Identity',phone:'+639170000003',date_of_birth:'1985-01-01'}],meta:{current_page:1,last_page:1,total:2}}})
   }
   if(path==='/api/patients'&&method==='POST'){sent.push({path,method,body:request.postDataJSON()});return route.fulfill({status:201,json:{data:{id:NEW_ID,code:'PAT-0102',name:'New Walkin',first_name:'New',last_name:'Walkin',phone:'+639175550000',date_of_birth:null}}})}
   const m=path.match(/^\/api\/patients\/([^/]+)(\/records)?$/)
   if(m&&m[2])return route.fulfill({status:200,json:{data:{patient:{id:m[1],code:'PAT-0101'},appointments:[{},{}],visits:[{}],treatments:[],invoices:[],hmo_cases:[],limit_per_list:100,unavailable:['clinical_history','prescriptions','follow_ups']}}})
   if(m&&method==='GET'){
    gets.push(m[1])
    if(mode.getFails)return route.fulfill({status:500,json:{message:'boom'}})
    if(role==='dentist'||role==='owner')return route.fulfill({status:403,json:{message:'Forbidden'}})
    if(m[1]===IDLE_ID)return route.fulfill({status:200,json:{data:identityView(record(IDLE_ID,{code:'PAT-0103',name:'Idle Identity',first_name:'Idle',last_name:'Identity',phone:'+639170000003',date_of_birth:'1985-01-01'}))}})
    const full=m[1]===OWN_ID?record(OWN_ID,{code:'PAT-0200',name:'Own Patient',first_name:'Own',last_name:'Patient',email:'patient@example.test',has_portal_account:true,preferred_branch:null,revision:mode.revision}):record(m[1],{revision:mode.revision})
    return route.fulfill({status:200,json:{data:full}})
   }
   if(m&&method==='PATCH'){
    const body=request.postDataJSON();sent.push({path,method,body})
    if(mode.conflict)return route.fulfill({status:409,json:{message:'stale',code:'stale_revision',current_revision:mode.revision+1}})
    mode.revision+=1
    return route.fulfill({status:200,json:{data:record(m[1],{revision:mode.revision,phone:body.phone??'+639171234567',sex:body.sex??'Female'})}})
   }
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff,'/api/appointments':role==='dentist'?[appointmentRow]:[]}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()

  if(role==='patient'){
   const openMenu=async()=>{
    const direct=page.getByRole('button',{name:/^(Me|My Profile)$/}).filter({visible:true})
    if(!await direct.count()){
     const menu=page.getByRole('button',{name:'Menu',exact:true}).filter({visible:true})
     if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()
    }
    await page.getByRole('button',{name:/^(Me|My Profile)$/}).filter({visible:true}).first().click()
   }
   await openMenu()
   await page.getByRole('heading',{name:'Profile',exact:true}).waitFor()
   await page.getByText('patient@example.test').waitFor()
   check(await page.getByText('Own Patient').count()>0,'own profile comes from the server record')
   check(await page.getByText('Branch A').count()===0,'no technical default branch is shown as a preference')
   mode.getFails=true
   await page.reload();await page.locator('.workspace-label').waitFor();await openMenu()
   await page.getByText('We couldn’t load your profile').waitFor();check(true,'profile load failure is explicit')
   check(await page.getByText('Own Patient').count()===0,'no fallback profile is shown')
   mode.getFails=false
   await page.getByRole('button',{name:'Retry'}).click()
   await page.getByText('patient@example.test').waitFor();check(true,'profile retry recovers')
  }else if(role==='owner'){
   // The Owner shell has no Patient Records page (oversight role); the API-level Owner read is covered by the backend tests.
   const nav=page.getByRole('button',{name:'Patient Records',exact:true})
   if(!await page.getByRole('button',{name:'Branches',exact:true}).filter({visible:true}).count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   check(await nav.count()===0,'Owner navigation does not expose Patient Records')
  }else{
   await openPatients(page)
   const searchBox=page.getByRole('textbox',{name:'Search patients',exact:true})
   if(role==='staff'){await searchBox.fill('Qa Server')}
   await page.locator('.patient-list-scroll button').filter({hasText:'Qa Server'}).first().waitFor()
   check(await page.locator('.patient-list-scroll button').filter({hasText:/Maria Santos|Bianca Ramos|Daniel Reyes/}).count()===0,`${role} list holds no demo Patients`)
   await page.locator('.patient-list-scroll button').filter({hasText:'Qa Server'}).first().click()
   if(role==='dentist'){
    await page.getByText('Full patient record not available to Dentists yet').waitFor()
    check(gets.length===0,'a Dentist session never requests the generic Patient record')
    check(await page.getByRole('button',{name:'Save changes',exact:true}).count()===0&&await page.getByRole('textbox',{name:'Email',exact:true}).count()===0,'Dentist has no edit or contact fields')
   }else{
   await page.getByRole('textbox',{name:'First name',exact:true}).waitFor()
   check(await page.getByRole('textbox',{name:'First name',exact:true}).inputValue()==='Qa','summary shows the server record')
   check(await page.getByText('not stored on the clinic server yet').count()===1,'clinical history is disclosed as not on the server')
   check(await page.getByText(/2 appointments • 1 visits/).count()===1,'linked record index is shown')
   }
   if(role==='staff'){
    check(await page.getByRole('textbox',{name:'First name',exact:true}).isEnabled(),'Staff may edit non-clinical fields')
    check(await page.getByRole('textbox',{name:'Email',exact:true}).isEnabled(),'a walk-in record without an account may change email')
    await page.getByRole('textbox',{name:/^Mobile number/}).fill('9175551234')
    await page.getByRole('button',{name:'Save changes',exact:true}).click()
    await page.getByText('Patient record updated.').waitFor()
    const patch=sent.find(s=>s.method==='PATCH')
    check(patch.body.phone==='+639175551234'&&patch.body.expected_revision===1&&Object.keys(patch.body).length===2,'only the changed field and revision are sent')
    mode.conflict=true
    await page.getByRole('textbox',{name:'Sex',exact:true}).fill('Other')
    await page.getByRole('button',{name:'Save changes',exact:true}).click()
    await page.getByText('Record changed').waitFor();check(true,'stale save is reported')
    mode.conflict=false;mode.getFails=true
    await page.getByRole('button',{name:'Reload record'}).click()
    await page.getByText('Patient record unavailable').waitFor();check(true,'reload failure is explicit')
    mode.getFails=false
    await page.getByRole('button',{name:'Retry',exact:true}).click()
    await page.getByRole('textbox',{name:'First name',exact:true}).waitFor();check(true,'retry recovers')
    // The browser demo collection is never listed in a server session.
    await searchBox.fill('')
    check(await page.locator('.patient-list-scroll button').filter({hasText:/Maria Santos|Bianca Ramos|PAT-0001|PAT-0003/}).count()===0,'no demo Patients in the authoritative list')
    check(await page.getByText('Earlier browser record').count()===0,'no earlier browser rows')
    // Identity tier: a Patient with no appointment/visit in the Staff branches shows identity only and cannot be edited.
    await searchBox.fill('Idle')
    await page.locator('.patient-list-scroll button').filter({hasText:'Idle Identity'}).first().click()
    await page.getByText(/Identity only/).waitFor()
    check(await page.getByRole('textbox',{name:'First name',exact:true}).isDisabled(),'identity tier is read-only')
    check(await page.getByRole('textbox',{name:'Email',exact:true}).count()===0&&await page.getByRole('button',{name:'Save changes',exact:true}).count()===0,'identity tier hides profile fields and Save')
    // A failed directory search is explicit and reveals no demo Patients.
    mode.searchFails=true
    await searchBox.fill('Zed')
    await page.getByText('Patient search unavailable').waitFor();check(true,'directory failure is explicit')
    check(await page.locator('.patient-list-scroll button').filter({hasText:/Maria Santos|Bianca Ramos/}).count()===0,'failed search shows no demo Patients')
    mode.searchFails=false
    await page.getByRole('button',{name:'Retry',exact:true}).first().click()
    await searchBox.fill('')
    // Registration goes to the server form.
    await page.getByRole('button',{name:'New Patient',exact:true}).click()
    await page.getByRole('heading',{name:'Register patient'}).waitFor()
    check(await page.getByText('Create Central Patient Record').count()===0,'the local create form is not offered')
    await page.getByRole('textbox',{name:'First name',exact:true}).last().fill('New')
    await page.getByRole('textbox',{name:'Last name',exact:true}).last().fill('Walkin')
    await page.getByRole('button',{name:'Register patient',exact:true}).click()
    await page.getByText(/registered \(PAT-0102\)/).waitFor();check(true,'registration uses the server')
    const post=sent.find(s=>s.method==='POST')
    check(post.body.first_name==='New'&&!('patient_code' in post.body),'registration sends no client identity')
   }
  }
  await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(overflow===0,`${role}/${width} overflow: ${overflow}`)
  results.push({role,width,overflow,patches:sent.length})
  await context.close()
 }
 check(errors.filter(e=>!/status of (500|409)/.test(e)).length===0,JSON.stringify(errors))
 const report={checks,results,errors,mode:'HTTP fixtures'}
 await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
