import assert from 'node:assert/strict'

/** Execute with Playwright against Vite; every API call is synthetic and intercepted. */
export async function runDentistA6(page,{base='http://127.0.0.1:5178',screenshotDir=null}={}) {
  let draft=null, license='TEST-LICENSE', mode='normal', approvals=0, writes=0, savedLicense=null
  const results=[]
  const template=()=>({key:'recall_due',name:'Recall wording',revision:4,subject:'Illustrative follow-up for {patient_name}',body:'Hello {patient_name},\n\nPlease contact the clinic to discuss a follow-up visit.\n\nIllustrative test wording only.',placeholders:['patient_name'],needs_dentist:true,approved:approvals>0,owner_approval:{by:'Illustrative Owner'},dentist_approval:approvals?{by:'Illustrative Dentist'}:null})
  await page.route('**/sanctum/csrf-cookie',r=>r.fulfill({status:204}))
  await page.route('**/api/**',async r=>{
    const req=r.request(),u=new URL(req.url()),path=u.pathname,method=req.method()
    if(path==='/api/prescriptions/visits') return r.fulfill({json:{data:[{id:'v1',date:'2026-10-29',patient:{name:'Illustrative Patient',age:null},branch:'Illustrative branch'}],meta:{common_medicines:['Illustrative medicine'],license_no:license,allergy_notice:'Review the synthetic record.'}}})
    if(path==='/api/me/prescription-license') {
      savedLicense=req.postDataJSON();await new Promise(resolve=>setTimeout(resolve,200))
      if(mode==='license-error') return r.fulfill({status:422,json:{message:'Illustrative license failure',errors:{rx_license_no:['Illustrative license failure']}}})
      license=savedLicense.rx_license_no; return r.fulfill({json:{data:{rx_license_no:license}}})
    }
    if(path==='/api/prescriptions'&&method==='GET') return r.fulfill({json:{data:draft?[draft]:[]}})
    if(path==='/api/prescriptions'&&method==='POST'||path==='/api/prescriptions/rx1'&&method==='PUT') {
      writes++; const body=req.postDataJSON();draft={id:'rx1',visit:'v1',revision:(draft?.revision||0)+1,status:'Draft',date:null,patient:{name:'Illustrative Patient'},dentist:'Illustrative Dentist',branch:'Illustrative branch',can_edit:true,...body}
      return r.fulfill({json:{data:draft}})
    }
    if(path==='/api/prescriptions/rx1') return r.fulfill({json:{data:draft}})
    if(path==='/api/followups') return r.fulfill({json:{data:['Open','Contacted','Booked','Closed'].map((status,i)=>({id:'f'+i,status,overdue:i===0,due_on:'2026-10-28',patient:{name:'Illustrative Patient',code:'TEST'},branch:{name:'Illustrative branch'},assignee:'Illustrative Dentist',reason:'Illustrative follow-up',can_book:false,can_contact:false,can_close:false})),meta:{counts:{open:1,overdue:1,due_today:0}}}})
    if(path==='/api/message-templates') {
      await new Promise(resolve=>setTimeout(resolve,180))
      if(mode==='wording-error') return r.fulfill({status:503,json:{message:'Illustrative wording failure'}})
      return r.fulfill({json:{data:mode==='empty'?[]:[template()],meta:{recall_rules:[{category:'Illustrative review',months:6}]}}})
    }
    if(path.endsWith('/preview')) {
      if(mode==='preview-error') return r.fulfill({status:503,json:{message:'Illustrative preview failure'}})
      return r.fulfill({json:{data:{subject:'Illustrative example email',html:'<!doctype html><html><body style="font:16px/1.6 sans-serif;padding:20px"><h2>Illustrative test data</h2><p>No real Patient details.</p><p>Please contact the clinic to discuss a follow-up visit.</p></body></html>'}}})
    }
    if(path.endsWith('/dentist-approve')) {
      assert.equal(req.postDataJSON().expected_revision,4)
      if(mode==='approval-error') return r.fulfill({status:409,json:{message:'Illustrative stale wording. Reload before approval.'}})
      approvals++;return r.fulfill({json:{data:template()}})
    }
    throw new Error('Unexpected API call: '+method+' '+path)
  })
  const contrast=async locator=>locator.evaluate(e=>{
    const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4})
    const lum=a=>a[0]*.2126+a[1]*.7152+a[2]*.0722
    const s=getComputedStyle(e),a=lum(rgb(s.color)),b=lum(rgb(s.backgroundColor));return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)
  })
  for(const width of [1440,390]) for(const colorScheme of ['light','dark']) {
    mode='normal';approvals=0;draft=null
    await page.setViewportSize({width,height:1000});await page.emulateMedia({colorScheme})
    await page.goto(base+'/tests/fixtures/dentist-ui-a6.html')
    const med=page.getByRole('combobox',{name:'Select medicine 1',exact:true})
    await med.waitFor()
    const options=await med.locator('option').allTextContents()
    assert.ok(options.includes('Illustrative medicine'),'server-provided name is rendered')
    assert.ok(!options.some(s=>/\d+\s*(mg|ml|tablet|capsule)/i.test(s)),'medicine options contain names only')
    await med.selectOption('Amoxicillin')
    assert.equal(await page.getByRole('combobox',{name:'Select dosage 1',exact:true}).inputValue(),'','no dosage autofill')
    await med.selectOption('__other__');await page.getByLabel('Specify medicine name').fill('Illustrative custom medicine')
    await page.getByRole('combobox',{name:'Select dosage 1',exact:true}).selectOption('__other__')
    await page.getByLabel('Specify custom dosage').fill('Illustrative custom dosage')
    await page.getByRole('button',{name:'Add another medicine'}).click()
    const remove=page.getByRole('button',{name:'Remove medicine 2',exact:true})
    assert.equal(await remove.getAttribute('type'),'button')
    assert.ok(await contrast(remove)>=4.5,'remove normal contrast')
    const red=await remove.evaluate(e=>getComputedStyle(e).color);assert.ok(/163, 44, 60/.test(red))
    await remove.hover();assert.ok(await contrast(remove)>=4.5,'remove hover contrast')
    await page.keyboard.press('Tab');await remove.focus();assert.ok(await remove.evaluate(e=>getComputedStyle(e).outlineStyle!=='none'),'visible keyboard focus')
    assert.ok(await contrast(remove)>=4.5,'remove keyboard focus contrast')
    const before=writes;await remove.click();assert.equal(writes,before,'removal does not submit')
    assert.equal(await page.locator('.rx-line').count(),1)
    await page.getByRole('combobox',{name:/^Visit/}).selectOption('v1')
    await page.getByRole('button',{name:'Save draft',exact:true}).click()
    await page.getByRole('dialog').waitFor();assert.equal(draft.lines[0].medicine,'Illustrative custom medicine');assert.equal(draft.lines[0].dosage,'Illustrative custom dosage')
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    await page.reload();await page.getByRole('button',{name:'Edit draft',exact:true}).click()
    await page.getByLabel('Specify medicine name').waitFor()
    assert.equal(await page.getByLabel('Specify medicine name').inputValue(),'Illustrative custom medicine')
    assert.equal(await page.getByLabel('Specify custom dosage').inputValue(),'Illustrative custom dosage')
    await page.getByLabel('Specify custom dosage').fill('Illustrative edited dosage')
    await page.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByRole('dialog').waitFor()
    assert.equal(draft.lines[0].dosage,'Illustrative edited dosage')
    await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click()
    const licenseInput=page.getByRole('textbox',{name:'License number',exact:true}),save=page.locator('.rx-license-row').getByRole('button',{name:'Save',exact:true})
    await licenseInput.fill('TEST-UPDATED');const ib=await licenseInput.boundingBox(),sb=await save.boundingBox()
    assert.equal(sb.height,44,'standard save height');assert.equal(ib.height,44,'input height')
    if(width===1440) assert.ok(Math.abs(ib.y+ib.height-sb.y-sb.height)<=1,'input/button bottoms align')
    await save.click();await page.getByRole('button',{name:'Saving…',exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Saving…',exact:true}).isDisabled())
    await page.locator('#feedback').getByText('Saved.',{exact:true}).waitFor();assert.equal(savedLicense.rx_license_no,'TEST-UPDATED')
    mode='license-error';await save.click();await page.locator('#feedback').getByText('Illustrative license failure',{exact:true}).waitFor();assert.equal(await licenseInput.inputValue(),'TEST-UPDATED');mode='normal'
    if(screenshotDir&&colorScheme==='light') await page.screenshot({path:screenshotDir+`/clinical-${width}.png`,fullPage:true})
    await page.getByRole('navigation',{name:'Acceptance screens'}).getByRole('button',{name:'followups',exact:true}).click()
    await page.locator('.fd-list .fd-badge').first().waitFor()
    const colors=[]
    for(const status of ['Open','Contacted','Booked','Closed','Overdue']) {
      const badge=page.locator('.fd-list .fd-badge').getByText(status,{exact:true})
      assert.ok(await contrast(badge)>=4.5,status+' badge contrast')
      colors.push(await badge.evaluate(e=>getComputedStyle(e).backgroundColor))
    }
    assert.equal(new Set(colors).size,5,'five distinct status fills')
    if(screenshotDir&&colorScheme==='light') await page.screenshot({path:screenshotDir+`/followups-${width}.png`,fullPage:true})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'clinical mobile overflow')
    results.push(`Clinical ${width}/${colorScheme}: names/dosage separation, custom draft reload/edit, removal, license save/error/layout, five labelled contrast-checked statuses`)
    await page.getByRole('navigation',{name:'Acceptance screens'}).getByRole('button',{name:'home',exact:true}).click()
    await page.getByRole('region',{name:'Dentist Clinic Home'}).waitFor()
    assert.ok(await page.locator('.dentist-home h1').evaluate(e=>parseFloat(getComputedStyle(e).fontSize))>=26)
    assert.equal(await page.locator('.clinical-stat-stack b').first().innerText(),'1')
    assert.equal(await page.locator('.clinical-stat-stack b').first().evaluate(e=>getComputedStyle(e).fontSize),'30px')
    assert.equal(await page.locator('.dentist-home .day-list-row b').first().evaluate(e=>getComputedStyle(e).fontSize),'16px')
    assert.equal(await page.locator('.dentist-home .task-list small').first().evaluate(e=>getComputedStyle(e).fontSize),'14px')
    await page.getByRole('button',{name:'Open chart',exact:true}).click();await page.locator('#feedback').getByText('Navigate: patients',{exact:true}).waitFor()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home mobile overflow')
    if(screenshotDir&&colorScheme==='light') await page.screenshot({path:screenshotDir+`/home-${width}.png`,fullPage:true})
    await page.getByRole('navigation',{name:'Acceptance screens'}).getByRole('button',{name:'wording',exact:true}).click()
    await page.getByRole('status').getByText('Loading wording for review…',{exact:true}).waitFor()
    const approve=page.getByRole('button',{name:'Approve this wording',exact:true})
    await approve.waitFor();assert.equal(approvals,0,'no automatic approval')
    assert.equal(await page.locator('.dentist-wording textarea').count(),0,'Dentist cannot edit wording')
    assert.equal(await page.getByRole('button',{name:'Send a test to myself'}).count(),0)
    assert.ok((await approve.boundingBox()).height>=44)
    await page.frameLocator('iframe').getByText('No real Patient details.').waitFor()
    assert.equal(await page.locator('iframe').getAttribute('sandbox'),'allow-same-origin')
    if(screenshotDir&&colorScheme==='light') await page.screenshot({path:screenshotDir+`/wording-${width}.png`,fullPage:true})
    mode='approval-error';await approve.click();await page.getByRole('alert').getByText('Illustrative stale wording. Reload before approval.').waitFor();assert.equal(approvals,0)
    mode='normal';await approve.click();await page.getByText('Dentist review complete',{exact:true}).waitFor();assert.equal(approvals,1);assert.equal(await page.getByRole('button',{name:'Approve this wording',exact:true}).count(),0)
    assert.equal(await page.getByRole('alert').count(),0,'a successful review clears the stale failure')
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'wording mobile overflow')
    results.push(`Dashboard/wording ${width}/${colorScheme}: typography, navigation, read-only preview, manual revision-bound approval, stale refusal, no overflow`)
  }
  for(const scenario of ['empty','wording-error','preview-error']) {
    mode=scenario;approvals=0;await page.reload();await page.getByRole('navigation',{name:'Acceptance screens'}).getByRole('button',{name:'wording',exact:true}).click()
    if(scenario==='empty') await page.getByText('Nothing needs your approval.',{exact:true}).waitFor()
    if(scenario==='wording-error') {await page.getByText('Wording unavailable',{exact:true}).waitFor();mode='normal';await page.getByRole('button',{name:'Retry wording'}).click();await page.getByRole('button',{name:'Approve this wording',exact:true}).waitFor()}
    if(scenario==='preview-error') {await page.getByRole('alert').getByText('Illustrative preview failure').waitFor();mode='normal';await page.getByRole('button',{name:'Preview formatted email',exact:true}).click();await page.frameLocator('iframe').getByText('No real Patient details.').waitFor()}
  }
  results.push('Wording empty, initial failure/retry and preview failure/retry passed')
  return results
}
