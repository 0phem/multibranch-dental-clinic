import test from 'node:test'
import assert from 'node:assert/strict'
import { last30DayWindows, performanceChange, revenueGeometry, validateRevenueScope } from '../src/owner-revenue-data.js'

test('Last 30 Days uses adjacent equal calendar windows including today across month/year/leap boundaries', () => {
  for (const today of ['2026-10-29','2026-01-01','2024-03-01','2026-03-01']) {
    const {current,previous}=last30DayWindows(today)
    const span=window=>(Date.parse(window.date_to)-Date.parse(window.date_from))/86400000+1
    assert.equal(span(current),30); assert.equal(span(previous),30)
    assert.equal(current.date_to,today)
    assert.equal(Date.parse(current.date_from)-Date.parse(previous.date_to),86400000)
  }
  assert.deepEqual(last30DayWindows('2026-10-29'),{current:{date_from:'2026-09-30',date_to:'2026-10-29'},previous:{date_from:'2026-08-31',date_to:'2026-09-29'}})
})

test('exact comparisons distinguish increases, decreases, no change and absent baselines', () => {
  assert.deepEqual(performanceChange(4500000n,6000000n),{direction:'down',text:'25.0%'})
  assert.deepEqual(performanceChange(120n,80n),{direction:'up',text:'50.0%'})
  assert.deepEqual(performanceChange(10n,10n),{direction:'flat',text:'0.0%'})
  assert.deepEqual(performanceChange(0n,10n),{direction:'down',text:'100.0%'})
  for(const previous of [0n,-1n,null]) assert.equal(performanceChange(100n,previous).direction,'none')
  assert.equal(performanceChange(0n,0n).text,'No comparable baseline')
  assert.deepEqual(performanceChange(1000001n,1000000n),{direction:'up',text:'<0.1%'})
  assert.equal(performanceChange(9007199254740994n,9007199254740993n).text,'<0.1%')
})

test('weekly combination uses shared dates and a signed peso scale with a real zero baseline', () => {
  const rows=[{date:'2026-10-26',gross_collected_php:'6000.00',net_cash_flow_php:'5500.00'},
    {date:'2026-10-27',gross_collected_php:'0.00',net_cash_flow_php:'-750.25'},
    {date:'2026-10-28',gross_collected_php:'0.00',net_cash_flow_php:'0.00'}]
  const chart=revenueGeometry(rows,true)
  assert.equal(chart.minimum,-75025n)
  assert.equal(chart.maximum,600000n)
  assert.ok(chart.points[1].netY>chart.zeroY)
  assert.equal(chart.points[1].y,chart.zeroY)
  assert.equal(chart.points[2].netY,chart.zeroY)
  assert.ok(chart.points[0].netY<chart.zeroY)
  assert.deepEqual(chart.points.map(p=>p.row.date),rows.map(r=>r.date))
  assert.ok(chart.ticks.some(t=>t.cents===0n&&t.y===chart.zeroY))
})

test('zero-only chart remains finite and has zero-height collection bars', () => {
  const chart=revenueGeometry([{gross_collected_php:'0.00',net_cash_flow_php:'0.00'}],true)
  assert.ok(Number.isFinite(chart.zeroY))
  assert.equal(chart.points[0].y,chart.zeroY)
  assert.equal(chart.points[0].netY,chart.zeroY)
})

test('branch response scope cannot widen or substitute another branch', () => {
  const id='01j00000000000000000000b01'
  assert.equal(validateRevenueScope({branch:null},null).branch,null)
  assert.throws(()=>validateRevenueScope({branch:null},id))
  assert.throws(()=>validateRevenueScope({branch:{public_id:'01j00000000000000000000b02'}},id))
  assert.throws(()=>validateRevenueScope({branch:{public_id:id}},null))
})
