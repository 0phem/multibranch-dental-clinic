// M6 read-only Staff Day Calendar browser QA. HTTP FIXTURES ONLY (no live backend, no record is created or changed): the
// server's branch scoping and pagination are covered by the Laravel tests; this checks what the React page renders for fixture
// responses. Artifacts go outside the repository.
// Usage: PLAYWRIGHT_MODULE=<path to playwright/index.mjs> QA_BASE_URL=http://127.0.0.1:5189 node scripts/m6-day-calendar-browser-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
import * as data from '../src/data.js'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const browser=await chromium.launch({channel:'chrome'})
const base=process.env.QA_BASE_URL||'http://127.0.0.1:5189'
const output=process.env.QA_OUTPUT||'/tmp/m6-browser'
await mkdir(output,{recursive:true})
let checks=0
const results=[],errors=[]
const check=(value,message)=>{assert.ok(value,message);checks++}
const addDays=(d,n)=>{const v=new Date(`${d}T00:00:00Z`);v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)}
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())

const branches=data.INITIAL_BRANCHES.map((b,i)=>({id:b.id,public_id:`01K0000000000000000000000${i+1}`,branch_code:b.branchCode,name:b.name,city:b.city,address:b.address,phone:b.phone,open_time:b.open,close_time:b.close,status:b.status}))
const services=data.INITIAL_SERVICES.map(s=>({id:s.id,code:s.code,name:s.name,duration_minutes:s.duration,category:s.category,status:s.status}))
const dentists=data.INITIAL_DENTISTS.map(d=>({...d,id:d.id,branch_ids:d.branches.map(name=>branches.find(b=>b.name===name).id),service_ids:services.map(s=>s.id),shiftStart:d.shiftStart,shiftEnd:d.shiftEnd}))
const staff=data.INITIAL_STAFF.map(s=>({...s,title:s.staffType,branchId:branches.find(b=>b.name===s.branch)?.id||null}))
const branchServices=data.INITIAL_BRANCH_SERVICES.map(b=>({branch_ref:b.branchId,service_ref:b.serviceId,active:b.active}))

const appt=(n,date,start,end,status,dentist,branch=branches[0],extra={})=>({id:`01K0000000000000000A${String(n).padStart(6,'0')}`,code:`APT-2026-${String(n).padStart(6,'0')}`,status,source:'online',revision:1,date,start_time:start,end_time:end,duration_minutes:30,
 patient:{id:`01K0000000000000000P${String(n).padStart(6,'0')}`,code:`PAT-${2000+n}`,name:`Calendar Patient ${n}`},branch:{id:branch.id,name:branch.name},service:{id:services[0].id,name:'Dental Consultation'},
 dentist:dentist?{id:dentist.id,name:dentist.name||'Dr. QA'}:null,notes:'PRIVATE-NOTE-DO-NOT-SHOW',history:[],...extra})
const dA={id:'d1',name:'Dr. Alpha'},dB={id:'d2',name:'Dr. Beta'}
const dow=d=>(new Date(`${d}T00:00:00Z`).getUTCDay()+6)%7
const weekOf=d=>{const f=addDays(d,-dow(d));return [f,addDays(f,6)]}
const monthOf=d=>{const [y,m]=d.split('-').map(Number);const dim=new Date(Date.UTC(y,m,0)).getUTCDate();const mm=String(m).padStart(2,'0');return [`${y}-${mm}-01`,`${y}-${mm}-${String(dim).padStart(2,'0')}`]}
const [monthFirst,monthLast]=monthOf(today)
// Known rows: a busy "today" plus a few around it, so Week and Month have date-dependent content (counts are recomputed from this list).
const todayRows=[
 appt(1,today,'11:00','11:30','Confirmed',dB),appt(2,today,'09:00','09:30','Completed',dB),appt(3,today,'10:00','10:30','In Treatment',dA),
 appt(4,today,'08:30','09:00','Checked In',dA),appt(5,today,'14:00','14:30','Cancelled',dA),appt(6,today,'13:00','13:30','No-show',dB,branches[1]),
 appt(7,today,'15:00','15:30','Pending',null)]
