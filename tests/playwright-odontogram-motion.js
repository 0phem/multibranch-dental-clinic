/**
 * Playwright E2E Motion Invariance Test for Odontogram (M10 / STF-03 / DEN-04)
 * Verifies that getBoundingClientRect of every tooth remains invariant across
 * Top View (Arch) and Front View (Quadrant) for both Permanent (32) and Primary (20) teeth
 * under mouseenter, mouseover, click, and interaction states.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export async function runOdontogramMotionTest(page) {
  // 1. Ensure Dental Chart is active
  const inDentalChart = await page.evaluate(() => window.location.hash === '#dental-chart')
  if (!inDentalChart) {
    const dcBtn = await page.waitForSelector('button:has-text("Dental Chart")', { timeout: 10000 })
    await dcBtn.click()
    await page.waitForTimeout(600)
  }

  // 2. Ensure patient is selected
  const hasPatientSelected = await page.$('.od-tooth[data-tooth]')
  if (!hasPatientSelected) {
    const pickerItem = await page.waitForSelector('.patient-picker-item', { timeout: 10000 })
    await pickerItem.click()
  }

  // 3. Wait for odontogram teeth to be ready
  await page.waitForSelector('.od-tooth[data-tooth]', { timeout: 10000 })

  const configs = [
    { view: 'top', set: 'adult', viewBtn: 'Top view (Arch)', setBtn: 'Permanent (32)', expectedTeeth: 32 },
    { view: 'top', set: 'primary', viewBtn: 'Top view (Arch)', setBtn: 'Primary (20)', expectedTeeth: 20 },
    { view: 'front', set: 'adult', viewBtn: 'Front view', setBtn: 'Permanent (32)', expectedTeeth: 32 },
    { view: 'front', set: 'primary', viewBtn: 'Front view', setBtn: 'Primary (20)', expectedTeeth: 20 },
  ]

  const results = []

  for (const cfg of configs) {
    // A. Switch View
    await page.evaluate((btnText) => {
      const btn = Array.from(document.querySelectorAll('.od-segmented button')).find(b => b.innerText.trim() === btnText)
      if (btn) btn.click()
    }, cfg.viewBtn)
    await page.waitForTimeout(150)

    // B. Switch Set
    await page.evaluate((btnText) => {
      const btn = Array.from(document.querySelectorAll('.od-segmented button')).find(b => b.innerText.trim() === btnText)
      if (btn) btn.click()
    }, cfg.setBtn)
    await page.waitForTimeout(150)

    // C. Test tooth geometry under hover, click, and interaction
    const res = await page.evaluate(async (cfg) => {
      const teeth = Array.from(document.querySelectorAll('.od-tooth[data-tooth]'))
      if (teeth.length !== cfg.expectedTeeth) {
        return { ok: false, error: `Expected ${cfg.expectedTeeth} teeth, found ${teeth.length}` }
      }

      const initialRects = {}
      for (const t of teeth) {
        const id = t.getAttribute('data-tooth')
        const r = t.getBoundingClientRect()
        initialRects[id] = { x: r.x, y: r.y, w: r.width, h: r.height }
      }

      let maxDiff = 0
      let testedCount = 0
      const shifts = []

      for (const t of teeth) {
        const id = t.getAttribute('data-tooth')
        const init = initialRects[id]

        // 1. Hover interaction
        t.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
        t.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        const hoverRect = t.getBoundingClientRect()
        const hoverDx = Math.abs(hoverRect.x - init.x)
        const hoverDy = Math.abs(hoverRect.y - init.y)
        if (hoverDx > 0.01 || hoverDy > 0.01) {
          shifts.push({ id, event: 'hover', dx: hoverDx, dy: hoverDy })
        }
        maxDiff = Math.max(maxDiff, hoverDx, hoverDy)

        // 2. Click interaction
        t.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        const clickRect = t.getBoundingClientRect()
        const clickDx = Math.abs(clickRect.x - init.x)
        const clickDy = Math.abs(clickRect.y - init.y)
        if (clickDx > 0.01 || clickDy > 0.01) {
          shifts.push({ id, event: 'click', dx: clickDx, dy: clickDy })
        }
        maxDiff = Math.max(maxDiff, clickDx, clickDy)

        // 3. Mouse leave
        t.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
        t.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
        testedCount++
      }

      // 4. Verify coordinates after all interactions
      for (const t of teeth) {
        const id = t.getAttribute('data-tooth')
        const init = initialRects[id]
        const postRect = t.getBoundingClientRect()
        const postDx = Math.abs(postRect.x - init.x)
        const postDy = Math.abs(postRect.y - init.y)
        if (postDx > 0.01 || postDy > 0.01) {
          shifts.push({ id, event: 'post-check', dx: postDx, dy: postDy })
        }
        maxDiff = Math.max(maxDiff, postDx, postDy)
      }

      return {
        ok: shifts.length === 0,
        testedCount,
        maxDiff,
        shiftsCount: shifts.length,
        shifts: shifts.slice(0, 5),
      }
    }, cfg)

    results.push({
      view: cfg.view,
      set: cfg.set,
      expectedTeeth: cfg.expectedTeeth,
      ...res,
    })
  }

  return results
}

// Standalone execution runner
async function getPlaywright() {
  try {
    return await import('playwright')
  } catch {
    const npxDir = path.join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx')
    if (fs.existsSync(npxDir)) {
      for (const dir of fs.readdirSync(npxDir)) {
        const candidate = path.join(npxDir, dir, 'node_modules', 'playwright', 'index.mjs')
        if (fs.existsSync(candidate)) {
          return await import(pathToFileURL(candidate).href)
        }
      }
    }
    throw new Error('Playwright not found in local modules or npx cache.')
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isMain) {
  ;(async () => {
    console.log('Starting Odontogram motion invariance E2E test...')
    const pw = await getPlaywright()
    const browser = await pw.chromium.launch({ channel: 'chrome', headless: true })
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    page.on('response', res => {
      if (res.url().includes('/api/')) console.log('API RESPONSE:', res.status(), res.url())
    })
    page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText))
    page.on('console', msg => console.log('PAGE LOG:', msg.text()))
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message))

    try {
      await page.goto('http://localhost:5173/#sign-in', { waitUntil: 'domcontentloaded', timeout: 15000 })
      await page.waitForTimeout(600)

      // Wait for login form to be rendered
      const emailInput = await page.waitForSelector('input[type="email"]', { timeout: 15000 })
      await emailInput.fill('dentist@example.test')
      const passInput = await page.waitForSelector('input[type="password"]', { timeout: 5000 })
      await passInput.fill('DemoPass123')
      const submitBtn = await page.waitForSelector('button.login-button, button:has-text("Sign in")', { timeout: 5000 })
      await submitBtn.click()
      await page.waitForSelector('button:has-text("Dental Chart")', { timeout: 15000 })

      const results = await runOdontogramMotionTest(page)
      console.table(results.map(r => ({
        view: r.view,
        set: r.set,
        teeth: r.testedCount || 0,
        maxShift: `${(r.maxDiff || 0).toFixed(2)}px`,
        passed: r.ok,
        error: r.error || null,
      })))

      const allOk = results.every(r => r.ok && r.testedCount === r.expectedTeeth)
      if (!allOk) {
        console.error('FAIL: Motion shifts detected or incomplete teeth tested.')
        process.exit(1)
      }
      console.log('PASS: All 104 tooth interactions tested with zero coordinate displacement.')
    } catch (err) {
      console.error('Error running motion test:', err.message)
      await page.screenshot({ path: 'tests/motion-debug.png' })
      console.log('Current URL on error:', page.url())
      console.log('Page body text on error:', await page.evaluate(() => document.body.innerText))
      process.exit(1)
    } finally {
      await browser.close()
    }
  })().catch(err => {
    console.error('Error running motion test:', err.message)
    process.exit(1)
  })
}

export default runOdontogramMotionTest
