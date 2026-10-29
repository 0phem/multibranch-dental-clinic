import { validDate } from './clock.js'

export const REVENUE_FIELDS = ['gross_collected_php', 'refunded_php', 'net_cash_flow_php']

export function pesoCentavos(value) {
  if (typeof value !== 'string' || !/^-?\d+\.\d{2}$/.test(value)) throw new Error('Invalid revenue amount.')
  const negative = value.startsWith('-')
  const [whole, fraction] = value.replace('-', '').split('.')
  const amount = BigInt(whole) * 100n + BigInt(fraction)
  return negative ? -amount : amount
}

export function exactPeso(value) {
  const amount = pesoCentavos(value)
  const abs = amount < 0n ? -amount : amount
  return `${amount < 0n ? '-' : ''}₱${String(abs / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(abs % 100n).padStart(2, '0')}`
}

/** Validate the existing API projection; malformed/mismatched money is unavailable, never zero. */
export function validateRevenueReport(data, weekly = false) {
  const rows = weekly ? data?.buckets : data?.days
  if (data?.timezone !== 'Asia/Manila' || !Array.isArray(rows) || !data.totals) throw new Error('Revenue figures are unavailable.')
  if (weekly && (rows.length !== 6 || typeof data.is_finalized !== 'boolean' || !validDate(data.week_start_date) || !validDate(data.week_end_date))) throw new Error('Weekly figures are unavailable.')
  const totals = [0n, 0n, 0n]
  const counts = [0, 0]
  let previous = ''
  for (const [index, row] of rows.entries()) {
    if (!validDate(row.date) || row.date <= previous || (weekly && (row.day_of_week !== index + 1 || new Date(`${row.date}T00:00:00Z`).getUTCDay() !== index + 1))) throw new Error('Invalid revenue dates.')
    previous = row.date
    const values = REVENUE_FIELDS.map(field => pesoCentavos(row[field]))
    if (values[0] < 0n || values[1] < 0n || values[0] - values[1] !== values[2]) throw new Error('Revenue amounts do not reconcile.')
    values.forEach((value, i) => { totals[i] += value })
    for (const [i, field] of ['payments_count', 'refunds_count'].entries()) {
      if (!Number.isSafeInteger(row[field]) || row[field] < 0) throw new Error('Invalid transaction count.')
      counts[i] += row[field]
    }
  }
  if (weekly && (rows[0].date !== data.week_start_date || rows[5].date !== data.week_end_date)) throw new Error('Invalid weekly date range.')
  REVENUE_FIELDS.forEach((field, i) => { if (pesoCentavos(data.totals[field]) !== totals[i]) throw new Error('Revenue totals do not reconcile.') })
  if (data.totals.payments_count !== counts[0] || data.totals.refunds_count !== counts[1]) throw new Error('Revenue counts do not reconcile.')
  return data
}

export function weeklyChartAvailable(data, today, preview = false) {
  return data.is_finalized || data.week_end_date <= today || preview
}
