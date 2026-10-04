// M14 documents & consent browser QA. HTTP fixtures only: backend authorization, content validation, storage and audit are
// covered by the Laravel tests. No operational record is created or changed; artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to an installed playwright> QA_BASE_URL=http://127.0.0.1:5187 node scripts/m14-documents-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5187'
const output=process.env.QA_OUTPUT||'/tmp/m14-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status,capacity_threshold:b.threshold,latitude:null,longitude:null,data_provenance:'unconfirmed'}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,reference_fee_php:s.baseFee,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const SERVER_ID='01j0000000000000000000a001',OWN_ID='01K00000000000000000000011',DOC_PDF='01j0000000000000000000d001',DOC_PNG='01j0000000000000000000d002'
const today=new Date(Date.now()+8*3600e3).toISOString().slice(0,10)
const record={id:SERVER_ID,code:'PAT-0101',name:'Qa Server',first_name:'Qa',last_name:'Server',date_of_birth:'1991-02-03',sex:'Female',phone:'+639171234567',emergency_contact:'',revision:1,email:'qa@example.test',address:'',preferred_branch:null,has_portal_account:false,profile_access:'full',created_at:'2026-09-01T09:00:00+08:00',updated_at:'2026-09-01T09:00:00+08:00'}
const docRow=(id,over={})=>({id,category:'hmo_card',title:'Card',original_filename:'card.pdf',mime_type:'application/pdf',file_size_bytes:2048,checksum_sha256:'a'.repeat(64),status:'Active',metadata:null,patient:{id:SERVER_ID,code:'PAT-0101',name:'Qa Server'},visit_id:null,hmo_case_id:null,branch:{id:'b1',name:'Branch A'},uploaded_by:{role:'staff'},retracted_at:null,retraction_reason:null,text_extraction:'draft_available',security_scan:'not_performed',created_at:'2026-09-28T10:00:00+08:00',extractions:[{id:'e1',method:'native_text',status:'Draft',is_draft:true,confidence_score:null,extracted_at:'2026-09-28T10:00:00+08:00'}],...over})
const docs=[docRow(DOC_PDF,{title:'Insurance card',uploaded_by:{role:'patient'}}),docRow(DOC_PNG,{title:'Scan photo',original_filename:'scan.png',mime_type:'image/png',text_extraction:'unavailable_ocr_not_configured',extractions:[]})]
const detail={...docs[0],extractions:[{...docs[0].extractions[0],raw_text:'Maxicare member MAX-12345678 valid 2026-05-01',structured_payload:{provider_candidate:'Maxicare',member_number_candidate:'MAX-12345678',detected_dates:['2026-05-01'],is_draft_only:true,provenance:{source:'document_text'}}}]}
const appointmentRow={id:'01k0000000000000000000ap01',code:'APT-0101',patient:{id:SERVER_ID,code:'PAT-0101',name:'Qa Server'},branch:{id:'b1',name:'Branch A'},service:{id:'svc1',name:'Oral Prophylaxis'},dentist:{id:'d1',name:'Dr. Miguel Reyes'},date:today,start_time:'10:00',end_time:'10:30',duration_minutes:30,starts_at:`${today}T10:00:00+08:00`,ends_at:`${today}T10:30:00+08:00`,status:'Confirmed',revision:1,source:'front_desk',assignment_method:'selected',notes:null,history:null}

