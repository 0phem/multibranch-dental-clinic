import assert from 'node:assert/strict'

export async function runA5Acceptance(page, {base='http://127.0.0.1:5177', screenshotDir=null}={}) {
  let mode='normal', hold=false
  const pending=[], requests=[]
  const addDays=(date,n)=>{const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
  const decimal=n=>`${n/100n}.${String(n%100n).padStart(2,'0')}`
  const grossWeek=[600000n,90000n,0n,160000n,200000n,120000n], refundWeek=[50000n,0n,75025n,10000n,0n,25000n]
  function amounts(date, scope) {
    let gross=0n, refund=0n
    if(date==='2026-09-10') gross=scope==='b1'?6000000n:600000n
    if(date>='2026-10-02'&&date<='2026-10-25') gross=scope==='b1'?138750n:45000n
    if(date>='2026-10-26'&&date<='2026-10-31') {
      const index=Number(date.slice(-2))-26
      gross=scope==='b1'?grossWeek[index]:index===5?120000n:0n
      refund=scope==='b1'?refundWeek[index]:0n
    }
    return [gross,refund]
  }
  function report(from,to,scope,weekly) {
    const rows=[];let grossTotal=0n,refundTotal=0n,payments=0,refunds=0
    for(let date=from;date<=to;date=addDays(date,1)) {
      const parts=scope==='all'?[amounts(date,'b1'),amounts(date,'b2')]:[amounts(date,scope)]
      let gross=parts.reduce((s,p)=>s+p[0],0n),refund=parts.reduce((s,p)=>s+p[1],0n)
      if(mode==='zero'||(mode==='baseline'&&to<'2026-10-02')) {gross=0n;refund=0n}
      grossTotal+=gross;refundTotal+=refund
      const count=gross>0n?1:0,refCount=refund>0n?1:0
      payments+=count;refunds+=refCount
      const net=gross-refund
      rows.push({date,day_of_week:new Date(date+'T00:00:00Z').getUTCDay()||7,short_day:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date(date+'T00:00:00Z').getUTCDay()],
        gross_collected_php:decimal(gross),refunded_php:decimal(refund),net_cash_flow_php:net<0n?'-'+decimal(-net):decimal(net),payments_count:count,refunds_count:refCount})
    }
    const net=grossTotal-refundTotal
    return {timezone:'Asia/Manila',branch:scope==='all'?null:{public_id:scope==='b1'?'01j00000000000000000000b01':'01j00000000000000000000b02'},
      period_label:`${from} – ${to}`,week_label:`${from} – ${to}`,week_start_date:from,week_end_date:to,is_finalized:to<'2026-10-31',
      totals:{gross_collected_php:decimal(grossTotal),refunded_php:decimal(refundTotal),net_cash_flow_php:net<0n?'-'+decimal(-net):decimal(net),payments_count:payments,refunds_count:refunds},...(weekly?{buckets:rows}:{days:rows})}
  }
  await page.route('**/api/analytics/**',async route=>{
    const url=new URL(route.request().url());requests.push(url)
    const scope=url.searchParams.get('branch_id')?.endsWith('b01')?'b1':url.searchParams.get('branch_id')?.endsWith('b02')?'b2':'all'
    if(hold&&scope==='b1') await new Promise(resolve=>pending.push(resolve))
    if(mode==='error'||(mode==='prior-error'&&url.searchParams.get('date_to')==='2026-10-01')) return route.fulfill({status:503,json:{message:'Synthetic failure'}})
    if(mode==='loading') await new Promise(resolve=>setTimeout(resolve,300))
    if(url.pathname.endsWith('/branch-performance')) return route.fulfill({status:200,json:{data:[]}})
    const prior=url.searchParams.get('date_to')==='2026-10-01'
    if(url.pathname.endsWith('/executive-summary')) {
      let visits=scope==='b1'?(prior?80:120):scope==='b2'?(prior?40:20):(prior?120:140)
      if(mode==='zero'||(mode==='baseline'&&prior)) visits=0
      const outstanding=mode==='zero'?'0.00':scope==='b1'?'3200.50':scope==='b2'?'450.00':'3650.50'
      return route.fulfill({status:200,json:{data:{period:'custom',period_label:'Illustrative test period',branch:scope==='all'?null:{public_id:url.searchParams.get('branch_id')},
        financials:{outstanding_balance_php:outstanding,total_collected_php:'0.00',total_gross_php:'0.00',paid_invoices_count:0},
        patient_flow:{total_visits:visits,served_from_queue:0,current_waiting:0},scheduling:{total_appointments:0,completed:0,cancelled:0,completion_rate_pct:null},hmo:{approved:0,approved_amount_php:'0.00',pending:0},automation:{health_rate_pct:null,total_actions:0,failed:0}}}})
    }
    const weekly=url.pathname.endsWith('/weekly-histogram')
    let from=url.searchParams.get('date_from'),to=url.searchParams.get('date_to')
    if(weekly) {const reference=url.searchParams.get('date')||'2026-10-31';const day=new Date(reference+'T00:00:00Z').getUTCDay()||7;from=addDays(reference,1-day);to=addDays(from,5)}
    else if(!from) {to='2026-10-31';from=url.searchParams.get('period')==='this month'?'2026-10-01':to}
    return route.fulfill({status:200,json:{data:report(from,to,scope,weekly)}})
  })
  const results=[]
  for(const width of [1440,390]) {
    mode='loading'
    await page.setViewportSize({width,height:1000})
    await page.goto(`${base}/tests/fixtures/owner-analytics-a5.html`)
    await page.getByRole('status',{name:'Loading 30-day performance'}).waitFor()
    const overview=page.getByRole('region',{name:'Last 30 Days performance overview'})
    const gross=overview.getByRole('article',{name:'Gross Collections performance'})
    const visits=overview.getByRole('article',{name:'Patient Visits performance'})
    await gross.getByText('₱45,000.00',{exact:true}).waitFor()
    assert.ok((await gross.innerText()).includes('25.0%'))
    assert.equal(await gross.locator('.owner-growth').getAttribute('class'),'owner-growth is-down')
    assert.ok((await visits.innerText()).includes('50.0%'))
    assert.equal(await visits.locator('.owner-growth').getAttribute('class'),'owner-growth is-up')
    assert.equal(await overview.getByRole('article',{name:'Outstanding Balance scope'}).locator('.owner-growth').count(),0)
    assert.ok(requests.some(u=>u.searchParams.get('date_from')==='2026-10-02'&&u.searchParams.get('date_to')==='2026-10-31'&&u.searchParams.get('branch_id')?.endsWith('b01')))
    assert.ok(requests.some(u=>u.searchParams.get('date_from')==='2026-09-02'&&u.searchParams.get('date_to')==='2026-10-01'&&u.searchParams.get('branch_id')?.endsWith('b01')))
    mode='normal'
    await page.getByRole('combobox',{name:'Report period'}).selectOption('This Month')
    const weekly=page.getByRole('group',{name:'Monday–Saturday gross collections and net cash flow chart',exact:true})
    await weekly.waitFor()
    assert.equal(await weekly.locator('.owner-revenue-bar').count(),6)
    assert.equal(await weekly.locator('.owner-revenue-net-marker').count(),6)
    const zero=Number(await weekly.locator('.owner-revenue-zero').getAttribute('y1'))
    const wednesday=weekly.getByRole('button').nth(2)
    await wednesday.focus()
    const weeklyCard=page.locator('.owner-revenue-grid .card').last()
    await weeklyCard.getByRole('tooltip').waitFor()
    assert.ok((await weeklyCard.getByRole('tooltip').innerText()).includes('-₱750.25'))
    const marker=weekly.locator('.owner-revenue-net-marker').nth(2)
    assert.ok(Number(await marker.getAttribute('cy'))>zero,'negative net marker is below the shared zero baseline')
    const markerBox=await marker.boundingBox()
    await page.mouse.move(markerBox.x+markerBox.width/2,markerBox.y+markerBox.height/2)
    assert.ok((await weeklyCard.getByRole('tooltip').innerText()).includes('2026-10-28'))
    await wednesday.click()
    assert.equal(await weekly.locator('.owner-revenue-point.is-active').count(),1)
    await weeklyCard.locator('summary').click()
    assert.ok((await weeklyCard.locator('table').innerText()).includes('-₱750.25'))
    await weeklyCard.locator('summary').click()
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal page overflow')
    if(screenshotDir) {
      if(width===1440) {
        await overview.screenshot({path:screenshotDir+'/performance-comparison.png'})
        await weeklyCard.screenshot({path:screenshotDir+'/weekly-net-refund-tooltip.png'})
        await page.locator('.owner-revenue').screenshot({path:screenshotDir+'/desktop-overview.png'})
      } else await page.screenshot({path:screenshotDir+'/mobile-overview.png',fullPage:true})
    }
    // A different detailed report period must not silently redefine the labelled fixed overview.
    await page.getByRole('combobox',{name:'Report period'}).selectOption('All Time')
    assert.ok((await overview.innerText()).includes('Last 30 Days'))
    assert.ok((await gross.innerText()).includes('vs previous 30 days'))
    hold=true
    await page.getByRole('combobox',{name:'Acceptance branch'}).selectOption('All Branches')
    await page.getByRole('combobox',{name:'Acceptance branch'}).selectOption('Illustrative Branch 1')
    await page.waitForTimeout(100)
    assert.equal(await overview.locator('.owner-kpi-value strong').count(),0,'old scope KPI values are removed while loading')
    await page.getByRole('combobox',{name:'Acceptance branch'}).selectOption('Illustrative Branch 2')
    await gross.getByText('₱12,000.00',{exact:true}).waitFor()
    hold=false;pending.splice(0).forEach(resolve=>resolve())
    await page.waitForTimeout(100)
    assert.equal(await gross.locator('.owner-growth').getAttribute('class'),'owner-growth is-up')
    assert.equal(await visits.locator('.owner-growth').getAttribute('class'),'owner-growth is-down')
    assert.ok(!(await overview.locator('.owner-kpi-value').allTextContents()).join(' ').includes('₱45,000.00'))
    results.push(`Owner ${width}: exact KPI windows/scopes, growth/decline, outstanding no badge, signed combination chart, keyboard/marker/bar tooltip, table, stale responses, responsive layout`)
  }
  for(const scenario of ['baseline','zero','prior-error']) {
    mode=scenario
    await page.goto(`${base}/tests/fixtures/owner-analytics-a5.html`)
    if(scenario==='prior-error') {
      await page.getByText('Performance overview unavailable',{exact:true}).waitFor()
      assert.equal(await page.locator('.owner-performance .owner-kpi-value').count(),0)
      mode='normal';await page.getByRole('button',{name:'Retry overview'}).click()
      await page.locator('.owner-performance').getByText('₱45,000.00',{exact:true}).waitFor()
    } else {
      await page.locator('.owner-performance').getByText('No comparable baseline',{exact:false}).first().waitFor()
      assert.equal(await page.locator('.owner-growth.is-none').count(),2)
      assert.ok(!/Infinity|NaN/.test(await page.locator('.owner-performance').innerText()))
      if(screenshotDir&&scenario==='baseline') await page.locator('.owner-performance').screenshot({path:screenshotDir+'/no-comparable-baseline.png'})
      if(scenario==='zero') {
        await page.getByRole('group',{name:'Monday–Saturday gross collections and net cash flow chart',exact:true}).waitFor()
        assert.ok((await page.locator('.owner-revenue-net-line').getAttribute('d')).includes('L'))
      }
    }
  }
  results.push('Zero/prior-zero baselines, all-zero chart, prior-period failure and retry passed')
  return results
}
