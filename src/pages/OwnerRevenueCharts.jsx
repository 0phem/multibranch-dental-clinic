import React, { useEffect, useId, useState } from 'react'
import { Button, Card, Field, Notice } from '../components.jsx'
import { fetchDailyRevenue, fetchWeeklyRevenueHistogram } from '../analytics-api.js'
import { clinicDate, validDate } from '../clock.js'
import { exactPeso, pesoCentavos, validateRevenueReport, weeklyChartAvailable } from '../owner-revenue-data.js'
import '../owner-revenue.css'

function MoneySummary({ amounts }) {
  return <dl className="owner-revenue-totals">
    <div><dt>Gross collections</dt><dd>{exactPeso(amounts.gross_collected_php)}</dd></div>
    <div><dt>Refunds</dt><dd>{exactPeso(amounts.refunded_php)}</dd></div>
    <div><dt>Net cash flow</dt><dd>{exactPeso(amounts.net_cash_flow_php)}</dd></div>
  </dl>
}

/** Shared SVG presentation follows the existing dashboard chart pattern; money never uses float arithmetic. */
export function RevenuePlot({ data, weekly = false }) {
  const rows = weekly ? data.buckets : data.days
  const [active, setActive] = useState(null)
  const tooltipId = useId()
  const maximum = rows.reduce((max, row) => { const amount = pesoCentavos(row.gross_collected_php); return amount > max ? amount : max }, 100n)
  // Number conversion is used only for pixel geometry, never for financial totals or displayed amounts.
  const points = rows.map((row, i) => ({ row, x: weekly ? 108 + i * 90 : rows.length === 1 ? 320 : 68 + i * 504 / (rows.length - 1),
    y: 190 - Number(pesoCentavos(row.gross_collected_php)) / Number(maximum) * 150 }))
  const point = active === null ? null : points[active]
  const description = row => `${row.date}. Gross collections ${exactPeso(row.gross_collected_php)}. Refunds ${exactPeso(row.refunded_php)}. Net cash flow ${exactPeso(row.net_cash_flow_php)}.`
  const label = weekly ? 'Monday–Saturday gross collections histogram' : 'Daily gross collections line chart'
  return <>
    <MoneySummary amounts={data.totals}/>
    <p className="muted-copy">The chart plots gross collections, not profit. Refunds and net cash flow are shown below and in each tooltip. Dates use Asia/Manila.</p>
    <svg viewBox="0 0 620 232" role="group" aria-label={label} className="owner-revenue-plot">
      <title>{label}</title>
      {[0, 1, 2].map(i => {
        const cents = maximum * BigInt(i) / 2n
        const amount = `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`
        return <g key={i}><line x1="68" x2="580" y1={190 - i * 75} y2={190 - i * 75}/><text x="62" y={194 - i * 75} textAnchor="end">{exactPeso(amount)}</text></g>
      })}
      {!weekly && <path d={points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')} className="owner-revenue-line"/>}
      {points.map((p, i) => <g key={p.row.date} role="button" tabIndex={0} aria-label={description(p.row)}
        aria-describedby={active === i ? tooltipId : undefined} className="owner-revenue-point"
        onMouseEnter={() => setActive(i)} onFocus={() => setActive(i)} onClick={() => setActive(i)}
        onKeyDown={e => { if (e.key === 'Escape') setActive(null); if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) } }}>
        <title>{description(p.row)}</title>
        {weekly ? <><rect x={p.x - 23} y="30" width="46" height="160" className="owner-revenue-hit"/><rect x={p.x - 23} y={p.y} width="46" height={190 - p.y} rx="3"/></> : <>
          <circle cx={p.x} cy={p.y} r="14" className="owner-revenue-hit"/><circle cx={p.x} cy={p.y} r="5"/>
        </>}
        {(weekly || i === 0 || i === rows.length - 1 || i % Math.max(1, Math.ceil(rows.length / 5)) === 0) && <text x={p.x} y="215" textAnchor="middle">{weekly ? p.row.short_day : p.row.date.slice(5)}</text>}
      </g>)}
    </svg>
    {point ? <div id={tooltipId} role="tooltip" className="owner-revenue-tooltip"><b>{point.row.date}</b><MoneySummary amounts={point.row}/></div>
      : <p className="muted-copy">Hover, tap or keyboard-focus a point or bar for the exact date and peso amounts.</p>}
    <details className="owner-revenue-table"><summary>Exact amounts by date</summary><div>
      <table><caption>{weekly ? 'Monday–Saturday' : 'Daily'} collections and refunds in Philippine pesos</caption>
        <thead><tr><th scope="col">Date</th><th scope="col">Gross collections</th><th scope="col">Refunds</th><th scope="col">Net cash flow</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{exactPeso(row.gross_collected_php)}</td><td>{exactPeso(row.refunded_php)}</td><td>{exactPeso(row.net_cash_flow_php)}</td></tr>)}</tbody>
      </table></div></details>
  </>
}

