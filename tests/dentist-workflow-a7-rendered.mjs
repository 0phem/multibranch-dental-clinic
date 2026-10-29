async (page) => {
  const check = (ok, message) => { if (!ok) throw Error(message) }
  await page.unrouteAll()
  const draft = {id:'rx1',status:'Draft',can_edit:true,visit:'v1',patient:{name:'Illustrative Patient'},lines:[{medicine:'Illustrative custom medicine',dosage:'Illustrative custom dosage',frequency:'',duration:'',instructions:''}]}
  await page.route('**/api/**', r => {
    const path = new URL(r.request().url()).pathname
    return r.fulfill({json:path.endsWith('/visits')?{data:[{id:'v1',date:'2026-10-29',patient:{name:'Illustrative Patient',age:null},branch:'Illustrative branch'}],meta:{}}:path==='/api/prescriptions'?{data:[draft]}:{data:draft}})
  })
  const results=[]
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:1000})
    await page.goto('http://127.0.0.1:5178/tests/fixtures/dentist-workflow-a7.html')
    const date=page.getByLabel('Schedule date',{exact:true})
    await date.waitFor()
    await page.getByText('Assigned Walk-in Visits Today (1)',{exact:true}).waitFor()
    check((await page.locator('.schedule-time b').allTextContents()).slice(1).join('|')==='9:00 AM – 9:30 AM|10:00 AM – 10:30 AM|1:00 PM – 1:30 PM','time ordering')
    check(await page.getByText('Excluded other dentist').count()===0,'dentist isolation')
    await page.getByLabel('Filter schedule by status').selectOption('Pending')
    check(await page.locator('.day-schedule > .schedule-slot').count()===1,'status filter')
    await page.getByLabel('Filter schedule by status').selectOption('All')
    await page.getByRole('button',{name:'Previous day'}).click()
    check(await date.inputValue()==='2026-10-28','previous day')
    await page.getByText(/Viewing past appointments/).waitFor()
    check(await page.locator('.day-schedule > .schedule-slot').count()===1,'past appointments remain visible')
    await date.fill('2026-12-31')
    await page.getByRole('button',{name:'Next day'}).click()
    check(await date.inputValue()==='2027-01-01','year rollover')
    await page.getByRole('button',{name:'Previous day'}).click()
    check(await date.inputValue()==='2026-12-31','reverse year rollover')
    await date.fill('2026-10-31');await page.getByRole('button',{name:'Next day'}).click()
    check(await date.inputValue()==='2026-11-01','month rollover')
    await page.getByRole('button',{name:'Today',exact:true}).click()
    check(await date.inputValue()==='2026-10-29','Manila today')
    await page.getByRole('button',{name:/Refresh/}).click()
    await page.getByText('Schedule refreshed',{exact:true}).waitFor()
    await page.getByRole('button',{name:'Next day'}).focus();await page.keyboard.press('Enter')
    check(await date.inputValue()==='2026-10-30','keyboard navigation')
    await page.getByRole('button',{name:'Today',exact:true}).click()
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow')
    for(const b of await page.locator('.dentist-schedule-controls button').all()) check((await b.boundingBox()).height>=44,'tap target')
    await page.screenshot({path:`docs/ui-review/dentist-a7/after-${width}.png`,fullPage:true})
    await page.getByRole('button',{name:'prescriptions',exact:true}).click()
    await page.getByRole('button',{name:'Open',exact:true}).click()
    await page.getByRole('dialog').getByRole('button',{name:'Edit draft',exact:true}).click()
    await page.getByLabel('Specify medicine name').waitFor()
    check(await page.getByLabel('Specify custom dosage').inputValue()==='Illustrative custom dosage','draft values preserved')
    check(await page.getByRole('dialog').count()===0,'review closes before editor')
    await page.screenshot({path:`docs/ui-review/dentist-a7/edit-${width}.png`,fullPage:true})
    results.push(`${width}: date navigation, month/year rollover, past view, walk-in, refresh, keyboard, 44px targets, overflow, review-to-edit 1 click passed`)
  }
  return results
}
