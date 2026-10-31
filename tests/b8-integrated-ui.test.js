// Portable Playwright suite: uses the existing tool/browser or an already installed Playwright module.
// No screenshots/artifacts are written. Every context blocks non-fixture network traffic.
export async function runB8(page, base = 'http://127.0.0.1:5178', width = 1440) {
  const results = [], errors = [], escaped = []
  const check = (value, message) => { if (!value) throw new Error(message) }
  const equal = (actual, expected, message) => check(JSON.stringify(actual) === JSON.stringify(expected), `${message}: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`)
  const origin = new URL(base).origin
  await page.setViewportSize({ width, height: 1000 })
  const route = async r => {
    const u = new URL(r.request().url())
    if (u.origin === origin && !u.pathname.startsWith('/api/') && !u.pathname.startsWith('/sanctum/')) return r.continue()
    escaped.push(`${r.request().method()} ${u.origin}${u.pathname}`)
    return r.abort()
  }
  await page.context().route('**/*', route)
  const onError = error => errors.push(error.message)
  const onConsole = message => { if (message.type() === 'error') errors.push(message.text()) }
  page.on('pageerror', onError)
  page.on('console', onConsole)
  const open = async query => {
    await page.goto(`${origin}/tests/b8-integrated-ui-harness.html?${query}`)
    await page.getByRole('navigation', { name: 'B8 fixture navigation' }).waitFor()
  }
  const clean = async name => {
    equal(await page.evaluate(() => window.b8.unexpected), [], `${name}: unexpected mock request`)
    equal(errors, [], `${name}: browser errors`)
    equal(escaped, [], `${name}: request escaped fixture`)
    results.push(`${width}: ${name}`)
  }
  try {
    // B4 -> A8: the second queue row must not fall back to the first directory Patient.
    await open('view=queue')
    const betaRow = page.getByRole('row').filter({ hasText: 'Fictional Beta Patient' })
    await betaRow.focus(); await page.keyboard.press('Enter')
    await page.locator('.patient-record-head h2').waitFor()
    equal(await page.locator('.patient-record-head h2').innerText(), 'Fictional Beta Patient', 'queue target identity')
    equal(await page.evaluate(() => window.b8.events.find(e => e.type === 'navigate').context), {
      queueEntryId: 'b8-queue-1', visitId: 'b8-visit-1', patientId: 'b8-public-1', appointmentId: 'b8-appointment-1', dentistId: 'd1', branchId: 'b1', serviceId: 'svc1', treatmentId: null,
    }, 'full encounter context')
    await page.getByRole('button', { name: 'Book Appointment', exact: true }).click()
    equal(await page.getByRole('dialog').getByRole('textbox', { name: 'Patient', exact: true }).inputValue(), 'Fictional Beta Patient', 'queue record -> booking context')
    check(await page.getByRole('dialog').getByRole('button', { name: 'Confirm appointment', exact: true }).isDisabled(), 'shortcut must not auto-submit')
    await clean('queue -> Patient record -> booking preserves exact encounter and Patient')

    // B2 filtered appointment list -> same A8 record/form, with the first Patient as a decoy.
    await open('view=appointments')
    await page.getByPlaceholder('Search patient, appointment #, dentist, service…').fill('Beta')
    equal(await page.getByRole('button', { name: 'Open Patient Record', exact: true }).count(), 1, 'filtered record action')
    await page.getByRole('button', { name: 'Open Patient Record', exact: true }).click()
    equal(await page.locator('.patient-record-head h2').innerText(), 'Fictional Beta Patient', 'filtered appointment target')
    await page.getByRole('button', { name: 'Book Appointment', exact: true }).click()
    equal(await page.getByRole('dialog').getByRole('textbox', { name: 'Patient', exact: true }).inputValue(), 'Fictional Beta Patient', 'appointment -> booking target')
    await clean('filtered Staff appointment -> record -> booking retains second Patient')

    // B2/B6: changing text, switching modes and directory withdrawal invalidate selection at the real button.
    await open('view=walkin')
    const search = page.getByRole('combobox', { name: /Patient/ })
    const admit = page.getByRole('button', { name: 'Admit walk-in to queue', exact: true })
    await search.fill('Beta'); await search.press('ArrowDown'); await search.press('Enter')
    await page.getByRole('combobox', { name: 'Requested service', exact: true }).selectOption('svc1')
    await page.getByRole('combobox', { name: /^Dentist/ }).selectOption('d1')
    check(await admit.isEnabled(), 'selected current Patient can admit')
    await search.fill('Alpha')
    check(await admit.isDisabled(), 'editing query invalidates old Patient')
    await search.press('ArrowDown'); await search.press('Enter')
    await page.getByRole('radio', { name: 'New patient registration' }).check()
    await page.getByRole('radio', { name: 'Existing registered patient' }).check()
    check(await admit.isDisabled(), 'mode round trip must not restore old Patient')
    await search.fill('Beta'); await search.press('ArrowDown'); await search.press('Enter')
    await page.evaluate(() => window.b8.removeDirectory())
    await page.waitForFunction(() => document.querySelector('.walkin-action button')?.disabled)
    check(await admit.isDisabled(), 'withdrawn directory Patient cannot admit')
    equal(await page.evaluate(() => window.b8.events.filter(e => e.type === 'walkIn')), [], 'no command after invalidation')
    await clean('walk-in text/mode/directory invalidation prevents stale admission')

    // B3: server can_decide, not the role label alone, controls Owner decision UI.
    await open('view=leave&role=owner&decide=no')
    await page.getByText('Fictional B8 Requester (Staff) · Fictional leave window', { exact: true }).waitFor()
    equal(await page.getByRole('button', { name: 'Request leave', exact: true }).count(), 0, 'Owner is not requester')
    equal(await page.getByRole('button', { name: 'Accept leave request', exact: true }).count(), 0, 'server refuses decision control')
    await open('view=leave&role=owner&decide=yes')
    await page.getByRole('button', { name: 'Accept leave request', exact: true }).click()
    equal(await page.evaluate(() => window.b8.requests.filter(r => r.method === 'POST')), [], 'opening confirmation is not a decision')
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
    equal(await page.evaluate(() => window.b8.requests.filter(r => r.method === 'POST')), [], 'cancelling confirmation does not decide')
    await clean('Owner leave authority follows can_decide and cancelled confirmation sends nothing')

    // B3 requester real fetch/API adapter: exactly one mocked POST; no self-decision request.
    await open('view=leave&role=dentist')
    const today = await page.evaluate(() => window.b8.today)
    await page.getByLabel(/^From/).first().fill(today)
    await page.getByRole('checkbox', { name: 'Only part of the day' }).check()
    await page.getByLabel('From (time on selected date)', { exact: true }).fill('10:00')
    await page.getByLabel('Until (time on selected date)', { exact: true }).fill('11:00')
    await page.getByRole('button', { name: 'Request leave', exact: true }).click()
    await page.getByText('Leave requested. An authorized approver can review it.', { exact: true }).waitFor()
    equal(await page.evaluate(() => window.b8.requests.filter(r => r.method === 'POST').map(r => ({ path: r.path, body: r.body }))), [{ path: '/api/leave', body: { type: 'vacation', start_date: today, end_date: today, private_note: null, start_time: '10:00', end_time: '11:00' } }], 'request without self-approval')
    equal(await page.getByRole('button', { name: 'Accept leave request', exact: true }).count(), 0, 'Dentist has no approver controls')
    await clean('Dentist partial leave reaches HTTP adapter without self-approval')

    // B5 -> B7: the same stale/absent projection cannot be advertised as current in either surface.
    for (const mode of ['stale', 'missing']) {
      await open(`view=hours&role=dentist&duty=${mode}`)
      await page.getByText('Duty status unavailable', { exact: true }).waitFor()
      equal(await page.getByText('On duty today', { exact: true }).count(), 0, `${mode} roster duty`)
      check((await page.getByText(/Estimated profile hours/).count()) > 0, 'fallback labelled estimated')
      equal(await page.locator('.den12-roster .st-day').allTextContents(), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], 'weekday ordering')
      equal(await page.getByRole('button', { name: 'Change', exact: true }).count(), 0, 'Dentist roster read only')
      check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'roster overflow')
      await page.getByRole('navigation').getByRole('button', { name: 'duty', exact: true }).click()
      await page.getByText('Duty status could not be verified. Try again.', { exact: true }).waitFor()
      equal(await page.getByText('On duty today', { exact: true }).count(), 0, `${mode} Operations duty`)
      equal(await page.evaluate(() => window.b8.unexpected), [], `${mode}: unexpected mock request`)
    }
    await clean('stale/missing duty rejected across Work Hours and Operations')

    // Previously good B5 evidence must disappear after refresh denial/failure, then recover.
    await open('view=duty')
    await page.getByText('On duty today', { exact: true }).waitFor()
    await page.getByText('Not working now', { exact: true }).waitFor()
    for (const [mode, message] of [['forbidden', 'You do not have access to Dentist duty status.'], ['failed', 'The clinic system is temporarily unavailable. Try again in a moment.']]) {
      await page.evaluate(mode => { window.b8.dutyMode = mode }, mode)
      await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
      await page.getByText(message, { exact: true }).waitFor()
      equal(await page.getByText('On duty today', { exact: true }).count(), 0, 'old success removed')
      await page.evaluate(() => { window.b8.dutyMode = 'ready' })
      await page.getByRole('button', { name: 'Refresh status', exact: true }).click()
      await page.getByText('On duty today', { exact: true }).waitFor()
    }
    await clean('Operations clears prior duty after 403/500 and recovers')
    return results
  } finally {
    page.off('pageerror', onError)
    page.off('console', onConsole)
    await page.context().unroute('**/*', route)
  }
}

// NODE_ENTRY: the MCP Playwright tool can evaluate the portable function above verbatim.
if (typeof process !== 'undefined' && process.argv[1]?.replaceAll('\\', '/').endsWith('/b8-integrated-ui.test.js')) {
  const { default: test } = await import('node:test')
  const { pathToFileURL } = await import('node:url')
  const modulePath = process.env.B8_PLAYWRIGHT_MODULE
  const playwright = modulePath ? await import(pathToFileURL(modulePath).href) : null
  for (const width of [1440, 390]) test(`B8 rendered integrated acceptance ${width}px`, {
    skip: !playwright && 'Set B8_PLAYWRIGHT_MODULE to an existing playwright/index.mjs or execute runB8 with the existing Playwright tool; no install required.',
  }, async () => {
    const { chromium } = playwright
    const browser = await chromium.launch({ headless: true, channel: 'chrome' })
    try {
      const page = await browser.newPage({ serviceWorkers: 'block' })
      const results = await runB8(page, process.env.B8_BASE_URL || 'http://127.0.0.1:5178', width)
      for (const result of results) console.log(`PASS ${result}`)
    } finally { await browser.close() }
  })
}
