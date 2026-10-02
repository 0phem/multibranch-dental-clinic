import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import {pathToFileURL} from 'node:url'
import {build} from 'esbuild'
import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {clinic} from '../src/clinic-config.js'
import {publicViewFromHash} from '../src/public-route.js'
import {bootstrapSession} from '../src/session-bootstrap.js'
const require=createRequire(import.meta.url)
const bundle=await build({stdin:{contents:"export * from './src/pages/PublicSite.jsx'; export * from './src/pages/PublicChrome.jsx'; export * from './src/StartupLoading.jsx'; export * from './src/pages/PatientRegister.jsx'; export * from './src/pages/EmailVerification.jsx'; export {Login} from './src/layout.jsx';",resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'react',setup(b){b.onResolve({filter:/^react$/},()=>({path:pathToFileURL(require.resolve('react')).href,external:true}))}}]})
const ui=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const render=(Component,props={})=>renderToStaticMarkup(React.createElement(Component,props))
const page=render(ui.PublicSite)

test('public website renders complete semantic sections and a single primary heading',()=>{
  assert.match(page,/<header/);assert.match(page,/<main/);assert.match(page,/<footer/)
  for(const id of ['home','about','features','portal','contact'])assert.match(page,new RegExp(`id="${id}"`))
  assert.equal((page.match(/<h1>/g)||[]).length,1)
  for(const heading of ['Getting started','Email verification','Your next step'])assert.ok(page.includes(heading))
})
test('public navigation has real anchors, account actions and an accessible mobile menu',()=>{
  const html=render(ui.PublicHeader)
  for(const hash of ['home','about','features','portal','contact','sign-in','create-account'])assert.ok(html.includes(`href="#${hash}"`))
  assert.match(html,/aria-controls="public-navigation"/)
  assert.match(html,/aria-expanded="false"/)
  assert.match(html,/aria-label="Open navigation"/)
  assert.doesNotMatch(html,/href="#"/)
})
test('clinic contact details and telephone/email destinations are exact in contact and footer',()=>{
  assert.equal(clinic.phoneDisplay,'0922 878 7341')
  assert.equal(clinic.email,'danaroxas.dentalclinic@gmail.com')
  for(const html of [page,render(ui.PublicFooter)]){
    assert.ok(html.includes('href="tel:+639228787341"'))
    assert.ok(html.includes('href="mailto:danaroxas.dentalclinic@gmail.com"'))
    assert.ok(html.includes('Bocaue, Bulacan'))
  }
  assert.ok(page.includes(clinic.locationLabel))
})
test('six Patient capabilities are represented with original illustrative portal content',()=>{
  for(const label of ['Appointments','Patient information','Billing &amp; receipts','Documents &amp; consents','HMO information','Clinic communication'])assert.ok(page.includes(label),label)
  assert.match(page,/Illustrative preview/)
  assert.match(page,/role="tablist"/)
  assert.match(page,/role="tabpanel"/)
  assert.doesNotMatch(page,/dentalclinicapp\.com|testimonial|HIPAA|ISO certified|lorem ipsum|demo credentials/i)
})
test('footer has real navigation, account links, verified contacts and current copyright',()=>{
  const html=render(ui.PublicFooter)
  assert.ok(html.includes(`© ${new Date().getFullYear()}`))
  assert.match(html,/All rights reserved/)
  assert.doesNotMatch(html,/Facebook|Instagram|Privacy|Terms|Directions/)
})
test('auth screens retain the shared public header, website return path and contact footer',()=>{
  for(const html of [render(ui.Login,{onLogin:()=>{},onShowRegister:()=>{}}),render(ui.PatientRegister,{onRegister:()=>{},onCancel:()=>{}}),render(ui.EmailVerification,{email:'private@example.test',onVerify:()=>{},onResend:()=>{},onBack:()=>{}})]){
    assert.match(html,/aria-label="Public navigation"/)
    assert.match(html,/href="#home"/)
    assert.match(html,/<footer/)
  }
})
test('registration preserves international editable phone, required DOB and explicit email helper',()=>{
  const html=render(ui.PatientRegister,{onRegister:()=>{},onCancel:()=>{}})
  assert.match(html,/Philippines \+63/)
  assert.match(html,/type="tel"/)
  assert.match(html,/inputMode="tel"/)
  assert.match(html,/type="date" required="" max=/)
  assert.match(html,/We&#x27;ll send your verification code to this email address/)
  assert.equal((html.match(/class="auth-password-toggle"/g)||[]).length,2)
})
test('verification preserves masked destination, OTP input and resend control',()=>{
  const html=render(ui.EmailVerification,{email:'private@example.test',onVerify:()=>{},onResend:()=>{},onBack:()=>{}})
  assert.match(html,/pr•••••@example.test/)
  assert.match(html,/autoComplete="one-time-code"/)
  assert.match(html,/Resend code/)
  assert.doesNotMatch(html,/SMTP|Laravel|SMS/)
})
test('public hash destinations resolve to real auth screens without a persona picker',()=>{
  assert.equal(publicViewFromHash('#create-account'),'register')
  assert.equal(publicViewFromHash('#sign-in'),'login')
  assert.equal(publicViewFromHash('#verify-email'),'verify')
  for(const section of ['','#home','#about','#features','#portal','#contact'])assert.equal(publicViewFromHash(section),'home')
})
test('startup indicator is branded and announces only one loading message',()=>{
  const html=render(ui.LoadingIndicator)
  assert.ok(html.includes(clinic.nameLine));assert.match(html,/src="\/images\/logo.png"/)
  assert.equal((html.match(/role="status"/g)||[]).length,1)
  assert.match(html,/aria-hidden="true"/)
  assert.doesNotMatch(html,/<button|tabindex/i)
  assert.doesNotMatch(render(ui.StartupLoading),/role="status"/,'fast loads initially render no flashing indicator')
})
test('startup returns immediately on readiness and cancels its I/O timeout',async()=>{
  let canceled=false,signal
  const result=await bootstrapSession(async options=>{signal=options.signal;return {ok:true,data:{id:'public-id'}}},{setTimer:()=>42,clearTimer:id=>{assert.equal(id,42);canceled=true}})
  assert.equal(result.ok,true);assert.equal(canceled,true);assert.equal(signal.aborted,false)
})
test('a hung startup request is aborted and can leave loading instead of waiting indefinitely',async()=>{
  let expire
  const result=bootstrapSession(({signal})=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({ok:false,kind:'network'}))),{setTimer:callback=>{expire=callback;return 1},clearTimer:()=>{}})
  expire();assert.deepEqual(await result,{ok:false,kind:'network'})
})
test('loader uses only delayed reveal with cleanup and disables animation for reduced motion',()=>{
  const source=readFileSync('src/StartupLoading.jsx','utf8'),css=readFileSync('src/public-site.css','utf8')
  assert.match(source,/setTimeout\(\(\)=>setVisible\(true\),150\)/)
  assert.match(source,/clearTimeout\(timer\)/)
  assert.match(css,/@media \(prefers-reduced-motion:reduce\)[\s\S]*\.startup-brand,\.startup-track::after,\.site-ready \{ animation:none; \}/)
  assert.doesNotMatch(source,/3000|minimumDuration/)
})