const allRows=[...todayRows,
 appt(20,addDays(today,-1),'09:00','09:30','Completed',dA),appt(21,addDays(today,-1),'10:00','10:30','No-show',dB),appt(22,addDays(today,2),'09:00','09:30','Confirmed',dA),
 appt(23,monthFirst,'08:00','08:30','Completed',dA),appt(24,monthLast,'16:00','16:30','Pending',dB),
 appt(25,addDays(monthFirst,-1),'09:00','09:30','Completed',dA),appt(26,addDays(monthLast,1),'09:00','09:30','Confirmed',dA),appt(8,'2025-01-02','09:00','09:30','Completed',dA)]
const inRange=(from,to)=>allRows.filter(r=>r.date>=from&&r.date<=to)
const dayRows=date=>inRange(date,date)
const countOn=d=>allRows.filter(r=>r.date===d).length
const spanDays=(from,to)=>Math.round((new Date(`${to}T00:00:00Z`)-new Date(`${from}T00:00:00Z`))/86400000)+1

async function openCalendar(page,width){
 const visible=page.getByRole('button',{name:'Appointment Calendar',exact:true}).filter({visible:true})
 if(!await visible.count())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
 await page.getByRole('button',{name:'Appointment Calendar',exact:true}).filter({visible:true}).first().click()
 await page.getByRole('heading',{name:'Appointment Calendar',exact:true}).waitFor()
}

