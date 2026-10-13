// ISOLATED INTEGRATION (not the clinic database, not fixtures): a real Laravel API on a separate, freshly migrated and seeded
// database (`dental_clinic_isolated`) plus a real browser. Checks M1 invite -> accept -> sign in -> branch access end to end,
// and M18 durable email intents processed by a real queue worker. Reads the invitation link from the local mail LOG (the
// mailer is `log`, so nothing leaves the machine) and never prints it or any password.
// Setup (documented in docs/M18_EMAIL_DISPATCH.md): createdb dental_clinic_isolated; DB_DATABASE=dental_clinic_isolated php artisan
// migrate --force && php artisan db:seed --force; serve the API on :8001 with PHP's built-in server and the env overrides
// (`php artisan serve` does NOT pass DB_DATABASE etc. to its child process, so it would silently use the clinic database):
//   cd backend/public && DB_DATABASE=dental_clinic_isolated FRONTEND_URL=http://localhost:5190 SANCTUM_STATEFUL_DOMAINS=localhost:5190 \
//   QUEUE_CONNECTION=database MAIL_MAILER=log php -S localhost:8001 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
// and a build made with VITE_API_BASE_URL=http://localhost:8001 on :5190 (vite preview --outDir <dir> --port 5190).
// The script refuses to continue unless the API answers from the isolated database.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const web = process.env.QA_WEB || 'http://localhost:5190', api = process.env.QA_API || 'http://localhost:8001'
const backend = new URL('../backend/', import.meta.url).pathname
const isolatedEnv = { ...process.env, DB_DATABASE: 'dental_clinic_isolated', QUEUE_CONNECTION: 'database', MAIL_MAILER: 'log' }
const sql = q => execFileSync('psql', ['-d', 'dental_clinic_isolated', '-Atc', q]).toString().trim()
const seeder = await readFile(new URL('../backend/database/seeders/DemoAccountsSeeder.php', import.meta.url), 'utf8')
const demoPassword = seeder.match(/env\('DEMO_ACCOUNT_PASSWORD',\s*'([^']+)'\)/)[1]
let checks = 0; const results = []
const check = (ok, m) => { results.push(m); assert.ok(ok, m); checks++ }
const stamp = Date.now(), inviteEmail = `iso.staff.${stamp}@example.test`, newPassword = `Iso${stamp}pw`
const browser = await chromium.launch({ channel: 'chrome' })
async function signIn(page, email, password) {
  await page.goto(`${web}/#sign-in`); await page.getByLabel('Email').fill(email); await page.locator('input[type=password]').first().fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click(); await page.locator('.workspace-label').waitFor({ timeout: 20000 })
}
const nav = async (page, label) => {
  if (!await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).count()) await page.getByRole('button', { name: 'Open navigation', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first().click()
}
try {
  check(sql("select current_database()") === 'dental_clinic_isolated', 'psql targets the isolated database')
  // ---- Owner invites a Staff member ----
  const owner = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(owner, 'owner@example.test', demoPassword)
  const probe = await owner.evaluate(async api => (await (await fetch(`${api}/api/appointments?date=2026-10-01`, { credentials: 'include', headers: { Accept: 'application/json' } })).json()).meta.total, api)
  check(probe === 0, 'the API under test is the isolated database (no clinic appointment on 2026-10-01)')
  await nav(owner, 'User Management'); await owner.getByRole('heading', { name: 'Invite an employee' }).waitFor()
  const card = owner.locator('section.card', { has: owner.getByRole('heading', { name: 'Invite an employee' }) })
  await card.getByLabel('Email').fill(inviteEmail); await card.getByLabel('First name').fill('Iso'); await card.getByLabel('Last name').fill('Staff')
  await card.getByLabel('Job title').fill('Receptionist'); await card.getByLabel('Branch').selectOption('b1')
  await card.getByLabel('Shift starts').fill('09:00'); await card.getByLabel('Shift ends').fill('17:00')
  await card.getByRole('button', { name: 'Send invitation' }).click()
  await owner.getByText('Invitation not emailed').waitFor()
  check(sql(`select account_status from users where email='${inviteEmail}'`) === 'Invited', 'the invited account is stored as Invited')
  check(sql(`select status||'/'||retryable from mail_dispatches where purpose='employee_invitation' order by id desc limit 1`) === 'logged_only/false', 'the invitation send is recorded durably as logged_only and not retryable')
  // ---- the invited person opens the link from the local mail log and sets a password ----
  const logText = await readFile(`${backend}storage/logs/laravel.log`, 'utf8')
  const link = [...logText.matchAll(/https?:\/\/[^\s"<>]*#accept-invitation\?[^\s"<>]*/g)].map(m => m[0].replace(/&amp;/g, '&')).filter(u => u.includes(encodeURIComponent(inviteEmail))).at(-1)
  check(!!link && link.startsWith(web), 'the invitation link was written to the local mail log and points at the isolated web app')
  const invitee = await (await browser.newContext({ viewport: { width: 375, height: 800 } })).newPage()
  await invitee.goto(link); await invitee.getByRole('heading', { name: 'Set your password' }).waitFor()
  const pw = invitee.locator('input[type=password]'); await pw.nth(0).fill(newPassword); await pw.nth(1).fill(newPassword)
  await invitee.getByRole('button', { name: 'Set password' }).click(); await invitee.getByText('Password set').waitFor()
  check(sql(`select account_status||'/'||(email_verified_at is not null) from users where email='${inviteEmail}'`) === 'Active/true', 'accepting activates the account and verifies the email')
  await invitee.goto(link); await invitee.reload(); await invitee.getByRole('button', { name: 'Set password' }).waitFor()
  const pw2 = invitee.locator('input[type=password]'); await pw2.nth(0).fill(newPassword); await pw2.nth(1).fill(newPassword)
  await invitee.getByRole('button', { name: 'Set password' }).click(); await invitee.getByText(/not valid or has expired/).waitFor()
  check(true, 'the link cannot be used twice')
  // ---- sign in: the person's OWN workspace, empty until branch access is granted ----
  const staff = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  await signIn(staff, inviteEmail, newPassword)
  await staff.locator('main h1').first().waitFor()
  const body = await staff.locator('body').innerText()
  check(/Iso Staff/.test(body) && /Branch A/.test(body) && !/Alyssa Cruz/.test(body), 'the new Staff member opens their own workspace at Branch A')
  const before = await staff.evaluate(async api => (await (await fetch(`${api}/api/me`, { credentials: 'include', headers: { Accept: 'application/json' } })).json()).data.branch_scopes.length, api)
  check(before === 0, 'no branch access until the Owner grants it')
  // ---- Owner grants branch access ----
  await owner.reload(); await owner.locator('.workspace-label').waitFor(); await nav(owner, 'User Management')
  const row = owner.locator('tr', { hasText: inviteEmail })
  await row.getByRole('button', { name: 'Branch access' }).click()
  const dialog = owner.getByRole('dialog'); await dialog.getByText('Saved access: none.').waitFor()
  await dialog.getByLabel('Branch A', { exact: true }).check(); await dialog.getByRole('button', { name: 'Save branch access' }).click()
  await dialog.getByText('Saved access: Branch A.').waitFor()
  const after = await staff.evaluate(async api => (await (await fetch(`${api}/api/me`, { credentials: 'include', headers: { Accept: 'application/json' } })).json()).data.branch_scopes.map(b => b.id), api)
  check(JSON.stringify(after) === '["b1"]', 'branch access takes effect on the next request')
  // ---- M18: a real booking writes a durable intent; nothing is sent until the worker runs ----
  const patientId = await staff.evaluate(async api => (await (await fetch(`${api}/api/patients?search=`, { credentials: 'include', headers: { Accept: 'application/json' } })).json()).data[0].id, api)
  const booked = await staff.evaluate(async ({ api, patientId }) => {
    const csrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) || [])[1] || '')
    const r = await fetch(`${api}/api/appointments`, { method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': csrf, 'Idempotency-Key': `iso-${Date.now()}` },
      body: JSON.stringify({ branch_ref: 'b1', service_ref: 'svc1', date: '2026-10-27', start_time: '10:00', patient_id: patientId }) })
    return { status: r.status, id: (await r.json()).data?.id }
  }, { api, patientId })
  check(booked.status === 201, `the new Staff member books an appointment (${booked.status})`)
  const intent = () => sql(`select status from mail_dispatches where purpose='appointment_confirmation' and subject_public_id='${booked.id}'`)
  check(intent() === 'pending' && Number(sql("select count(*) from jobs where queue='mail'")) >= 1, 'the confirmation is a pending intent with a queued job until a worker runs')
  execFileSync('php', ['artisan', 'queue:work', 'database', '--queue=mail', '--stop-when-empty'], { cwd: backend, env: isolatedEnv, stdio: 'ignore' })
  check(intent() === 'logged_only', 'the queue worker processed it: logged_only (log mailer: recorded locally, not delivered)')
  check(sql(`select count(*) from mail_dispatch_attempts a join mail_dispatches d on d.id=a.mail_dispatch_id where d.subject_public_id='${booked.id}'`) === '1', 'exactly one attempt was recorded')
  execFileSync('php', ['artisan', 'mail:process-due'], { cwd: backend, env: isolatedEnv, stdio: 'ignore' })
  check(sql(`select count(*) from mail_dispatch_attempts a join mail_dispatches d on d.id=a.mail_dispatch_id where d.subject_public_id='${booked.id}'`) === '1', 'the due-sweeper does not send a finished message again')
  check(sql("select count(*) from mail_dispatches where delivery_confirmed_at is not null") === '0', 'no message is ever marked delivered without provider evidence')
  console.log(JSON.stringify({ checks, failures: 0, mode: 'isolated integration (dental_clinic_isolated)' }))
} catch (e) {
  console.log(JSON.stringify({ checks, failure: String(e.message).slice(0, 300), passed: results.slice(0, checks) }))
  process.exitCode = 1
} finally { await browser.close() }
