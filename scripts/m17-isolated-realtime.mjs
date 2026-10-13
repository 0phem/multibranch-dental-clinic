// ISOLATED INTEGRATION for M17 Priority 2 (not the clinic database, not fixtures): a real API on `dental_clinic_m17_isolated`, a real
// Laravel Reverb server and a real browser with three people: a Patient, a Branch A Staff member and a Branch B Staff member.
// Checks: live delivery both ways without reloading, Branch B can neither list, read nor subscribe, the database holds no plain text,
// and when the socket stops the screens say so and keep working by polling.
// Setup (see docs/M17_REALTIME_MESSAGING.md): createdb dental_clinic_m17_isolated; migrate + db:seed with DB_DATABASE set; move
// staff.assistant@example.test's branch scope to Branch B in that database; then
//   php artisan reverb:start                                   (backend/, uses REVERB_* from backend/.env)
//   cd backend/public && DB_DATABASE=dental_clinic_m17_isolated FRONTEND_URL=http://localhost:5190 SANCTUM_STATEFUL_DOMAINS=localhost:5190 \
//     QUEUE_CONNECTION=sync MAIL_MAILER=log BROADCAST_CONNECTION=reverb php -S localhost:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
//   VITE_API_BASE_URL=http://localhost:8001 npx vite build --outDir <dir>; npx vite preview --outDir <dir> --port 5190
// Usage: PLAYWRIGHT_MODULE=<playwright/index.mjs> node scripts/m17-isolated-realtime.mjs [screenshot dir]
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const web = process.env.QA_WEB || 'http://localhost:5190', api = process.env.QA_API || 'http://localhost:8001'
const shots = process.argv[2] || null
const DB = 'dental_clinic_m17_isolated'
const sql = q => execFileSync('psql', ['-d', DB, '-Atc', q]).toString().trim()
const seeder = await readFile(new URL('../backend/database/seeders/DemoAccountsSeeder.php', import.meta.url), 'utf8')
const demoPassword = seeder.match(/env\('DEMO_ACCOUNT_PASSWORD',\s*'([^']+)'\)/)[1]
let checks = 0
const check = (ok, m) => { assert.ok(ok, m); checks++; console.log(`  ✓ ${m}`) }
const stamp = Date.now().toString(36)
const browser = await chromium.launch({ channel: 'chrome' })