try{
 for(const width of (process.env.QA_WIDTHS||'375,430,768,1024,1440').split(',').map(Number))for(const role of (process.env.QA_ROLES||'staff,owner,dentist,patient').split(',')){
  const variants=role==='staff'&&width===1024?['normal','fail','incomplete','race','stale','single']:['normal']
  for(const variant of variants){
   const tag=`${role}/${width}/${variant}`
   const context=await browser.newContext({viewport:{width,height:900}})
   const dayRequests=[],rangeRequests=[]
   const mode={failFirst:variant==='fail',failRefresh:false}
   let failed=false,firstDelayed=false
   await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
   await context.route('**/api/**',async route=>{
    const request=route.request(),url=new URL(request.url()),path=url.pathname
    const email=role==='staff'?'staff.reception@example.test':`${role}@example.test`
    const scopes=role==='staff'?(variant==='single'?[{id:'b1'}]:[{id:'b1'},{id:'b2'}]):[]
    const me={id:'01K00000000000000000000010',role,email,name:'QA account',account_status:'Active',branch_scopes:scopes,patient:role==='patient'?{id:'01K00000000000000000000011',code:'PAT-0200'}:null,dentist:role==='dentist'?{id:dentists[0].id}:null}
    if(path==='/api/me')return route.fulfill({status:200,json:{data:me}})
    if(path==='/api/appointments'&&url.searchParams.has('from')&&url.searchParams.has('to')){
     const from=url.searchParams.get('from'),to=url.searchParams.get('to'),pg=Number(url.searchParams.get('page')||1)
     if(spanDays(from,to)>62)return route.fulfill({status:200,json:{data:[],meta:{current_page:1,last_page:1,per_page:100,total:0}}}) // the shared ±90-day window, not the calendar
     rangeRequests.push(`${from}..${to}#${pg}`)
     if(variant==='incomplete')return route.fulfill({status:200,json:{data:[appt(300+pg,from,'09:00','09:30','Confirmed',dA)],meta:{current_page:pg,last_page:90,per_page:100,total:9000}}})
     const rows=inRange(from,to)
     return route.fulfill({status:200,json:{data:rows,meta:{current_page:1,last_page:1,per_page:100,total:rows.length}}})
    }
    if(path==='/api/appointments'&&url.searchParams.has('date')){
     const date=url.searchParams.get('date'),page=Number(url.searchParams.get('page')||1)
     dayRequests.push(`${date}#${page}`)
     if(mode.failFirst&&!failed){failed=true;return route.fulfill({status:500,json:{message:'boom'}})}
     if(mode.failRefresh)return route.fulfill({status:500,json:{message:'refresh down'}})
     if(variant==='incomplete')return route.fulfill({status:200,json:{data:[appt(100+page,date,'09:00','09:30','Confirmed',dA)],meta:{current_page:page,last_page:30,per_page:100,total:3000}}})
     if(variant==='race'&&date===addDays(today,1)&&!firstDelayed){firstDelayed=true;await new Promise(r=>setTimeout(r,2500))}
     const rows=variant==='race'&&date===addDays(today,1)?[appt(50,date,'09:00','09:30','Confirmed',dA,branches[0],{patient:{id:'01K0000000000000000PSLOW0',code:'PAT-SLOW',name:'Slow Old Response'}})]:dayRows(date)
     return route.fulfill({status:200,json:{data:rows,meta:{current_page:1,last_page:1,per_page:100,total:rows.length}}})
    }
    if(path==='/api/queue/mine')return route.fulfill({status:200,json:{data:null}})
    const values={'/api/branches':branches,'/api/services':services,'/api/branch-services':branchServices,'/api/dentists':dentists,'/api/staff':staff}
    return route.fulfill({status:200,json:{data:values[path]??[]}})
   })
   const page=await context.newPage()
   page.on('pageerror',e=>errors.push(`${tag}: ${e.message}`))
   page.on('console',m=>{if(m.type()==='error')errors.push(`${tag}: ${m.text()}`)})
   await page.emulateMedia({reducedMotion:'reduce'})
   if(variant==='stale')await page.clock.install({time:new Date()})
   await page.goto(`${base}/#sign-in`)
   await page.locator('.workspace-label').waitFor()

   if(role!=='staff'){
    await page.waitForTimeout(600)
    const menu=page.getByRole('button',{name:'Open navigation',exact:true})
    if(await menu.count()&&await menu.first().isVisible())await menu.first().click().catch(()=>{})
    check(await page.getByRole('button',{name:'Appointment Calendar',exact:true}).count()===0,`${tag}: no Day Calendar navigation`)
    check(!dayRequests.length,`${tag}: no single-date appointment request`)
    check(!(await page.locator('body').innerText()).includes('Previous day'),`${tag}: no calendar controls`)
   }else{
    await openCalendar(page,width)
    const body=async()=>page.locator('main').innerText()
    if(variant==='fail'){
     await page.getByText('Appointments couldn’t be loaded').waitFor()
     check(!/No appointments on this date/.test(await body()),`${tag}: an error is not an empty day`)
     await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-notice.png`,fullPage:false})
     await page.getByRole('button',{name:'Try again'}).click()
     await page.getByText('Calendar Patient 3').waitFor();check(true,`${tag}: retry recovers`)
    }else if(variant==='incomplete'){
     await page.getByText('Only part of this day was loaded').waitFor()
     const t=await body()
     check(!/No appointments on this date/.test(t)&&!/\d+ appointments?\b/.test(t),`${tag}: incomplete shows no empty message and no total`)
     check(dayRequests.length===10&&dayRequests.every(r=>r.startsWith(today)),`${tag}: reading stops at the 10-page limit (${dayRequests.length} requests)`)
     for(const [view,label] of [['Week','week'],['Month','month']]){
      rangeRequests.length=0
      await page.getByRole('button',{name:view,exact:true}).click()
      await page.getByText(`Only part of this ${label} was loaded`).waitFor()
      const m=await page.locator('main').innerText()
      check(!/\d+ appointments?\b/.test(m)&&!/No appointments/.test(m),`${tag}: incomplete ${label} shows no totals and no empty claim`)
      check(/Not verified|not confirmed empty/.test(m),`${tag}: incomplete ${label} says dates are not verified`)
      check(rangeRequests.length===30,`${tag}: ${label} reading stops at the documented 30-page limit (${rangeRequests.length} requests)`)
      await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-${label}.png`,fullPage:true})
     }
    }else if(variant==='race'){
     await page.getByText('Calendar Patient 3').waitFor()
     await page.getByRole('button',{name:'Next day'}).click()   // slow response (2.5 s) …
     await page.getByRole('button',{name:'Next day'}).click()   // … then straight on to the day after
     await page.getByText('Calendar Patient 22').waitFor()
     await page.waitForTimeout(3200)
     const t=await body()
     check(!/Slow Old Response/.test(t)&&/Calendar Patient 22/.test(t),`${tag}: the late older response did not replace the newer day`)
     check(await page.locator('input[type=date]').inputValue()===addDays(today,2),`${tag}: date is ${addDays(today,2)}`)
    }else if(variant==='stale'){
     await page.getByText('Calendar Patient 3').waitFor()
     mode.failRefresh=true
     await page.clock.runFor(61000)
     await page.getByText('Showing the last loaded list').waitFor()
     check(await page.getByText('Calendar Patient 3').count()===1,`${tag}: the last complete list stays visible but marked stale`)
     await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-notice.png`,fullPage:false})
     mode.failRefresh=false
     await page.getByRole('button',{name:'Try again'}).click()
     await page.getByText('Showing the last loaded list').waitFor({state:'detached'});check(true,`${tag}: retry clears the stale notice`)
    }else{
     // default date, grouping, order, statuses
     await page.getByText('Calendar Patient 3').waitFor()
     check(await page.locator('input[type=date]').inputValue()===today,`${tag}: defaults to the Asia/Manila date ${today}`)
     check(await page.getByRole('button',{name:'Today',exact:true}).isDisabled(),`${tag}: Today is disabled on today`)
     const headings=await page.locator('.daycal-group .card-head h2').allInnerTexts()
     check(JSON.stringify(headings)===JSON.stringify(['Dr. Alpha','Dr. Beta','Unassigned']),`${tag}: Dentist groups with Unassigned last: ${headings}`)
     const alpha=await page.locator('.daycal-group').first().locator('.daycal-time b').allInnerTexts()
     check(JSON.stringify(alpha)===JSON.stringify(['8:30 AM','10:00 AM','2:00 PM']),`${tag}: sorted by start time: ${alpha}`)
     const t=await body()
     for(const s of ['Completed','In Treatment','Checked In','Cancelled','No-show','Pending','Confirmed'])check(t.includes(s),`${tag}: status ${s} is shown as sent`)
     check(!t.includes('PRIVATE-NOTE-DO-NOT-SHOW'),`${tag}: notes are never shown`)
     check(/7 appointments/.test(t),`${tag}: total 7`)
     // branch filter
     if(variant==='single')check(await page.locator('.daycal-branch').count()===0,`${tag}: one branch = no filter`)
     else{
      await page.locator('.daycal-branch select').selectOption({label:branches[1].name})
      check(/1 appointment\b/.test(await body())&&await page.getByText('Calendar Patient 6').count()===1,`${tag}: branch filter keeps only that branch`)
      await page.locator('.daycal-branch select').selectOption('all')
      check(/7 appointments/.test(await body()),`${tag}: all my branches restores the day`)
     }
     // details dialog: read-only, accessible, focus managed
     const row=page.getByRole('button',{name:/Calendar Patient 2/})
     await row.focus();await page.keyboard.press('Enter')
     const dialog=page.getByRole('dialog')
     await dialog.waitFor()
     const d=await dialog.innerText()
     check(/APT-2026-000002/.test(d)&&/Completed/.test(d)&&/Dr\. Beta/.test(d)&&/PAT-2002/.test(d),`${tag}: details show code, status, Dentist and Patient code`)
     check(!d.includes('PRIVATE-NOTE-DO-NOT-SHOW'),`${tag}: details never include notes`)
     check(await dialog.getByRole('button').filter({hasText:/Cancel appointment|Reschedule|No-show|Complete|Check/i}).count()===0,`${tag}: the dialog has no command buttons`)
     check(await dialog.evaluate(e=>e.contains(document.activeElement)),`${tag}: focus moved inside the dialog`)
     await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-details.png`,fullPage:false})
     await page.keyboard.press('Escape')
     await dialog.waitFor({state:'detached'})
     check(await row.evaluate(e=>e===document.activeElement),`${tag}: focus returns to the appointment row`)
     // navigation: Next day (complete empty), Today re-enabled, Previous, far date outside the shared window
     await page.getByRole('button',{name:'Next day'}).click()
     await page.getByText('No appointments on this date.').waitFor()
     check(await page.getByRole('button',{name:'Today',exact:true}).isEnabled(),`${tag}: Today enabled away from today`)
     await page.getByRole('button',{name:'Today',exact:true}).click()
     await page.getByText('Calendar Patient 3').waitFor();check(true,`${tag}: Today returns to the clinic date`)
     await page.locator('input[type=date]').fill('2025-01-02')
     await page.getByText('Calendar Patient 8').waitFor();check(true,`${tag}: a date far outside the shared window loads`)
     check(dayRequests.includes('2025-01-02#1')&&dayRequests.every(r=>/^\d{4}-\d{2}-\d{2}#\d+$/.test(r)),`${tag}: each fetch is a single-date request`)
     await page.getByRole('button',{name:'Today',exact:true}).click()
     await page.getByText('Calendar Patient 3').waitFor()

     // ---------- Week and Month views ----------
     const visibleCount=loc=>loc.filter({visible:true}).count()
     const [wFrom,wTo]=weekOf(today)
     await page.getByRole('button',{name:'Week',exact:true}).click()
     await page.getByRole('heading',{name:/This week/}).waitFor()
     await page.locator('.daycal-week .daycal-day').first().waitFor()
     check(rangeRequests.includes(`${wFrom}..${wTo}#1`),`${tag}: Week requests Monday–Sunday ${wFrom}..${wTo}`)
     check(await page.getByRole('button',{name:'Week',exact:true}).getAttribute('aria-pressed')==='true','${tag}: Week is pressed'.replace('${tag}',tag))
     check(await page.locator('.daycal-week .daycal-day').count()===7,`${tag}: seven day sections`)
     check(await page.getByRole('button',{name:'This week',exact:true}).isDisabled(),`${tag}: This week is disabled on the current week`)
     check(await page.getByRole('button',{name:'Previous week'}).count()===1&&await page.getByRole('button',{name:'Next week'}).count()===1,`${tag}: Previous/Next week controls`)
     for(let i=0;i<7;i++){
      const d=addDays(wFrom,i),sec=page.locator('.daycal-week .daycal-day').nth(i),txt=await sec.innerText(),n=countOn(d)
      check(n>0?new RegExp(`${n} appointments?`).test(txt):/No appointments/.test(txt),`${tag}: ${d} shows ${n>0?n+' appointment(s)':'No appointments'} from a complete response`)
     }
     check(!(await page.locator('main').innerText()).includes('PRIVATE-NOTE-DO-NOT-SHOW'),`${tag}: week shows no notes`)
     await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-week.png`,fullPage:true})
     await page.locator('.daycal-week .daycal-chip').first().focus();await page.keyboard.press('Enter')
     await page.getByRole('dialog').waitFor();check(/APT-2026-/.test(await page.getByRole('dialog').innerText()),`${tag}: a week appointment opens the details dialog`)
     await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'})
     await page.getByRole('button',{name:'Next week'}).click()
     await page.getByRole('heading',{name:/^(?!.*This week)/}).first().waitFor()
     const [nFrom,nTo]=weekOf(addDays(today,7))
     await page.waitForFunction(()=>true)
     await page.locator('.daycal-week .daycal-day').first().waitFor()
     check(rangeRequests.includes(`${nFrom}..${nTo}#1`),`${tag}: Next week requests ${nFrom}..${nTo}`)
     check(await page.getByRole('button',{name:'This week',exact:true}).isEnabled(),`${tag}: This week re-enabled away from the current week`)
     await page.getByRole('button',{name:'This week',exact:true}).click()
     await page.getByRole('heading',{name:/This week/}).waitFor()
     // a date opens Day view
     const link=page.locator('.daycal-week .daycal-daylink').nth(2)
     await link.click()
     await page.getByRole('heading',{name:/Today|, 20\d\d$/}).first().waitFor()
     check(await page.getByRole('button',{name:'Day',exact:true}).getAttribute('aria-pressed')==='true'&&await page.locator('input[type=date]').inputValue()===addDays(wFrom,2),`${tag}: selecting a date opens Day view for ${addDays(wFrom,2)}`)
     // Month
     const [mFrom,mTo]=monthOf(today)
     await page.getByRole('button',{name:'Today',exact:true}).click().catch(()=>{})
     await page.getByRole('button',{name:'Month',exact:true}).click()
     await page.getByRole('heading',{name:/This month/}).waitFor()
     await page.waitForTimeout(400)
     check(rangeRequests.includes(`${mFrom}..${mTo}#1`),`${tag}: Month requests exactly ${mFrom}..${mTo}`)
     check(!rangeRequests.some(r=>{const [f,t]=r.split('#')[0].split('..');return f<mFrom&&t>=mFrom&&spanDays(f,t)>7&&f!==wFrom}),`${tag}: no month request reaches into adjacent months`)
     check(await page.locator('input[type=month]').inputValue()===today.slice(0,7),`${tag}: month input shows ${today.slice(0,7)}`)
     const days=spanDays(mFrom,mTo)
     if(width>860){
      check(await page.locator('.daycal-month-grid').isVisible()&&!await page.locator('.daycal-agenda').isVisible(),`${tag}: wide screens show the month grid`)
      const cells=page.locator('.daycal-month-grid .daycal-cell')
      const total=await cells.count()
      check(total%7===0&&total>=days,`${tag}: whole-week grid (${total} cells)`)
      const outside=page.locator('.daycal-month-grid .daycal-cell.is-outside')
      for(const t of await outside.allInnerTexts())check(/Not loaded/.test(t)&&!/appointment|No appointments/i.test(t),`${tag}: adjacent-month cell is "Not loaded", never empty or counted`)
      for(const [d,exp] of [[today,countOn(today)],[mFrom,countOn(mFrom)],[mTo,countOn(mTo)]]){
       const cell=page.locator('.daycal-month-grid .daycal-cell:not(.is-outside)').nth(Number(d.slice(8))-1)
       const t=await cell.innerText()
       check(exp>0?new RegExp(`(^|\\n)${exp}(\\n|$)`).test(t):true,`${tag}: ${d} cell total ${exp}`)
      }
      check(/\+\d+ more/.test(await page.locator('.daycal-month-grid').innerText())||countOn(today)<=3,`${tag}: a busy day shows "+N more" only from a complete response`)
     }else{
      check(await page.locator('.daycal-agenda').isVisible()&&!await page.locator('.daycal-month-grid').isVisible(),`${tag}: small screens show a day-by-day list`)
      check(await page.locator('.daycal-agenda .daycal-day').count()===days,`${tag}: ${days} day sections in the list`)
      check(!/Not loaded/.test(await page.locator('.daycal-agenda').innerText()),`${tag}: the list holds only fetched dates`)
     }
     await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}-month.png`,fullPage:true})
     // a month appointment opens details; a date opens Day view
     await page.locator(width>860?'.daycal-month-grid .daycal-chip':'.daycal-agenda .daycal-chip').first().focus();await page.keyboard.press('Enter')
     await page.getByRole('dialog').waitFor();check(true,`${tag}: a month appointment opens the details dialog`)
     await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'})
     await page.getByRole('button',{name:'Next month'}).click()
     const [nmFrom,nmTo]=monthOf(addDays(mTo,1))
     await page.waitForTimeout(500)
     check(rangeRequests.includes(`${nmFrom}..${nmTo}#1`),`${tag}: Next month requests ${nmFrom}..${nmTo}`)
     await page.getByRole('button',{name:'Previous month'}).click()
     await page.getByRole('heading',{name:/This month/}).waitFor()
     const dl=page.locator(width>860?'.daycal-month-grid .daycal-daylink':'.daycal-agenda .daycal-daylink').nth(4)
     await dl.click()
     await page.waitForTimeout(300)
     check(await page.getByRole('button',{name:'Day',exact:true}).getAttribute('aria-pressed')==='true'&&await page.locator('input[type=date]').inputValue()===addDays(mFrom,4),`${tag}: selecting a month date opens Day view for ${addDays(mFrom,4)}`)
     check(!dayRequests.some(r=>r.startsWith(addDays(mFrom,-1))),`${tag}: no single-date request for adjacent-month padding`)
    }
   }
   await page.screenshot({path:`${output}/${tag.replaceAll('/','-')}.png`,fullPage:true})
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
   check(overflow===0,`${tag} overflow: ${overflow}`)
   results.push({tag,overflow})
   await context.close()
  }
 }
 const unexpected=errors.filter(e=>!/status of 500/.test(e))
 check(unexpected.length===0,JSON.stringify(unexpected))
 await writeFile(`${output}/results.json`,JSON.stringify({checks,results,errors,mode:'HTTP fixtures'},null,2));console.log(JSON.stringify({checks,failures:0,errors:errors.length}))
}finally{await browser.close()}