async function openDocuments(page,role){
 const button=page.getByRole('button',{name:'Patient Records',exact:true}).filter({visible:true})
 if(!await button.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
 await page.getByRole('button',{name:'Patient Records',exact:true}).filter({visible:true}).first().click()
 await page.getByRole('heading',{name:'Centralized Patient Records',exact:true}).waitFor()
 if(role==='staff')await page.getByRole('textbox',{name:'Search patients',exact:true}).fill('Qa Server')
 await page.locator('.patient-list-scroll button').filter({hasText:'Qa Server'}).first().click()
}
const documentsTab=page=>page.getByRole('button',{name:/^Documents/}).click()

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'staff,dentist,owner,patient').split(',')){
  const context=await browser.newContext({viewport:{width,height:900}})
  const sent=[]
  const mode={docsFail:false,consentsFail:false,uploadFail:true,downloadStatus:404,uploaded:false}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',route=>{
   const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method()
   const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
   const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:role==='staff'?[{id:'b1'}]:[],patient:role==='patient'?{id:OWN_ID,code:'PAT-0200'}:null,first_name:'Own',last_name:'Patient',phone:'+639170000000',date_of_birth:'1990-01-01'}
   sent.push(`${method} ${path}`)
   if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
   if(path==='/api/patients'&&method==='GET')return route.fulfill({status:200,json:{data:[{id:SERVER_ID,code:'PAT-0101',name:'Qa Server',first_name:'Qa',last_name:'Server',phone:'+639171234567',date_of_birth:'1991-02-03'}],meta:{current_page:1,last_page:1,total:1}}})
   if(path===`/api/patients/${SERVER_ID}`)return route.fulfill({status:200,json:{data:record}})
   if(path===`/api/patients/${SERVER_ID}/records`)return route.fulfill({status:200,json:{data:{patient:{id:SERVER_ID},appointments:[],visits:[],treatments:[],invoices:[],hmo_cases:[],limit_per_list:100,unavailable:[]}}})
   if(path===`/api/patients/${OWN_ID}`)return route.fulfill({status:200,json:{data:{...record,id:OWN_ID,name:'Own Patient',email:'patient@example.test',has_portal_account:true}}})
   if(path==='/api/documents/mine')return mode.docsFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:docs}})
   if(path==='/api/consents/mine')return mode.consentsFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:[]}})
   if(path==='/api/documents'&&method==='GET')return mode.docsFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:mode.uploaded?[...docs,docRow('01j0000000000000000000d003',{title:'New upload'})]:docs}})
   if(path==='/api/documents'&&method==='POST'){
    sent.push(`UPLOAD key=${request.headers()['idempotency-key']||''} body=${(request.postData()||'').slice(0,4000).includes('name="branch_id"')?'has-branch':'no-branch'}`)
    if(mode.uploadFail){mode.uploadFail=false;return route.fulfill({status:422,json:{message:'This file’s content (\'text/html\') is not a permitted type.',code:'disallowed_mime_type'}})}
    mode.uploaded=true
    return route.fulfill({status:201,json:{data:docRow('01j0000000000000000000d003',{title:'New upload'})}})
   }
   if(path===`/api/documents/${DOC_PDF}`)return route.fulfill({status:200,json:{data:detail}})
   if(path.endsWith('/download'))return route.fulfill({status:mode.downloadStatus,json:{message:'x'}})
   if(path===`/api/patients/${SERVER_ID}/consents`)return mode.consentsFail?route.fulfill({status:500,json:{message:'boom'}}):route.fulfill({status:200,json:{data:[]}})
   const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff,'/api/appointments':role==='dentist'?[appointmentRow]:[]}
   return route.fulfill({status:200,json:{data:values[path]??[]}})
  })
  const page=await context.newPage()
  page.on('pageerror',e=>errors.push(`${role}/${width}: ${e.message}`))
  page.on('console',m=>{if(m.type()==='error')errors.push(`${role}/${width}: ${m.text()}`)})
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.goto(`${base}/#sign-in`)
  await page.locator('.workspace-label').waitFor()

  if(role==='staff'){
   await openDocuments(page,role)
   // documents list failure and consent failure are explicit, never an empty list
   mode.docsFail=true;mode.consentsFail=true
   await documentsTab(page)
   await page.getByText('Documents unavailable').waitFor();await page.getByText('Consent records unavailable').waitFor()
   check(await page.getByText('No documents are on file').count()===0&&await page.getByText('No consent records found').count()===0,'failed loads are not shown as empty')
   mode.docsFail=false;mode.consentsFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).first().click()
   await page.getByText('Insurance card').first().waitFor();check(true,'retry recovers')
   check(await page.getByText(/Encrypted/i).count()===0,'no encryption claim')
   check(await page.getByText(/not scanned for malware/).count()>=1,'malware limitation is disclosed')
   check(await page.getByText('Text extraction is not available for images (OCR is not set up).').count()===1,'image extraction is reported unavailable, not fabricated')
   check(await page.getByRole('button',{name:'Retract'}).count()===2,'Staff may retract documents in their scope')
   await page.getByRole('button',{name:'View extracted text (draft)'}).click()
   await page.getByText(/Draft — not verified/).waitFor();await page.getByText('MAX-12345678').first().waitFor()
   check(await page.getByText('[object Object]').count()===0,'no raw object text')
   // upload: server refusal is explained, then success reloads the list
   await page.getByRole('button',{name:'Upload Document',exact:true}).first().click()
   const options=await page.locator('select').evaluateAll(els=>els.flatMap(e=>[...e.options].map(o=>o.value)))
   check(['consent_document','valid_id','clinical_attachment','hmo_card','treatment_request','referral','other'].every(v=>options.includes(v)),'categories match the server')
   check(!options.includes('prescription_source')&&!options.includes('invoice_proof'),'no unsupported categories')
   await page.locator('input[type=file]').setInputFiles({name:'x.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')})
   await page.getByRole('button',{name:'Upload Document',exact:true}).last().click()
   await page.getByText(/not a permitted type/).waitFor();check(true,'upload refusal is explained')
   await page.getByRole('button',{name:'Upload Document',exact:true}).last().click()
   await page.getByText('New upload').waitFor();check(true,'successful upload reloads from the server')
   check(sent.filter(s=>s.startsWith('UPLOAD')).every(s=>/key=\S+/.test(s)&&s.endsWith('has-branch')),'uploads carry an Idempotency-Key and an authorized branch')
   // download failure is explained
   await page.getByRole('button',{name:'Download'}).first().click()
   await page.getByText(/could not be found/).waitFor();check(true,'download failure is explained')
  }else if(role==='dentist'){
   await openDocuments(page,role)
   await documentsTab(page)
   await page.getByText('Documents for your visits').waitFor()
   check(await page.getByRole('button',{name:'Upload Document',exact:true}).count()===0&&await page.getByRole('button',{name:'Record Consent',exact:true}).count()===0,'Dentist has no upload or consent actions')
   check(await page.getByRole('button',{name:'Retract'}).count()===0,'Dentist cannot retract')
   check(!sent.some(s=>s.includes('/consents')),'a Dentist session never requests consent records')
   await page.getByText('Insurance card').first().waitFor();check(true,'visit documents render')
  }else if(role==='owner'){
   const nav=page.getByRole('button',{name:'Patient Records',exact:true})
   if(!await page.getByRole('button',{name:'Branches',exact:true}).filter({visible:true}).count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
   check(await nav.count()===0,'Owner navigation exposes no documents page')
  }else{
   const openMe=async()=>{
    const direct=page.getByRole('button',{name:/^(Me|My Profile)$/}).filter({visible:true})
    if(!await direct.count()){const menu=page.getByRole('button',{name:'Menu',exact:true}).filter({visible:true});if(await menu.count())await menu.first().click();else await page.getByRole('button',{name:'Open navigation',exact:true}).click()}
    await page.getByRole('button',{name:/^(Me|My Profile)$/}).filter({visible:true}).first().click()
   }
   await openMe()
   await page.getByText('Insurance card').first().waitFor()
   check(await page.getByRole('button',{name:'Retract'}).count()===1,'a Patient may retract only a document they uploaded')
   check(await page.getByText(/Encrypted/i).count()===0,'no encryption claim')
   mode.docsFail=true;mode.consentsFail=true
   await page.reload();await page.locator('.workspace-label').waitFor();await openMe()
   await page.getByText('Documents unavailable').waitFor();await page.getByText('Consent records unavailable').waitFor()
   check(await page.getByText('You haven\'t uploaded any documents yet').count()===0,'a failed load is not an empty library')
   mode.docsFail=false;mode.consentsFail=false
   await page.getByRole('button',{name:'Retry',exact:true}).first().click()
   await page.getByText('Insurance card').first().waitFor();check(true,'retry recovers')
  }
  await page.screenshot({path:`${output}/${role}-${width}.png`,fullPage:true})
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
  check(overflow===0,`${role}/${width} overflow: ${overflow}`)
  results.push({role,width,overflow})
  await context.close()
 }
 const unexpected=errors.filter(e=>!/status of (500|404|422)/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
