import test from 'node:test'
import assert from 'node:assert/strict'
import { MODULES } from '../src/data.js'
import * as analyticsApi from '../src/analytics-api.js'

test('Module 21 metadata is marked implemented with backend authority note', () => {
  const m21 = MODULES.find(m => m.no === 21)
  assert.ok(m21, 'Module 21 must exist in MODULES registry')
  assert.equal(m21.implemented, true)
  assert.equal(m21.coverage, 'implemented')
  assert.ok(m21.coverageNote.includes('executive summary'))
  assert.deepEqual(m21.roles, ['owner'])
})

test('analytics-api exports all required communication functions', () => {
  assert.equal(typeof analyticsApi.fetchExecutiveSummary, 'function')
  assert.equal(typeof analyticsApi.fetchBranchPerformance, 'function')
  assert.equal(typeof analyticsApi.downloadAnalyticsCsv, 'function')
})

import { readFileSync } from 'node:fs'

const adminSource = readFileSync(new URL('../src/pages/Admin.jsx', import.meta.url), 'utf8')
const analyticsPage = adminSource.slice(adminSource.indexOf('export function AnalyticsPage'), adminSource.indexOf('export function UsersPage'))

test('M21 page sends a public branch reference and never an internal number', () => {
  assert.match(analyticsPage, /activeBranchRecord\?\.publicId \|\| activeBranchRecord\?\.id/)
  assert.ok(!analyticsPage.includes('b.branch_id'), 'analytics rows are keyed by public_id, never an internal branch_id')
  assert.match(analyticsPage, /key=\{b\.public_id \|\| b\.id\}/)
  assert.match(analyticsPage, /fetchBranchPerformance\(\{ period: p, branch_id: activeBranchId \}\)/)
})

test('M21 server session never falls back to local demo metrics and shows an explicit unavailable state', () => {
  assert.match(analyticsPage, /isServerSession \? \[\] : clientMetrics/)
  assert.match(analyticsPage, /setServerSummary\(null\)/)
  assert.match(analyticsPage, /Analytics are unavailable right now/)
  assert.match(analyticsPage, /Try again/)
})

test('M21 shows "No data" for null rates and an unconfigured wait estimate, never a fabricated 100%', () => {
  assert.match(analyticsPage, /v === null \|\| v === undefined \? 'No data'/)
  assert.ok(!/health_rate_pct\}%/.test(analyticsPage), 'health rate is formatted through rateText')
  assert.ok(!/completion_rate_pct\}%/.test(analyticsPage), 'completion rate is formatted through rateText')
  assert.match(analyticsPage, /wait estimate not configured/)
})

test('M21 labels the revenue metric as it is calculated (paid invoices created in the period)', () => {
  assert.match(analyticsPage, /Paid invoices created in this period/)
  assert.ok(!analyticsPage.includes('Real collections from'))
})

test('M21 shows no workload percentage in a server session and labels the offline preview', () => {
  assert.match(analyticsPage, /const workload = isServer \? null : branchCapacity/)
  assert.match(analyticsPage, /Capacity not configured/)
  assert.match(analyticsPage, /workload !== null && <Progress/)
  assert.ok(!analyticsPage.includes('capacity_threshold || 80'), 'no invented 80 fallback denominator')
  assert.match(analyticsPage, /Offline demo preview — example capacity values, not clinic data/)
})
