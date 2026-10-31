// B9 browser acceptance. No new packages, backend or live requests.
// node tests/b9-queue-ui.test.js --prepare writes only local, untracked browser artifacts.
export const fixtureSource = `
import React, { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueuePage } from '/src/pages/PatientFlow.jsx'
import { clinicDate } from '/src/clock.js'
import '/src/styles.css'
import '/src/foundation.css'
import '/src/polish.css'
const role = new URLSearchParams(location.search).get('role') || 'staff'
const today = clinicDate()
const branch = { id: 'b1', name: 'Fictional North Branch with a long location name' }
const fixture = window.b9 = { events: [], unexpected: [], hold: false, fail: false, messageMode: 'ok' }
const names = ['Fictional Alpha Patient', 'Fictional Beta Patient with a long family name', 'Fictional Called Patient', 'Fictional Ready Patient', 'Fictional Done Patient', 'Fictional Away Patient', 'Fictional In Queue Patient']
const statuses = ['Waiting', 'Waiting', 'Called', 'Treatment Ready', 'Served', 'Temporarily Away', 'In Queue']
const patients = names.map((name,i)=>({id:'public-'+i,name,patientCode:'B9-P-'+i}))
const initial = patients.map((p,i)=>({id:'q-'+i,visitId:'v-'+i,appointmentId:i===1?null:'a-'+i, patientId:p.id,patientPublicId:p.id,patientName:p.name,patientCode:p.patientCode,branchId:'b1',branch:branch.name,dentistId:i===6?'d2':'d1',serviceId:'svc1',clinicDate:today,checkedIn:'09:15',status:statuses[i],displayStatus:i===4?'Done':statuses[i],queueNumber:i+10,position:i===4?null:i+1,revision:7,walkIn:i===1,lateArrival:i===1}))
const reply = data => ({ok:true,status:200,headers:{},json:async()=>({data,meta:{next_cursor:null}})})
window.fetch = async url => {
 const path = new URL(String(url),location.origin).pathname
 if(path==='/api/intake/submissions')return reply([])
 if(path==='/api/conversations') {
  fixture.events.push({type:'message-read'})
  if(fixture.messageMode==='hold')await new Promise(resolve=>{fixture.releaseMessage=resolve})
  if(fixture.messageMode==='denied')return {ok:false,status:403,headers:{},json:async()=>({message:'Forbidden'})}
  return reply(fixture.messageMode==='missing'?[]:[{id:'thread-beta',status:'Open',patient:{id:'public-1',code:'B9-P-1',name:names[1]},branch}])
 }
 fixture.unexpected.push(path); return {ok:false,status:503,headers:{},json:async()=>({})}
}
function Harness(){
 const [queue,setQueue]=useState(initial)
 const session={role,active:true,userId:'user',serverUserId:'server-user',dentistId:'d1',branchId:'b1',branchScopes:['b1']}
 const state={users:[{id:'user',personId:'person',role:role==='owner'?'Owner / Admin':role==='dentist'?'Dentist':'Staff',status:'Active',branchId:'b1',permissions:['all']}],persons:[{id:'person'}],staff:[{id:'staff',userId:'user',personId:'person',branchId:'b1'}],dentists:[{id:'d1',userId:'user',personId:'person',name:'Fictional Dentist with a long professional name',branchIds:['b1']},{id:'d2',name:'Fictional Second Dentist',branchIds:['b1']}],branches:[branch],patients,queue,appointments:[],visits:[],treatments:[]}
 const store={state,session,appointmentsStatus:'ready',queueSnapshot:{date:today,truncated:false},toast:(message,tone)=>fixture.events.push({type:'toast',message,tone}),appointmentFlow:{refresh:async()=>{},queueCommand:async(q,command,key)=>{
  fixture.events.push({type:'command',id:q.id,revision:q.revision,command,key})
  if(fixture.hold)await new Promise(resolve=>{fixture.release=resolve})
  if(fixture.fail)return {ok:false,message:'Fictional stale queue revision'}
  setQueue(rows=>rows.map(r=>r.id===q.id?{...r,status:'Called',displayStatus:'Called',revision:r.revision+1}:r));return {ok:true}
 }}}
 fixture.empty=()=>setQueue([])
 return <main style={{padding:16,maxWidth:1200,margin:'auto'}}><QueuePage role={role} activeBranch={branch.name} store={store} setPage={(page,context)=>fixture.events.push({type:'navigate',page,context})}/></main>
}
createRoot(document.getElementById('root')).render(<Harness/>)
`