async function signIn(page, email) {
  await page.goto(`${web}/#sign-in`); await page.getByLabel('Email').fill(email); await page.locator('input[type=password]').first().fill(demoPassword)
  await page.getByRole('button', { name: 'Sign in' }).click(); await page.locator('.workspace-label').waitFor({ timeout: 20000 })
}
async function openMessages(page, patient) {
  if (patient) { await page.getByRole('button', { name: /^Menu/ }).click(); await page.getByRole('dialog').getByRole('button', { name: /^Messages/ }).click() }
  else {
    if (!await page.getByRole('button', { name: 'Messages', exact: true }).filter({ visible: true }).count()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
    await page.getByRole('button', { name: 'Messages', exact: true }).filter({ visible: true }).first().click()
  }
  await page.getByRole('heading', { name: 'Messages', level: 1 }).waitFor()
}
const chip = page => page.locator('.chat-live')

try {
  check(sql('select current_database()') === DB, 'psql targets the isolated database')
  const patient = await (await browser.newContext({ viewport: { width: 375, height: 812 } })).newPage()
  const staffA = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const staffB = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(patient, 'patient@example.test'); await signIn(staffA, 'staff.reception@example.test'); await signIn(staffB, 'staff.assistant@example.test')
  const probe = await staffA.evaluate(async api => (await fetch(`${api}/api/conversations`, { credentials: 'include', headers: { Accept: 'application/json' } })).status, api)
  check(probe === 200, 'the API under test answers for the isolated database session')
  await openMessages(patient, true); await openMessages(staffA, false); await openMessages(staffB, false)
  for (const [name, page] of [['Patient', patient], ['Branch A Staff', staffA], ['Branch B Staff', staffB]]) {
    await chip(page).filter({ hasText: 'Live' }).waitFor({ timeout: 15000 })
    check(true, `${name}: the status chip shows Live (socket connected)`)
  }

  // ---- the Patient starts a conversation with the Branch A front desk ----
  const first = `Hello front desk ${stamp}`
  await patient.getByRole('button', { name: 'New message' }).click()
  await patient.getByRole('combobox', { name: /^Branch/ }).selectOption({ label: 'Branch A' })
  await patient.getByRole('textbox', { name: /^Message/ }).fill(first)
  await patient.getByRole('button', { name: 'Send', exact: true }).click()
  await patient.locator('.chat-bubble.mine p', { hasText: first }).waitFor({ timeout: 10000 })
  check(true, 'the Patient sees their first message in the new conversation')

  // Live (well under the 60 s safety poll): Branch A sees the new conversation without reloading.
  const t0 = Date.now()
  const row = staffA.locator('.chat-row', { hasText: 'Not answered yet' }).first()
  await row.waitFor({ timeout: 8000 })
  check(Date.now() - t0 < 8000, `Branch A Staff sees the new conversation live (${Date.now() - t0} ms, no reload)`)
  await row.click()
  await staffA.locator('.chat-bubble p', { hasText: first }).waitFor()
  const reply = `Hi, Branch A front desk here ${stamp}`
  await staffA.getByRole('textbox', { name: /Message to/ }).fill(reply)
  await staffA.getByRole('button', { name: 'Send', exact: true }).click()
  const t1 = Date.now()
  await patient.locator('.chat-bubble p', { hasText: reply }).waitFor({ timeout: 8000 })
  check(true, `the Patient receives the reply live (${Date.now() - t1} ms, no reload)`)
  await staffA.getByText('Handled by you').first().waitFor()
  check(true, 'the first reply makes Branch A Staff the participant of record ("Handled by you")')
  if (shots) { await patient.screenshot({ path: `${shots}/m17-patient-375.png` }); await staffA.screenshot({ path: `${shots}/m17-staff-1440.png` }) }

  // ---- Branch B must not see it, read it or subscribe to it ----
  const conversationId = sql(`select public_id from conversations where context = 'Message to the front desk' order by id desc limit 1`)
  await staffB.waitForTimeout(1500)
  check(await staffB.locator('.chat-row').count() === 0, 'Branch B Staff lists no conversation')
  const denied = await staffB.evaluate(async ({ api, id }) => {
    const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '')
    const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf }
    const read = await fetch(`${api}/api/conversations/${id}/messages`, { credentials: 'include', headers })
    const sub = await fetch(`${api}/api/broadcasting/auth`, { method: 'POST', credentials: 'include', headers, body: JSON.stringify({ socket_id: '1234.5678', channel_name: `private-conversation.${id}` }) })
    return [read.status, sub.status]
  }, { api, id: conversationId })
  check(denied[0] === 403, 'Branch B Staff is refused the messages over HTTP (403)')
  check(denied[1] === 403, 'Branch B Staff is refused the websocket channel (403)')

  // ---- encrypted at rest; no email alert while the Patient is in the app ----
  check(sql(`select count(*) from conversation_messages where body is not null`) === '0', 'no message is stored in the plain body column')
  check(sql(`select count(*) from conversation_messages where body_encrypted like '%${stamp}%'`) === '0', 'the encrypted column never contains the text')
  check(sql(`select count(*) from mail_dispatches where purpose = 'message_alert'`) === '0', 'no offline alert while the Patient is in the app (heartbeat)')

  // ---- the socket stops: the screens say so and keep working by polling ----
  execFileSync('pkill', ['-f', 'artisan reverb:start'])
  await chip(staffA).filter({ hasText: 'Reconnecting' }).waitFor({ timeout: 20000 })
  check(true, 'Staff sees "Reconnecting — checking every 10 s" when the socket drops')
  const polled = `Sent while the socket is down ${stamp}`
  await patient.getByRole('textbox', { name: /Message to/ }).fill(polled)
  await patient.getByRole('button', { name: 'Send', exact: true }).click()
  const t2 = Date.now()
  await staffA.locator('.chat-bubble p', { hasText: polled }).waitFor({ timeout: 25000 })
  check(true, `the polling fallback delivers it to Staff (${Date.now() - t2} ms)`)
  console.log(`\n${checks} checks passed`)
} finally {
  await browser.close()
}
