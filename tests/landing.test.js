import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { hoursSummary, openStatus } from '../src/patient/format.js'

// Landing page: branch cards render the clinic's real branch data (from GET /api/public/branches), and "Open now / Closed" is
// computed in Asia/Manila whatever the visitor's own time zone.
const require = createRequire(import.meta.url)
const bundle = await build({ stdin: { contents: "export { BranchCard } from './src/pages/PublicSite.jsx'; export { directionsUrl, telHref } from './src/pages/public-data.js';", resolveDir: process.cwd() }, bundle: true, write: false, loader: { '.css': 'empty' }, platform: 'node', format: 'esm',
  plugins: [{ name: 'react', setup(b) { b.onResolve({ filter: /^react$/ }, () => ({ path: pathToFileURL(require.resolve('react')).href, external: true })) } }] })
const ui = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'))

const WEEK = { 1: { open: '08:00', close: '20:00' }, 2: { open: '08:00', close: '20:00' }, 3: { open: '08:00', close: '20:00' }, 4: { open: '08:00', close: '20:00' }, 5: { open: '08:00', close: '20:00' }, 6: { open: '08:00', close: '17:00' }, 7: null }
const manila = local => new Date(`${local}+08:00`)

test('hours summary groups the clinic days: weekdays, Saturday, Sunday closed', () => {
  assert.equal(hoursSummary(WEEK), 'Mon–Fri 8:00 AM – 8:00 PM · Sat 8:00 AM – 5:00 PM · Sun closed')
  assert.equal(hoursSummary(null), '')
})

test('open now / closed is computed in Asia/Manila across every boundary', () => {
  const cases = [
    ['2026-10-18T10:00', false, 'Closed · opens tomorrow 8:00 AM'], // Sunday
    ['2026-10-19T07:59', false, 'Closed · opens today 8:00 AM'], // Monday before opening
    ['2026-10-19T08:00', true, 'Open now · until 8:00 PM'],
    ['2026-10-19T19:59', true, 'Open now · until 8:00 PM'],
    ['2026-10-19T20:00', false, 'Closed · opens tomorrow 8:00 AM'],
    ['2026-10-24T16:59', true, 'Open now · until 5:00 PM'], // Saturday
    ['2026-10-24T17:00', false, 'Closed · opens Mon 8:00 AM'], // Saturday evening: Sunday is closed
  ]
  for (const [local, open, label] of cases) assert.deepEqual([openStatus(WEEK, manila(local)).open, openStatus(WEEK, manila(local)).label], [open, label], local)
  // 23:30 UTC on Sunday is already Monday 7:30 AM in Manila.
  assert.equal(openStatus(WEEK, new Date('2026-10-18T23:30:00Z')).label, 'Closed · opens today 8:00 AM')
})

test('a branch card shows the real name, address, tap-to-call phone, email only when present, hours and directions', () => {
  const b3 = { id: 'b3', number: '03', name: 'Roxas Dental Clinic Guiguinto', address: 'Unit 20 GD Plaza, Guiguinto, Bulacan', phone: '0933 867 8725', email: null, latitude: 14.8284409, longitude: 120.8745988, weeklyHours: WEEK }
  const html = renderToStaticMarkup(React.createElement(ui.BranchCard, { branch: b3, now: manila('2026-10-19T09:00') }))
  assert.match(html, /Roxas Dental Clinic Guiguinto/)
  assert.match(html, /Unit 20 GD Plaza, Guiguinto, Bulacan/, 'the incomplete address is shown as given')
  assert.match(html, /href="tel:\+639338678725"/)
  assert.doesNotMatch(html, /mailto:/, 'no email row when the branch has no email')
  assert.match(html, /Open now · until 8:00 PM/)
  assert.match(html, /Mon–Fri 8:00 AM – 8:00 PM · Sat 8:00 AM – 5:00 PM · Sun closed/)
  assert.match(html, /google\.com\/maps\/dir\/\?api=1&amp;destination=14\.8284409%2C120\.8745988/)
  const b1 = { ...b3, id: 'b1', number: '01', name: 'Dr. Dana Roxas Dental Clinic', address: '#37, MacArthur Hwy, Bocaue, 3018 Bulacan', phone: '0922 878 7341', email: 'danaroxas.dentalclinic@gmail.com', latitude: null, longitude: null }
  const one = renderToStaticMarkup(React.createElement(ui.BranchCard, { branch: b1, now: manila('2026-10-18T09:00') }))
  assert.match(one, /href="mailto:danaroxas\.dentalclinic@gmail\.com"/)
  assert.match(one, /Closed · opens tomorrow 8:00 AM/)
  assert.ok(ui.directionsUrl(b1).endsWith(encodeURIComponent('#37, MacArthur Hwy, Bocaue, 3018 Bulacan')), 'without coordinates the address is used')
})