export async function runB9(page, base = 'http://127.0.0.1:5178', width = 1440) {
  const results = [], errors = [], escaped = []
  const check = (v, m) => { if (!v) throw new Error(m) }
  const equal = (a, b, m) => check(JSON.stringify(a) === JSON.stringify(b), `${m}: ${JSON.stringify(a)}`)
  const origin = new URL(base).origin
  const route = async r => {
    const u = new URL(r.request().url())
    if (u.origin === origin && !/^\/(api|sanctum)\//.test(u.pathname)) return r.continue()
    escaped.push(u.origin + u.pathname); return r.abort()
  }
  const error = e => errors.push(e.message)
  const consoleError = m => { if(m.type()==='error') errors.push(m.text()) }
  await page.context().route('**/*', route)
  page.on('pageerror', error)
  page.on('console', consoleError)
  await page.setViewportSize({width,height:1000})
  const open = async role => {
    await page.goto(`${origin}/.playwright-mcp/b9-fixture.html?role=${role}`)
    await page.locator('.queue-open-row').first().waitFor()
  }
  const beta = () => page.locator('.queue-open-row').filter({hasText:'B9-P-1'})
  const events = type => page.evaluate(type=>window.b9.events.filter(e=>e.type===type),type)
  const layout = async () => {
    const bad = await page.locator('.queue-live-card').evaluate(card => {
      const vw = document.documentElement.clientWidth
      return [...card.querySelectorAll('td,button,.status')].filter(e=>{
        const r=e.getBoundingClientRect();return r.width && (r.left < 0 || r.right > vw+1 || e.scrollWidth > e.clientWidth+1)
      }).map(e=>e.textContent)
    })
    equal(bad, [], 'no clipped/overflowing queue content')
    check(await page.locator('.queue-actions > button').evaluateAll(bs=>bs.every(b=>b.getBoundingClientRect().height>=44)),'44px action targets')
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'no document overflow')
  }
  try {
    for (const role of ['staff','owner','dentist']) {
      await open(role)
      equal(await page.locator('.queue-open-row').count(),role==='dentist'?5:6,'active role scope')
      equal(await page.locator('.queue-message-btn').count(),role==='owner'?0:role==='dentist'?5:6,'message permissions')
      equal(await page.getByRole('button',{name:'Open Treatment',exact:true}).count(),role==='dentist'?4:0,'treatment permissions')
      await layout()
      await beta().focus()
      check(await beta().evaluate(e=>e===document.activeElement),'row focus')
      check(await beta().evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'visible focus')
      await page.keyboard.press('Tab')
      check(await beta().getByRole('button',{name:/Open chart/}).evaluate(e=>e===document.activeElement),'Tab reaches nested chart action')
      await beta().focus()
      await page.keyboard.press('Space')
      equal((await events('navigate'))[0],{type:'navigate',page:'patients',context:{queueEntryId:'q-1',visitId:'v-1',patientId:'public-1',appointmentId:null,dentistId:'d1',branchId:'b1',serviceId:'svc1',treatmentId:null}},'walk-in exact context')
      await beta().locator('[data-column="checkedIn"]').click()
      equal((await events('navigate')).length,2,'mouse row opens once')
      await beta().getByRole('button',{name:/Open chart/}).click()
      equal((await events('navigate')).length,3,'nested chart opens once')
      await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('All')
      check(await page.locator('.queue-status').filter({hasText:'Done'}).count()===1,'Done display meaning retained')
      await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('In Treatment')
      equal(await page.locator('.queue-open-row').count(),2,'Called and Treatment Ready filter')
      await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Done')
      equal(await page.locator('.queue-open-row').count(),1,'Done filter')
      await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Active')
      if(role==='staff'){
        await page.getByRole('combobox',{name:'Dentist',exact:true}).selectOption('d2')
        equal(await page.locator('.queue-open-row').count(),1,'dentist filter')
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Done')
        await page.getByText('No patients match this view',{exact:true}).waitFor()
        await page.getByRole('combobox',{name:'Dentist',exact:true}).selectOption('All Dentists')
        await page.getByRole('combobox',{name:'Status',exact:true}).selectOption('Active')
      }
      await page.screenshot({path:`.playwright-mcp/b9-${role}-${width}.png`,fullPage:true})
      equal(await page.evaluate(()=>window.b9.unexpected),[],'no unexpected mock endpoints')
      results.push(`${width}: ${role} layout, mouse/keyboard identity, permissions, statuses and filters`)
    }
    await open('staff')
    await page.evaluate(()=>{window.b9.hold=true;window.b9.fail=true})
    await beta().getByRole('button',{name:/Call patient/}).click()
    check(await page.locator('.queue-call-btn').evaluateAll(bs=>bs.every(b=>b.disabled)),'all Call controls disabled during command')
    equal((await events('navigate')).length,0,'Call does not open chart')
    equal((await events('command')).length,1,'one command')
    const command=(await events('command'))[0]
    check(command.id==='q-1'&&command.revision===7&&command.command==='call'&&!!command.key,'exact server command boundary')
    await page.evaluate(()=>window.b9.release())
    await page.waitForFunction(()=>window.b9.events.some(e=>e.type==='toast'))
    check((await beta().locator('.queue-status').innerText()).includes('Waiting'),'failed command retains Waiting')
    await page.evaluate(()=>{window.b9.hold=false;window.b9.fail=false})
    await beta().getByRole('button',{name:/Call patient/}).focus(); await page.keyboard.press('Enter')
    await page.waitForFunction(()=>document.querySelectorAll('.queue-call-btn').length===2)
    check((await beta().locator('.queue-status').innerText()).includes('Called'),'successful Call renders Called')
    equal((await events('navigate')).length,0,'keyboard Call does not open chart')
    results.push(`${width}: Call busy, failure, retry and keyboard propagation`)
    for(const mode of ['missing','denied','hold']){
      await open('staff')
      await page.evaluate(mode=>{window.b9.messageMode=mode},mode)
      await beta().getByRole('button',{name:/Open conversation/}).focus(); await page.keyboard.press('Enter')
      if(mode==='hold'){
        check(await page.locator('.queue-message-btn').evaluateAll(bs=>bs.every(b=>b.disabled)),'Message busy disabled')
        await page.evaluate(()=>window.b9.releaseMessage())
        await page.waitForFunction(()=>window.b9.events.some(e=>e.type==='navigate'))
        equal((await events('navigate')).map(e=>({page:e.page,patient:e.context.patientPublicId,branch:e.context.branchId,thread:e.context.conversationId})),[{page:'messages',patient:'public-1',branch:'b1',thread:'thread-beta'}],'exact authorized conversation only')
      }else{
        await page.waitForFunction(()=>window.b9.events.some(e=>e.type==='toast'))
        equal(await events('navigate'),[],'missing/denied message never opens chart or thread')
      }
      equal(await page.evaluate(()=>window.b9.unexpected),[],'message requests mocked')
    }
    results.push(`${width}: Message busy, missing, denied and exact conversation`)
    await open('dentist')
    await beta().getByRole('button',{name:'Open Treatment',exact:true}).click()
    equal((await events('navigate')).map(e=>[e.page,e.context.patientId,e.context.visitId]),[['treatment','public-1','v-1']],'exact nested Treatment without chart open')
    await page.evaluate(()=>window.b9.empty())
    await page.getByText('No patients match this view',{exact:true}).waitFor()
    await layout()
    await page.screenshot({path:`.playwright-mcp/b9-empty-${width}.png`,fullPage:true})
    await page.emulateMedia({reducedMotion:'reduce'})
    await open('staff'); await layout()
    await page.emulateMedia({reducedMotion:'no-preference'})
    results.push(`${width}: nested Treatment, empty collection and reduced motion`)
    equal(errors,[],'browser errors');equal(escaped,[],'no requests escaped fixtures')
    return results
  }finally{
    page.off('pageerror',error);page.off('console',consoleError);await page.context().unroute('**/*',route)
  }
}