test('verification reload offers recipient recovery without persisting credentials',()=>{
  const html=render(ui.EmailVerification,{onVerify:()=>{},onResend:()=>{},onBack:()=>{}})
  assert.match(html,/Registration email/)
  assert.match(html,/Continue verification/)
  assert.match(html,/autoComplete="one-time-code"/)
})
test('startup timeout settles even when a session adapter ignores abort',async()=>{
  let expire,signal,cleared=false
  const pending=bootstrapSession(options=>{signal=options.signal;return new Promise(()=>{})},{setTimer:fn=>{expire=fn;return 7},clearTimer:id=>{assert.equal(id,7);cleared=true}})
  expire()
  assert.deepEqual(await pending,{ok:false,kind:'network'})
  assert.equal(signal.aborted,true);assert.equal(cleared,true)
})
test('startup converts a rejected session read into recoverable unavailability',async()=>{
  assert.deepEqual(await bootstrapSession(async()=>{throw new Error('offline')}),{ok:false,kind:'network'})
})
test('api.me forwards the exact AbortSignal to fetch and returns its abort as network failure',async()=>{
  const api=await import('../src/api-client.js')
  const original=globalThis.fetch,controller=new AbortController()
  try {
    globalThis.fetch=(url,options)=>{
      assert.ok(url.endsWith('/api/me'))
      assert.equal(options.signal,controller.signal)
      return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted'))))
    }
    const pending=api.me({signal:controller.signal});controller.abort()
    assert.equal((await pending).kind,'network')
  } finally {globalThis.fetch=original}
})

test('every lazy page resolves to its named component export',async()=>{
  const source=readFileSync('src/App.jsx','utf8')
  const imports=[...source.matchAll(/import\('(.+?)'\)\.then\(m=>\(\{default:m\.(\w+)\}\)\)/g)]
  assert.equal(imports.length,26)
  for(const [,path,name] of imports){
    const result=await build({entryPoints:[`src/${path.slice(2)}`],bundle:true,write:false,metafile:true,platform:'node',format:'esm',external:['react']})
    assert.ok(Object.values(result.metafile.outputs).some(output=>output.exports.includes(name)),name)
  }
})
