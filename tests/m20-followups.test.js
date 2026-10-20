import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { INITIAL_FOLLOWUPS } from '../src/data.js'

const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('M20: follow-ups come from the clinic server; the browser mock pages and seed are gone', () => {
  assert.deepEqual(INITIAL_FOLLOWUPS, [])
  assert.doesNotMatch(read('src/pages/Clinical.jsx'), /export function FollowupsPage/)
  assert.doesNotMatch(read('src/pages/PatientVisits.jsx'), /export function PatientFollowupsPage/)
  assert.match(read('src/App.jsx'), /import\('\.\/pages\/ServerFollowups\.jsx'\)/)
})

test('M20: book from the task with the normal booking form, close needs a note, the Owner sees counts only', () => {
  const page = read('src/pages/ServerFollowups.jsx'), form = read('src/pages/Scheduling.jsx')
  assert.match(page, /prefill=\{\{ patientPublicId: t\.patient\.id, patientName: .*branchId: t\.branch\.id, serviceId: t\.service\?\.id \|\| '', date: t\.due_on \}\}/)
  assert.match(form, /if\(prefill\)return \{patientPublicId:prefill\.patientPublicId,branchId:prefill\.branchId,serviceId:prefill\.serviceId/)
  assert.match(page, /Why is it closed without a booking\?/)
  assert.match(page, /owner \? `Due \$\{day\(t\.due_on\)\}`/) // no patient or reason for the Owner
  assert.match(read('src/pages/Clinical.jsx'), /<FollowupPanel patientId=\{patient\.id\}/)
})

test('M20: the optional reminder sits under Reports on the Automations page', () => {
  assert.match(read('src/pages/Automations.jsx'), /\['Reports', \['owner_summary', 'recall', 'followup_reminders'\]\]/)
})