// NODE_ENTRY: browser tool evaluates exports above; optional installed Playwright launcher below.
if (typeof process !== 'undefined' && process.argv[1]?.replaceAll('\\','/').endsWith('/b9-queue-ui.test.js')) {
  const {mkdir,writeFile} = await import('node:fs/promises')
  if(process.argv.includes('--prepare')){
    await mkdir('.playwright-mcp',{recursive:true})
    await writeFile('.playwright-mcp/b9-fixture.jsx',fixtureSource)
    await writeFile('.playwright-mcp/b9-fixture.html','<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>B9 fictional queue acceptance</title></head><body><div id="root"></div><script type="module" src="/.playwright-mcp/b9-fixture.jsx"></script></body></html>')
    console.log('Prepared local fictional B9 artifacts in .playwright-mcp')
  }else{
    const {default:test}=await import('node:test')
    const {pathToFileURL}=await import('node:url')
    const modulePath=process.env.B9_PLAYWRIGHT_MODULE
    const pw=modulePath?await import(pathToFileURL(modulePath).href):null
    for(const width of [1440,390])test(`B9 rendered queue acceptance ${width}px`,{skip:!pw&&'Use existing Playwright tool or B9_PLAYWRIGHT_MODULE; prepare fixture first.'},async()=>{
      const browser=await pw.chromium.launch({headless:true,channel:'chrome'})
      try{const page=await browser.newPage({serviceWorkers:'block'});console.log(await runB9(page,process.env.B9_BASE_URL,width))}finally{await browser.close()}
    })
  }
}
