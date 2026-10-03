// Isolated HTTP-fixture browser QA. Does not create accounts or send mail.
import assert from 'node:assert/strict'
import {mkdir,writeFile} from 'node:fs/promises'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright')
const output=process.env.QA_OUTPUT||'/tmp/m1-browser'
await mkdir(output,{recursive:true})
const browser=await chromium.launch({channel:'chrome'})
const errors=[],results=[]
let checks=0
const check=(value,message)=>{assert.ok(value,message);checks++}
try {
 for(const width of [375,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900}})
  let authenticated=false,revoked=false
  const me={id:'01K00000000000000000000001',role:'patient',email:'review@example.test',name:'Review Patient',first_name:'Review',last_name:'Patient',account_status:'Active',patient:{id:'01K00000000000000000000002',code:'PAT-QA'},branch_scopes:[]}
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname,body=r.request().postDataJSON()
   const reply=(status,json)=>r.fulfill({status,json})
   if(path==='/api/me')return reply(authenticated&&!revoked?200:401,authenticated&&!revoked?{data:me}:{message:'Unauthenticated.'})
   if(path==='/api/login'){
    if(body.password==='WrongPass1!')return reply(422,{code:'invalid_credentials',message:'These credentials do not match our records.'})
    if(body.email==='unverified@example.test')return reply(422,{code:'email_verification_required',message:'Verify your email before signing in.'})
    authenticated=true;revoked=false;return reply(200,{data:me})
   }
   if(path==='/api/logout'){authenticated=false;return r.fulfill({status:204})}
   if(path==='/api/register'&&(!body.date_of_birth||body.date_of_birth>'2026-10-03'))return reply(422,{message:'Check your details.',errors:{date_of_birth:['Enter a valid date of birth.']}})
   if(path==='/api/register')return reply(201,{data:{email:me.email,verification_required:true,resend_available_at:new Date(Date.now()+60000).toISOString()}})
   if(path==='/api/register/verify'){
    if(body.otp==='000001')return reply(422,{code:'otp_expired',message:'That code has expired. Request a new code.'})
    if(body.otp==='000002')return reply(422,{code:'already_verified',message:'This email address is already verified.'})
    if(body.otp==='123456'){authenticated=true;return reply(200,{data:me})}
    return reply(422,{code:'invalid_otp',message:'That verification code is not valid.'})
   }
   if(revoked)return reply(403,{code:'session_revoked',message:'Your session has ended. Sign in again.'})
   return reply(200,{data:[]})
  })
  const page=await context.newPage()
  await page.emulateMedia({reducedMotion:'reduce'})
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&!/401|403|422/.test(m.text()))errors.push(m.text())})
  const go=async hash=>{await page.goto(`${process.env.QA_BASE_URL||'http://127.0.0.1:5173'}/#${hash}`);await page.locator('h1').first().waitFor()}
  const overflow=async()=>{const n=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);check(n===0,`overflow at ${width}`);return n}
  await go('sign-in')
  await overflow()
  await page.locator('input[type=email]').fill(me.email)
  await page.locator('input[autocomplete=current-password]').fill('WrongPass1!')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.getByText('These credentials do not match our records.',{exact:true}).waitFor()
  check(true,'wrong password shown')
  await page.locator('input[type=email]').fill('unverified@example.test')
  await page.locator('input[autocomplete=current-password]').fill('Password123!')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.locator('#verify-title').waitFor();check(true,'unverified login enters verification')
  await go('create-account')
  await page.getByRole('textbox',{name:'First name',exact:true}).fill('Review')
  await page.getByRole('textbox',{name:'Last name',exact:true}).fill('Patient')
  await page.locator('input[type=email]').fill(me.email)
  await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('123')
  await page.locator('input[autocomplete=new-password]').nth(0).fill('Password123!')
  await page.locator('input[autocomplete=new-password]').nth(1).fill('Password123!')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.locator('.field-error').first().waitFor()
  check(await page.locator('.phone-field-number').getAttribute('aria-invalid')==='true','malformed phone')
  await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('9171234567')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.locator('input[type=date][aria-invalid=true]').waitFor();check(true,'missing DOB')
  await page.locator('input[type=date]').fill('2099-01-01')
  await page.getByRole('textbox',{name:'Phone number',exact:true}).fill('9171234567')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.locator('input[type=date][aria-invalid=true]').waitFor();check(true,'future DOB blocked')
  await overflow()
  await page.locator('input[type=date]').fill('1995-01-01')
  await page.getByRole('button',{name:'Create account',exact:true}).click()
  await page.locator('.auth-destination').waitFor()
  check(!(await page.locator('.auth-destination').textContent()).includes('review@'),'destination masked')
  check(await page.getByRole('button',{name:'Resend code',exact:true}).isDisabled(),'resend cooldown')
  await page.getByRole('textbox',{name:'Email verification code',exact:true}).fill('000000')
  await page.getByRole('button',{name:'Verify email',exact:true}).click()
  await page.getByText('That verification code is not valid.',{exact:true}).waitFor();check(true,'invalid OTP')
  for(const [otp,message] of [['000001','That code has expired. Request a new code.'],['000002','This email address is already verified.']]){
    await page.getByRole('textbox',{name:'Email verification code',exact:true}).fill(otp)
    await page.getByRole('button',{name:'Verify email',exact:true}).click()
    await page.getByText(message,{exact:true}).waitFor();check(true,'OTP refusal shown')
  }
  await page.screenshot({path:`${output}/verification-${width}.png`,fullPage:true})
  await overflow()
  await page.getByRole('textbox',{name:'Email verification code',exact:true}).fill('123456')
  await page.getByRole('button',{name:'Verify email',exact:true}).click()
  await page.locator('.public-auth').waitFor({state:'detached'})
  check(authenticated,'verified workspace')
  await page.reload();await page.locator('h1').first().waitFor()
  check(await page.locator('.public-auth').count()===0,'session restored after reload')
  await overflow()
  await page.screenshot({path:`${output}/patient-${width}.png`,fullPage:true})
  if(!await page.getByRole('button',{name:'Log out',exact:true}).first().isVisible())await page.getByRole('button',{name:'Menu',exact:true}).click()
  await page.getByRole('button',{name:'Log out',exact:true}).filter({visible:true}).click()
  if(width<=1024)await page.getByRole('dialog',{name:'Log out?',exact:true}).getByRole('button',{name:'Log out',exact:true}).click()
  await page.locator('#login-title').waitFor();check(!authenticated,'logout control invalidated server fixture')
  await page.locator('input[type=email]').fill(me.email)
  await page.locator('input[autocomplete=current-password]').fill('Password123!')
  await page.getByRole('button',{name:'Sign in',exact:true}).click()
  await page.locator('.public-auth').waitFor({state:'detached'});check(authenticated,'login after logout')
  revoked=true
  await page.evaluate(async()=>{const api=await import('/src/api-client.js');await api.createUserAccountRemote({})})
  await page.locator('#login-title').waitFor();check(true,'revoked session exits workspace')
  results.push({width,overflow:await overflow()})
  await context.close()
 }
 for(const width of [375,1440]){
  const context=await browser.newContext({viewport:{width,height:900}})
  await context.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await context.route('**/api/**',r=>{
    const path=new URL(r.request().url()).pathname
    const me={id:'01K00000000000000000000003',role:'owner',email:'owner@example.test',name:'Dana Roxas',account_status:'Active',branch_scopes:[]}
    return r.fulfill({status:200,json:{data:path==='/api/me'?me:[]}})
  })
  const page=await context.newPage()
  await page.emulateMedia({reducedMotion:'reduce'})
  page.on('pageerror',e=>errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&!/401|403|422/.test(m.text()))errors.push(m.text())})
  await page.goto(`${process.env.QA_BASE_URL||'http://127.0.0.1:5173'}/#sign-in`)
  await page.locator('.workspace-label').waitFor()
  if(await page.getByRole('button',{name:'Open navigation',exact:true}).isVisible())await page.getByRole('button',{name:'Open navigation',exact:true}).click()
  await page.getByRole('button',{name:'User Management',exact:true}).filter({visible:true}).click()
  await page.getByRole('heading',{name:'User Management',exact:true}).waitFor()
  await page.getByText(/Staff and Dentist account creation is unavailable/).waitFor()
  check(true,'privileged provisioning visibly deferred')
  check(await page.getByRole('button',{name:'Create Patient Account',exact:true}).count()===1,'Patient-only creation UI')
  check(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)===0,'Owner management overflow')
  await page.screenshot({path:`${output}/owner-users-${width}.png`,fullPage:true})
  await context.close()
 }
 check(errors.length===0,JSON.stringify(errors))
 const report={checks,results,errors,mode:'HTTP fixtures; real backend authorization tested separately'}
 await writeFile(`${output}/results.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
} finally {await browser.close()}