function RevenueReport({ weekly = false, params, today }) {
  const [result, setResult] = useState({ loading: true })
  const [retry, setRetry] = useState(0)
  const [preview, setPreview] = useState(false)
  useEffect(() => {
    let active = true
    setResult({ loading: true })
    const fetcher = weekly ? fetchWeeklyRevenueHistogram : fetchDailyRevenue
    fetcher(params).then(value => {
      const data = validateRevenueReport(value, weekly)
      if (params.branch_id && !data.branch) throw new Error('Selected branch figures are unavailable.')
      if (params.branch_id && /^[0-9a-z]{26}$/i.test(params.branch_id) && data.branch.public_id?.toLowerCase() !== params.branch_id.toLowerCase()) throw new Error('Branch response mismatch.')
      if (!params.branch_id && data.branch) throw new Error('Branch response mismatch.')
      if (active) setResult({ data })
    }).catch(() => { if (active) setResult({ error: true }) })
    return () => { active = false }
  }, [retry]) // The parent keys each resource by every request filter, including branch and period/date.
  const { data } = result
  const available = !weekly || !data || weeklyChartAvailable(data, today, preview)
  const empty = data && data.totals.payments_count === 0 && data.totals.refunds_count === 0
  return <Card title={weekly ? 'Monday–Saturday revenue summary' : 'Daily revenue'}
    subtitle={data ? (weekly ? data.week_label : data.period_label) : 'Collections and refunds from the clinic server'}>
    {result.loading && <p role="status" aria-busy="true">Loading {weekly ? 'weekly' : 'daily'} revenue…</p>}
    {result.error && <Notice tone="warning" title="Revenue unavailable">No figures are shown. <Button size="sm" onClick={() => setRetry(n => n + 1)}>Retry revenue</Button></Notice>}
    {data && weekly && <p className="owner-revenue-week-status" role="status">{data.is_finalized ? 'Week finalized — Saturday has passed.' : data.week_end_date === today ? 'Saturday summary — in progress until the reporting day ends.' : 'In progress — not finalized.'}</p>}
    {data && !available && <Notice>Saturday summary is available on {data.week_end_date}. <Button size="sm" variant="soft" onClick={() => setPreview(true)}>Preview in-progress week</Button></Notice>}
    {data && available && <>
      {empty && <Notice title="No payments or refunds">No transactions were recorded for this reporting window.</Notice>}
      <RevenuePlot data={data} weekly={weekly}/>
    </>}
  </Card>
}

export function OwnerRevenueCharts({ branchId, branchName, period, serverSession, validBranch = true }) {
  const today = clinicDate()
  const [weekDate, setWeekDate] = useState(today)
  if (!serverSession) return <Notice>Sign in with an Owner account to load revenue from payment and refund records.</Notice>
  if (!validBranch) return <Notice tone="warning">Select an available branch to view revenue.</Notice>
  const validWeek = validDate(weekDate) && weekDate <= today
  return <section className="owner-revenue" aria-label={`Revenue analytics: ${branchName || 'All Branches'}`}>
    <p className="muted-copy">Daily revenue follows the report period. The weekly summary uses its own Monday–Saturday date selection and the same branch filter; Sunday is excluded.</p>
    <p className="muted-copy">Charts use payment and refund dates. Paid-invoice KPIs below use invoice creation dates and may differ.</p>
    <div className="owner-revenue-grid">
      <RevenueReport key={`daily:${branchId || 'all'}:${period}`} params={{ period: period.toLowerCase(), branch_id: branchId }} today={today}/>
      <div><Field label="Week containing date"><input type="date" aria-label="Week containing date" value={weekDate} max={today} onChange={e => setWeekDate(e.target.value)}/></Field>
        {validWeek ? <RevenueReport key={`weekly:${branchId || 'all'}:${weekDate}`} weekly params={{ date: weekDate, branch_id: branchId }} today={today}/>
          : <Notice tone="warning">Choose a valid date no later than today.</Notice>}
      </div>
    </div>
  </section>
}
