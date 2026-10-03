// Optional browser regression pass. Uses a locally installed Playwright (no browser
// dependency in the application). API responses are fixtures; this creates no accounts
// and sends no email. Run against Vite or the production preview.
// PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs QA_CDP_URL=http://127.0.0.1:9222 node scripts/public-auth-locations-qa.mjs
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const base=process.env.QA_BASE_URL||'http://localhost:5173'
const output=resolve(process.env.QA_OUTPUT||'/tmp/clinic-refinement/browser')
await mkdir(output,{recursive:true})
const browser=process.env.QA_CDP_URL?await chromium.connectOverCDP(process.env.QA_CDP_URL):await chromium.launch()
const results=[],errors=[],expectedNetworkErrors=[]
let checks=0
const check=(condition,message)=>{assert.ok(condition,message);checks++}
const delay=ms=>new Promise(r=>setTimeout(r,ms))
async function setup(){
  const context=await browser.newContext({hasTouch:true})
  await context.route('**/sanctum/csrf-cookie',route=>route.fulfill({status:204}))
  await context.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname
    const body=route.request().postDataJSON()
    const reply=(status,data)=>route.fulfill({status,json:data})
    if(path==='/api/me')return reply(401,{message:'Unauthenticated.'})
    if(path==='/api/login'){await delay(350);return reply(422,{code:'invalid_credentials',message:'The email or password is incorrect.'})}
    if(path==='/api/register'){
      if(!body.date_of_birth)return reply(422,{message:'Check your details.',errors:{date_of_birth:['Enter your date of birth.']}})
      await delay(350)
      return reply(202,{data:{email:body.email,resend_available_at:new Date(Date.now()+2500).toISOString()}})
    }
    if(path==='/api/register/verify')return reply(422,{message:'The verification code is invalid or expired.'})
    if(path==='/api/register/resend')return reply(200,{data:{resend_available_at:new Date(Date.now()+60000).toISOString()}})
    return reply(200,{data:[]})
  })
  const page=await context.newPage()
  await page.emulateMedia({reducedMotion:'reduce'})
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{
    if(m.type()!=='error')return
    if(/401|422|ERR_FAILED|ERR_BLOCKED_BY_CLIENT/.test(m.text()))expectedNetworkErrors.push(m.text())
    else errors.push(m.text())
  })
  return {context,page}
}
const overflow=page=>page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)
const go=async(page,hash)=>{
  await page.goto(`${base}/#${hash}`)
  await page.locator('.public-site,.public-auth').waitFor()
  await page.locator('h1').waitFor()
}
const snap=async(page,name,fullPage=true)=>{
  if(fullPage)await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  await page.waitForTimeout(180)
  return page.screenshot({path:`${output}/${name}.png`,fullPage})
}
async function sectionShot(page,name){
  // Capture document coordinates directly: element screenshots can clip a tall
  // mobile section after their implicit scroll-to-center operation.
  const scrollbarStyle=await page.addStyleTag({content:'html { scrollbar-width:none; } html::-webkit-scrollbar { display:none; }'})
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}))
  // Scrollbar removal resizes the map; allow its ResizeObserver and replacement
  // tiles to settle before capturing the otherwise correctly loaded section.
  await page.waitForTimeout(500)
  if(await page.locator('.map-ready').count()){
    await page.waitForFunction(()=>{
      const tiles=[...document.querySelectorAll('#locations .leaflet-tile')]
      return tiles.length>0&&tiles.every(tile=>tile.complete&&tile.naturalWidth>0)
    },{},{timeout:15000})
  }
  const clip=await page.locator('#locations').boundingBox()
  const session=await page.context().newCDPSession(page)
  try {
    const result=await session.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,clip:{...clip,scale:1}})
    await writeFile(`${output}/${name}.png`,Buffer.from(result.data,'base64'))
  } finally {await session.detach();await scrollbarStyle.evaluate(e=>e.remove())}
}
try {
  const {context,page}=await setup()
  for(const width of [375,430,768,1024,1440]){
    await page.setViewportSize({width,height:900})
    for(const route of ['home','sign-in','create-account','verify-email']){
      await go(page,route)
      if(route==='home'){
        await page.locator('#locations').scrollIntoViewIfNeeded()
        await page.locator('.map-ready').waitFor({timeout:20000})
        check(await page.locator('.clinic-pin').count()===3,'three real pins')
        check(await page.locator('.site-branch-card').count()===3,'three branch cards')
        const labels=await page.locator('.clinic-pin>b').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {number:e.textContent,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}))
        const [one,two]=labels
        check(one.bottom<=two.y||two.bottom<=one.y||one.right<=two.x||two.right<=one.x,'Bocaue labels do not overlap')
        const frame=await page.locator('.site-location-map').boundingBox()
        for(const label of labels)check(label.x>=frame.x&&label.right<=frame.x+frame.width&&label.y>=frame.y&&label.bottom<=frame.y+frame.height,'marker label stays in map')
        check(await page.locator('.site-map-canvas :is(button,a,input,[tabindex="0"])').count()===0,'map has no focus targets')
        await sectionShot(page,`locations-${width}`)
      } else {
        check(await page.locator('.auth-intro').count()===0,'marketing panel removed')
        if(route==='create-account'){
          check(await page.locator('fieldset').count()===3,'registration groups')
          await page.getByRole('button',{name:/Country and calling code/}).click()
          await page.getByRole('searchbox',{name:'Search countries'}).fill('United States')
          await page.getByRole('searchbox').press('ArrowDown')
          check(await page.evaluate(()=>document.activeElement.getAttribute('role'))==='option','country arrow-key focus')
          await page.keyboard.press('Enter')
          await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('4155550123')
          check(await page.getByRole('textbox',{name:'Phone number',exact:true}).inputValue()==='4155550123','international phone editable')
          check(await page.locator('input[type=date]').getAttribute('required')!==null,'DOB required')
          await page.locator('input[type=date]').fill('1995-03-14')
          for(const name of ['password','confirm password']){
            await page.getByRole('button',{name:`Show ${name}`,exact:true}).click()
            check(await page.getByRole('button',{name:`Hide ${name}`,exact:true}).getAttribute('aria-pressed')==='true','password toggle')
            await page.getByRole('button',{name:`Hide ${name}`,exact:true}).click()
          }
          await page.getByRole('button',{name:/Country and calling code/}).click()
          check(await overflow(page)===0,'open country menu does not overflow')
          await snap(page,`country-menu-${width}`,false)
          await page.keyboard.press('Escape')
          check(await page.getByRole('button',{name:/Country and calling code/}).evaluate(e=>e===document.activeElement),'Escape restores country focus')
        }
        await snap(page,`${route}-${width}`)
      }
      const value=await overflow(page)
      check(value===0,`${route} overflow at ${width}`)
      results.push({width,route,overflow:value})
    }
    // Real page transitions with isolated API fixtures; no production writes.
    await go(page,'sign-in')
    await page.locator('input[type=email]').fill('qa@example.test')
    await page.locator('input[autocomplete=current-password]').fill('InvalidPassword1!')
    await page.getByRole('button',{name:'Sign in',exact:true}).click()
    await page.getByRole('button',{name:'Signing in…'}).waitFor()
    await page.getByText('The email or password is incorrect.',{exact:true}).waitFor()
    await snap(page,`login-error-${width}`)
    await page.getByRole('button',{name:'Create an account',exact:true}).click()
    await page.locator('#register-title').waitFor()
    await page.getByRole('textbox',{name:'First name',exact:true}).fill('Jamie')
    await page.getByRole('textbox',{name:'Last name',exact:true}).fill('Review')
    await page.locator('input[type=email]').fill('private@example.test')
    await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('9171234567')
    await page.locator('input[autocomplete=new-password]').nth(0).fill('Password123!')
    await page.locator('input[autocomplete=new-password]').nth(1).fill('Password123!')
    await page.getByRole('button',{name:'Create account',exact:true}).click()
    await page.getByText('Enter your date of birth.',{exact:true}).waitFor()
    check(await page.locator('input[type=date]').getAttribute('aria-invalid')==='true','DOB error attached to field')
    await snap(page,`register-error-${width}`)
    await page.locator('input[type=date]').fill('1995-03-14')
    await page.getByRole('button',{name:'Create account',exact:true}).click()
    await page.locator('.auth-destination').waitFor()
    check(await page.locator('.auth-destination').textContent()==='pr•••••@example.test','masked destination')
    check(await page.getByRole('button',{name:'Resend code',exact:true}).isDisabled(),'initial resend cooldown')
    await page.getByRole('button',{name:'Resend code',exact:true}).waitFor({state:'visible'})
    await page.waitForFunction(()=>![...document.querySelectorAll('button')].find(b=>b.textContent==='Resend code').disabled)
    await page.getByRole('button',{name:'Resend code',exact:true}).click()
    await page.getByText(/You can request another code in/).waitFor()
    check(await page.getByRole('button',{name:'Resend code',exact:true}).isDisabled(),'resend restarts cooldown')
    await snap(page,`verification-masked-${width}`)
    await page.getByRole('textbox',{name:'Email verification code',exact:true}).fill('123456')
    await page.getByRole('button',{name:'Verify email',exact:true}).click()
    await page.getByText('The verification code is invalid or expired.',{exact:true}).waitFor()
    check(await page.getByText('The verification code is invalid or expired.',{exact:true}).count()===1,'single verification error')
    check(await overflow(page)===0,'masked verification/error overflow')
    await snap(page,`verification-error-${width}`)
    await page.getByRole('button',{name:'Use a different email',exact:true}).click()
    await page.locator('#login-title').waitFor()
    if(width<1000){
      await page.getByRole('button',{name:'Open navigation'}).click()
      await page.getByRole('navigation',{name:'Public navigation',exact:true}).getByRole('link',{name:'Locations',exact:true}).click()
      await page.locator('#locations').waitFor()
      check(await page.getByRole('button',{name:'Open navigation'}).getAttribute('aria-expanded')==='false','mobile menu closes after navigation')
    }
  }
  await context.close()
  // Verify loading isolation on a fresh document, followed by real map gestures.
  const lazy=await setup(),p=lazy.page
  const mapRequests=[]
  p.on('request',r=>{if(/clinic-map|tile.openstreetmap/.test(r.url()))mapRequests.push(r.url())})
  await p.setViewportSize({width:1440,height:900})
  await go(p,'home');await delay(500)
  check(mapRequests.length===0,'no map code or tiles requested at hero')
  await p.locator('#locations').scrollIntoViewIfNeeded();await p.locator('.map-ready').waitFor()
  check(mapRequests.length>0,'map loads near section')
  const state=()=>p.locator('.leaflet-map-pane').getAttribute('style')
  const original=await state(),box=await p.locator('.site-location-map').boundingBox()
  await p.mouse.move(box.x+box.width/2,box.y+150);const y=await p.evaluate(()=>scrollY)
  await p.mouse.wheel(0,140);await delay(300)
  check(await p.evaluate(()=>scrollY)>y,'map does not capture wheel scroll')
  check(await state()===original,'wheel does not zoom map')
  await p.locator('.site-location-map').scrollIntoViewIfNeeded()
  const current=await p.locator('.site-location-map').boundingBox()
  await p.mouse.move(current.x+200,current.y+120);await p.mouse.down();await p.mouse.move(current.x+300,current.y+180);await p.mouse.up()
  await p.mouse.dblclick(current.x+200,current.y+150)
  await p.keyboard.press('ArrowRight');await p.keyboard.press('+')
  check(await state()===original,'drag/double-click/keyboard do not move map')
  const cdp=await lazy.context.newCDPSession(p)
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:current.x+150,y:current.y+150},{x:current.x+250,y:current.y+150}]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:current.x+100,y:current.y+150},{x:current.x+300,y:current.y+150}]})
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
  check(await state()===original,'pinch does not change the map')
  const contact=p.locator('#contact')
  check(await contact.locator('a[href="tel:+639228787341"]').count()===1,'central phone link')
  check(await contact.locator('a[href="mailto:danaroxas.dentalclinic@gmail.com"]').count()===1,'central email link')
  for(const link of await p.locator('.site-nav-links a').all()){
    const href=await link.getAttribute('href')
    check(await p.locator(href).count()===1,`public destination ${href}`)
  }
  const count=mapRequests.length
  await go(p,'sign-in');await delay(300)
  check(mapRequests.length===count,'auth requests no map assets')
  await lazy.context.close()
  // Both failure classes keep the semantic branch cards and measured height.
  for(const failure of ['tiles','chunk']){
    const fail=await setup()
    await fail.page.setViewportSize({width:375,height:900})
    await fail.context.route(failure==='tiles'?'https://tile.openstreetmap.org/**':'**/*clinic-map*',route=>route.abort())
    await go(fail.page,'home');await fail.page.locator('#locations').scrollIntoViewIfNeeded()
    await fail.page.getByText('Map unavailable',{exact:true}).waitFor({timeout:20000})
    check(await fail.page.locator('.site-branch-card').count()===3,`${failure} failure retains addresses`)
    check((await fail.page.locator('.site-location-map').boundingBox()).height===340,'fallback preserves height')
    check(await overflow(fail.page)===0,'fallback overflow')
    await sectionShot(fail.page,`map-${failure}-failure`)
    await fail.context.close()
  }
  check(errors.length===0,`unexpected console/runtime errors: ${errors.join('; ')}`)
  const report={checks,results,errors,expectedNetworkErrorCount:expectedNetworkErrors.length}
  await writeFile(`${output}/results.json`,JSON.stringify(report,null,2))
  console.log(JSON.stringify(report,null,2))
} finally {await browser.close()}
