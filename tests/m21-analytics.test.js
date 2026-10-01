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
