// LIVE-BACKEND verification of the Staff Day Calendar (M6) and live-queue counts (M9) against the locally running Laravel API
// and Vite dev server, using the documented local demo accounts. Read-only application flows only: it signs in, navigates and
// reads. It creates, changes and seeds nothing, and never prints credentials. The one injected condition (a blocked queue
// request, labelled below) is a browser-side network fault, not a backend result.
// Usage: PLAYWRIGHT_MODULE=<playwright/index.mjs> QA_BASE_URL=http://localhost:5173 QA_API_URL=http://localhost:8000 node scripts/m6-m9-live-backend-qa.mjs
import assert from 'node:assert/strict'
import {mkdir,readFile,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.QA_BASE_URL||'http://localhost:5173',api=process.env.QA_API_URL||'http://localhost:8000'
const output=process.env.QA_OUTPUT||'/tmp/live-backend'
await mkdir(output,{recursive:true})
// Password: the documented local-dev value (backend/.env DEMO_ACCOUNT_PASSWORD, else the seeder's local fallback). Never logged.
async function demoPassword(){
 if(process.env.QA_PASSWORD)return process.env.QA_PASSWORD
 const env=await readFile(new URL('../backend/.env',import.meta.url),'utf8').catch(()=>'')
 const fromEnv=env.match(/^DEMO_ACCOUNT_PASSWORD=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'')
 if(fromEnv)return fromEnv
 const seeder=await readFile(new URL('../backend/database/seeders/DemoAccountsSeeder.php',import.meta.url),'utf8')
 return seeder.match(/env\('DEMO_ACCOUNT_PASSWORD',\s*'([^']+)'\)/)?.[1]
}
const password=await demoPassword()
const accounts={staff:'staff.reception@example.test',owner:'owner@example.test',dentist:'dentist@example.test',patient:'patient@example.test'}
const manilaToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'}).format(new Date())
const addDays=(d,n)=>{const v=new Date(`${d}T00:00:00Z`);v.setUTCDate(v.getUTCDate()+n);return v.toISOString().slice(0,10)}
const results=[];let checks=0
const check=(ok,message)=>{results.push({ok:!!ok,message});if(!ok)throw new assert.AssertionError({message});checks++}
const browser=await chromium.launch({channel:'chrome'})

async function session(role,{width=1440,height=900,blockQueue=false}={}){
 const context=await browser.newContext({viewport:{width,height}})
 const log=[]
 const page=await context.newPage()
 page.on('response',async r=>{
  const u=new URL(r.url())
  if(!r.url().startsWith(api)||!/^\/api\/(appointments|queue)(\/|$)/.test(u.pathname))return
  const entry={method:r.request().method(),path:u.pathname+u.search,status:r.status()}
  try{const body=await r.json();entry.rows=Array.isArray(body.data)?body.data.length:null;entry.meta=body.meta?{current_page:body.meta.current_page,last_page:body.meta.last_page,per_page:body.meta.per_page,total:body.meta.total,truncated:body.meta.truncated}:null;entry.sample=Array.isArray(body.data)?body.data.map(x=>({status:x.status,code:x.code,branch:x.branch?.id,keys:Object.keys(x)})):null}catch{}
  log.push(entry)
 })
 if(blockQueue)await page.route(`${api}/api/queue?*`,route=>route.abort('failed'))
 await page.emulateMedia({reducedMotion:'reduce'})
 await page.goto(`${base}/#sign-in`)
 await page.getByLabel('Email').fill(accounts[role])
 await page.locator('input[type=password]').first().fill(password)
 await page.getByRole('button',{name:'Sign in'}).click()
 try{await page.locator('.workspace-label,.patient-mobile-nav,.topbar').first().waitFor({timeout:15000})}catch{throw new Error(`BLOCKED: ${role} sign-in did not complete against the local backend`)}
 return {context,page,log}
}
const nav=async(page,label)=>{
 const visible=page.getByRole('button',{name:label,exact:true}).filter({visible:true})
 if(!await visible.count()){const m=page.getByRole('button',{name:'Open navigation',exact:true});if(await m.count())await m.first().click()}
 await page.getByRole('button',{name:label,exact:true}).filter({visible:true}).first().click()
}
const out={live:{},injected:{}}
try{
 // ===================================== STAFF: day calendar ======================================
 {
  const today=manilaToday()
  const {context,page,log}=await session('staff')
  await nav(page,'Appointment Calendar')
  await page.getByRole('heading',{name:'Appointment Calendar',exact:true}).waitFor()
  await page.getByText('No appointments on this date.').waitFor({timeout:15000})
  const first=log.find(e=>e.path.startsWith('/api/appointments?date='))
  check(first&&first.status===200,'LIVE staff: GET /api/appointments?date= returned 200')
  check(first.path===`/api/appointments?date=${today}&per_page=100&page=1`,`LIVE staff: selected date is the Asia/Manila clinic date, sent with per_page=100&page=1 (${first.path})`)
  check(first.meta&&first.meta.current_page===1&&first.meta.last_page>=1&&first.meta.per_page===100&&Number.isInteger(first.meta.total),'LIVE staff: real pagination meta present and honoured (per_page 100)')
  check(first.rows===0&&first.meta.last_page===1,'LIVE staff: an empty day is a complete single-page response, shown as empty only after it')
  check(await page.locator('.daycal-branch').count()===0,'LIVE staff: one assigned branch (b1) => no branch filter')
  const dayShot=a=>page.screenshot({path:`${output}/${a}.png`,fullPage:true})
  // a day with a real record
  await page.locator('input[type=date]').fill('2026-10-01')
  await page.getByText('1 appointment',{exact:false}).first().waitFor({timeout:15000})
  const d1=log.find(e=>e.path.startsWith('/api/appointments?date=2026-10-01'))
  check(d1&&d1.status===200&&d1.rows===1&&d1.meta.total===1,'LIVE staff: 2026-10-01 returns the one real appointment (total 1)')
  const rec=d1.sample[0]
  check(rec.status==='Cancelled'&&rec.branch==='b1','LIVE staff: real status Cancelled in branch b1 (authorized scope)')
  check(await page.locator('.daycal-row .status',{hasText:rec.status}).count()===1&&(await page.locator('main').innerText()).includes('Cancelled'),'LIVE staff: the row shows the status exactly as the server returned it')
  check(!(rec.keys.includes('notes')&&(await page.locator('main').innerText()).includes('notes:')),'LIVE staff: notes are not rendered')
  await dayShot('staff-1440-live-2026-10-01')
  // desktop details dialog
  await page.locator('.daycal-row').first().focus();await page.keyboard.press('Enter')
  const dialog=page.getByRole('dialog');await dialog.waitFor()
  const text=await dialog.innerText()
  check(text.includes(rec.code)&&/Cancelled/.test(text)&&/Branch A/.test(text),'LIVE staff: details dialog shows the real code, status and branch')
  check(/Booked via\s*Patient portal/.test(text.replace(/\n+/g,' ')),'LIVE staff: the real booking source (patient_portal) reads as plain words')
  check(await dialog.evaluate(e=>e.contains(document.activeElement)),'LIVE staff: focus is inside the dialog')
  check(await dialog.getByRole('button').filter({hasText:/cancel appointment|reschedule|no-show|complete|check/i}).count()===0,'LIVE staff: the dialog has no command buttons')
  await page.screenshot({path:`${output}/staff-1440-live-details-dialog.png`})
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'})
  check(await page.locator('.daycal-row').first().evaluate(e=>e===document.activeElement),'LIVE staff: focus returns to the row on close')
  // previous / next day send the shifted date
  const before=log.length
  await page.getByRole('button',{name:'Next day'}).click();await page.getByText('No appointments on this date.').waitFor()
  await page.getByRole('button',{name:'Previous day'}).click();await page.getByText('1 appointment',{exact:false}).first().waitFor()
  const shifted=log.slice(before).map(e=>e.path.split('&')[0])
  check(shifted.includes('/api/appointments?date=2026-10-02')&&shifted.includes('/api/appointments?date=2026-10-01'),'LIVE staff: Next/Previous send 2026-10-02 then 2026-10-01')
  // refresh behaviour (60 s poll) while visible
  const n0=log.filter(e=>e.path.startsWith('/api/appointments?date=2026-10-01')).length
  await page.waitForTimeout(65000)
  const n1=log.filter(e=>e.path.startsWith('/api/appointments?date=2026-10-01')).length
  check(n1>n0,`LIVE staff: the visible page refreshes the selected day after ~60 s (${n0} -> ${n1} requests)`)
  check(await page.getByText('Showing the last loaded list').count()===0,'LIVE staff: a successful refresh shows no stale notice')
  // 1024 px normal calendar
  await page.setViewportSize({width:1024,height:900});await page.waitForTimeout(300)
  await dayShot('staff-1024-live-2026-10-01')
  check(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)===0,'LIVE staff: no horizontal overflow at 1024 px')
  await page.getByRole('button',{name:'Today',exact:true}).click();await page.getByText('No appointments on this date.').waitFor()
  await dayShot('staff-1024-live-today')
  // ---------- Week and Month views against the real endpoint (from/to) ----------
  const range=(f,t)=>log.filter(e=>e.path===`/api/appointments?from=${f}&to=${t}&per_page=100&page=1`)
  const dow=d=>(new Date(`${d}T00:00:00Z`).getUTCDay()+6)%7
  const wkFrom=addDays(today,-dow(today)),wkTo=addDays(wkFrom,6)
  await page.setViewportSize({width:1440,height:900})
  await page.getByRole('button',{name:'Week',exact:true}).click()
  await page.getByRole('heading',{name:/This week/}).waitFor()
  await page.locator('.daycal-week .daycal-day').first().waitFor()
  await page.waitForTimeout(600)
  check(range(wkFrom,wkTo).some(e=>e.status===200&&e.meta&&e.meta.last_page===1&&e.meta.per_page===100),`LIVE staff: Week sends from=${wkFrom}&to=${wkTo} (Monday–Sunday) and gets real pagination meta`)
  check(await page.locator('.daycal-week .daycal-day').count()===7&&(await page.locator('.daycal-week').innerText()).split('No appointments').length-1===7,'LIVE staff: an empty real week is 7 "No appointments" days, shown after the complete response')
  await page.locator('input[type=date]').fill('2026-10-01')
  await page.getByText('1 appointment',{exact:false}).first().waitFor({timeout:15000})
  const w2=range('2026-09-28','2026-10-04')[0]
  check(w2&&w2.status===200&&w2.rows===1,'LIVE staff: the week of 2026-10-01 is requested as 2026-09-28..2026-10-04 and returns the real appointment')
  const sec=page.locator('.daycal-week .daycal-day',{hasText:'Oct 1'}).first()
  check(/1 appointment/.test(await sec.innerText())&&/Cancelled/.test(await sec.innerText()),'LIVE staff: Thu Oct 1 shows the real appointment with its status text')
  await page.screenshot({path:`${output}/staff-1440-live-week.png`,fullPage:true})
  await page.getByRole('button',{name:'Month',exact:true}).click()
  await page.getByRole('heading',{name:/October 2026/}).waitFor()
  await page.waitForTimeout(600)
  const m1=range('2026-10-01','2026-10-31')[0]
  check(m1&&m1.status===200&&m1.rows===1&&m1.meta.total===1,'LIVE staff: Month requests exactly 2026-10-01..2026-10-31 and returns the one real appointment')
  check(!log.some(e=>/from=2026-09-(2[0-9]|30)&to=2026-1/.test(e.path)&&e.path.includes('to=2026-10-31')),'LIVE staff: the month request does not reach into September')
  const grid=page.locator('.daycal-month-grid')
  check(await grid.isVisible(),'LIVE staff: the month grid is shown on a wide screen')
  const gt=await grid.innerText()
  check((gt.match(/Not loaded/g)||[]).length===4,'LIVE staff: the 4 adjacent-month padding cells (Sep 28–30, Nov 1) read "Not loaded", not empty')
  check(/Cancelled/.test(gt)&&await page.locator('.daycal-month-grid .daycal-cell:not(.is-outside) .daycal-count').count()===1,'LIVE staff: exactly one in-month cell has a count (Oct 1)')
  await page.screenshot({path:`${output}/staff-1440-live-month.png`,fullPage:true})
  await page.setViewportSize({width:1024,height:900});await page.waitForTimeout(300)
  await page.screenshot({path:`${output}/staff-1024-live-month.png`,fullPage:true})
  await page.getByRole('button',{name:'Previous month'}).click()
  await page.getByRole('heading',{name:/September 2026/}).waitFor()
  await page.waitForTimeout(600)
  const m0=range('2026-09-01','2026-09-30')[0]
  check(m0&&m0.status===200&&m0.rows===0&&m0.meta.last_page===1,'LIVE staff: Previous month requests 2026-09-01..2026-09-30 (real, empty, complete)')
  check(await page.getByText('Only part of this month was loaded').count()===0,'LIVE staff: a complete empty month shows no incomplete warning')
  await page.setViewportSize({width:375,height:800});await page.waitForTimeout(300)
  check(await page.locator('.daycal-agenda').isVisible()&&!await page.locator('.daycal-month-grid').isVisible(),'LIVE staff: small screens switch to the day-by-day list')
  await page.screenshot({path:`${output}/staff-375-live-month.png`,fullPage:true})
  // a date from the month list opens Day view
  await page.locator('.daycal-agenda .daycal-daylink').nth(0).click()
  await page.waitForTimeout(500)
  check(await page.locator('input[type=date]').inputValue()==='2026-09-01','LIVE staff: selecting a month date opens Day view for that date')
  await page.setViewportSize({width:1440,height:900})
  out.live.calendarRequests=log.filter(e=>e.path.startsWith('/api/appointments')).map(e=>({path:e.path,status:e.status,rows:e.rows,meta:e.meta}))
  await context.close()
 }
 // ===================================== STAFF: live queue =======================================
 {
  const today=manilaToday()
  const {context,page,log}=await session('staff')
  await nav(page,'Live Queue by Branch')
  await page.getByRole('heading',{name:'Live Queue by Branch',exact:true}).waitFor()
  await page.getByText(/0 awaiting/).first().waitFor({timeout:15000})
  const q=log.find(e=>e.path.startsWith('/api/queue?'))
  check(q&&q.status===200&&q.path===`/api/queue?date=${today}`,`LIVE staff: queue requested for the Asia/Manila clinic date (${q?.path})`)
  check(q.rows===0&&q.meta&&q.meta.truncated===false,'LIVE staff: the real authorized queue response has 0 entries and states it is complete (meta.truncated false)')
  const t=await page.locator('main').innerText()
  check(/Branch A[\s\S]*0 awaiting/.test(t)&&/Waiting 0 • Called 0 • Treatment Ready 0 • Temporarily Away 0/.test(t),'LIVE staff: counts equal the response (all zero) only after a successful complete response')
  check(!/\d+\s*%|Healthy|Attention|~\d+ min|Threshold/.test(t),'LIVE staff: no estimate, percentage or capacity label')
  await nav(page,'Live Queue');await page.getByRole('heading',{name:'Patient Queue',exact:true}).waitFor()
  check(await page.locator('.queue-count-grid .stat-value',{hasText:'0'}).count()===4,'LIVE staff: Live Queue page shows four zero counts from the same response')
  check(!/Est\. wait/.test(await page.locator('main').innerText()),'LIVE staff: no estimated-wait column')
  await nav(page,'Operations')
  await page.getByText('Awaiting treatment',{exact:false}).first().waitFor()
  check(await page.locator('.stat-card',{hasText:'Awaiting treatment'}).first().innerText().then(x=>/\b0\b/.test(x)),'LIVE staff: dashboard awaiting count is 0 from the same response')
  out.live.queueRequests=log.filter(e=>e.path.startsWith('/api/queue')).map(e=>({path:e.path,status:e.status,rows:e.rows,meta:e.meta}))
  await context.close()
 }
 // ============ STAFF: sidebar scrolling keeps every item keyboard-accessible (1440x900, then 1024x600) ============
 for(const [w,h] of [[1440,900],[1440,520]]){
  const {context,page}=await session('staff',{width:w,height:h})
  await page.getByRole('heading',{level:1}).first().waitFor()
  const info=await page.evaluate(()=>{const n=document.querySelector('.main-nav');return {scrollable:n.scrollHeight>n.clientHeight,items:[...n.querySelectorAll('button')].map(b=>b.textContent.trim())}})
  // Tab through the whole sidebar, recording what takes focus and whether it is actually visible inside the nav viewport
  await page.locator('.main-nav button').first().focus()
  const seen=[],hidden=[]
  for(let i=0;i<info.items.length+2;i++){
   const r=await page.evaluate(()=>{const a=document.activeElement,n=document.querySelector('.main-nav');if(!n.contains(a))return {outside:true,text:a.textContent.trim()};const b=a.getBoundingClientRect(),v=n.getBoundingClientRect();return {text:a.textContent.trim(),visible:b.top>=v.top-1&&b.bottom<=v.bottom+1}})
   if(r.outside)break
   seen.push(r.text);if(!r.visible)hidden.push(r.text)
   await page.keyboard.press('Tab')
  }
  check(JSON.stringify(seen)===JSON.stringify(info.items),`LIVE staff ${w}x${h}: Tab reaches all ${info.items.length} sidebar items in order (${seen.length} reached)`)
  check(hidden.length===0,`LIVE staff ${w}x${h}: every focused sidebar item is scrolled into view${hidden.length?` — NOT visible: ${hidden.join(', ')}`:''}`)
  const cue=await page.evaluate(()=>{const c=getComputedStyle(document.querySelector('.main-nav'));return {thin:c.scrollbarWidth,bg:c.backgroundImage.includes('gradient')}})
  check(cue.thin==='thin'&&cue.bg,`LIVE staff ${w}x${h}: the sidebar has a thin scrollbar and scroll-shadow cue (no layout change)`)
  if(h===520)await page.screenshot({path:`${output}/staff-${w}x${h}-sidebar.png`})
  out.live[`sidebar_${w}x${h}`]={scrollable:info.scrollable,items:info.items.length}
  // After the last item, focus moves on to Log out, which must also be visible and reachable
  const logout=await page.evaluate(()=>{const a=document.activeElement;const b=a.getBoundingClientRect();return {text:a.textContent.trim(),visible:b.top>=0&&b.bottom<=innerHeight}})
  check(/Log out/.test(logout.text)&&logout.visible,`LIVE staff ${w}x${h}: Log out is the next Tab stop and is visible`)
  if(h===900)await page.screenshot({path:`${output}/staff-${w}x${h}-sidebar.png`})
  await context.close()
 }
 // ============================== DENIAL: Owner, Dentist, Patient ==========================================
 // Patient live denial stays PENDING: the demo Patient sign-in requires an emailed verification code, which this script does not
 // trigger, read or enter, so no Patient sign-in is attempted here.
 out.live.patientDenial='PENDING: not attempted (email verification code required); fixture/code-level denial only'
 for(const role of ['owner','dentist']){
  let opened
  try{opened=await session(role)}catch(e){if(role==='patient'){out.live.patientDenial='BLOCKED: the demo Patient sign-in stops at email verification (a 6-digit code is required); not entered or read';results.push({ok:false,blocked:true,message:out.live.patientDenial});continue}throw e}
  const {context,page,log}=opened
  await page.waitForTimeout(1500)
  const menu=page.getByRole('button',{name:'Open navigation',exact:true})
  if(await menu.count()&&await menu.first().isVisible())await menu.first().click().catch(()=>{})
  check(await page.getByRole('button',{name:'Appointment Calendar',exact:true}).count()===0,`LIVE ${role}: no Day Calendar navigation`)
  check(!log.some(e=>/^\/api\/appointments\?date=/.test(e.path)),`LIVE ${role}: no single-date appointment request`)
  check(!(await page.locator('body').innerText()).includes('Previous day'),`LIVE ${role}: no calendar controls`)
  if(role==='owner')check(await page.getByRole('button',{name:'Live Queue by Branch',exact:true}).count()>=1,'LIVE owner: Live Queue by Branch nav label is present')
  await context.close()
 }
 // ===================== INJECTED browser-side fault (NOT a backend result): queue request blocked ===================
 {
  const {context,page}=await session('staff',{blockQueue:true})
  await nav(page,'Live Queue by Branch')
  await page.getByRole('heading',{name:'Live Queue by Branch',exact:true}).waitFor()
  await page.getByText(/unavailable|couldn’t be loaded/i).first().waitFor({timeout:15000})
  const t=await page.locator('main').innerText()
  check(!/\b0 awaiting\b/.test(t),'INJECTED (queue request blocked in the browser, other calls live): failure shows no zero')
  out.injected.queueBlocked=true
  await context.close()
 }
 await writeFile(`${output}/live-results.json`,JSON.stringify({checks,results,out},null,2))
 console.log(JSON.stringify({checks,failures:0,output}))
}catch(e){
 await writeFile(`${output}/live-results.json`,JSON.stringify({checks,results,out,error:String(e.message||e).slice(0,500)},null,2)).catch(()=>{})
 console.log(JSON.stringify({checks,failure:String(e.message||e).slice(0,300)}))
 process.exitCode=1
}finally{await browser.close()}
