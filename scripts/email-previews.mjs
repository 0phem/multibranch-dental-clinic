// Renders every /dev/mail preview to PNG (desktop 900px and phone 390px, light; desktop dark) into docs/email-previews/.
// Needs the local API (APP_ENV=local) on API_URL and Playwright:  PLAYWRIGHT_MODULE=/path/to/playwright node scripts/email-previews.mjs
// (BROWSER_CHANNEL=chrome uses the installed Google Chrome when Playwright's own browser is not downloaded)
// The receipt and invoice PDFs are saved alongside as PDFs (convert to PNG with `sips -s format png file.pdf --out file.png` on macOS).
import { mkdir, writeFile } from 'node:fs/promises'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const api = (process.env.API_URL || 'http://localhost:8000').replace(/\/$/, '')
const out = new URL('../docs/email-previews/', import.meta.url)
await mkdir(out, { recursive: true })

// V2=1: the design pass 2 set: both designs (A = fresh, B = premium), desktop and phone, light and dark, into docs/email-previews/v2/.
if (process.env.V2) {
  const v2 = new URL('v2/', out)
  await mkdir(v2, { recursive: true })
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
  try {
    for (const [letter, design] of [['A', 'fresh'], ['B', 'premium']]) {
      for (const v of [{ suffix: 'desktop', width: 900, scheme: 'light' }, { suffix: 'phone', width: 390, scheme: 'light' }, { suffix: 'desktop-dark', width: 900, scheme: 'dark' }, { suffix: 'phone-dark', width: 390, scheme: 'dark' }]) {
        const page = await browser.newPage({ viewport: { width: v.width, height: 900 }, colorScheme: v.scheme, deviceScaleFactor: 1 })
        // A (the default) for every template; B for the three comparison samples.
        const all = ['payment-receipt', 'verification-code', 'invoice', 'password-reset-code', 'email-change-code', 'registration-attempt', 'registration-attempt-record',
          'password-changed', 'email-changed', 'employee-invitation', 'message-alert', 'appointment-confirmation', 'appointment-rescheduled', 'appointment-cancelled', 'smtp-test']
        for (const name of letter === 'A' ? all : ['payment-receipt', 'verification-code', 'invoice']) {
          const res = await page.goto(`${api}/dev/mail/${name}?design=${design}`, { waitUntil: 'load' })
          if (!res || res.status() !== 200) throw new Error(`${name}: HTTP ${res?.status()}`)
          await page.screenshot({ path: new URL(`${letter}-${name}-${v.suffix}.png`, v2).pathname, fullPage: true })
          console.log(`saved v2/${letter}-${name}-${v.suffix}.png`)
        }
        await page.close()
      }
      for (const doc of ['receipt', 'invoice', 'invoice-long']) {
        const res = await fetch(`${api}/dev/mail/pdf/${doc}?design=${design}`)
        if (!res.ok) throw new Error(`pdf ${doc}: HTTP ${res.status}`)
        await writeFile(new URL(`${letter}-${doc}-pdf.pdf`, v2), Buffer.from(await res.arrayBuffer()))
        console.log(`saved v2/${letter}-${doc}-pdf.pdf`)
      }
    }
  } finally { await browser.close() }
  process.exit(0)
}

const templates = process.argv.slice(2).length ? process.argv.slice(2) : [
  'verification-code', 'password-reset-code', 'email-change-code', 'password-changed', 'email-changed', 'registration-attempt',
  'employee-invitation', 'message-alert', 'payment-receipt', 'invoice', 'appointment-confirmation',
]
const variants = [
  { suffix: 'desktop', width: 900, scheme: 'light' },
  { suffix: 'phone', width: 390, scheme: 'light' },
  { suffix: 'desktop-dark', width: 900, scheme: 'dark' },
]

const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
try {
  for (const v of variants) {
    const page = await browser.newPage({ viewport: { width: v.width, height: 900 }, colorScheme: v.scheme, deviceScaleFactor: 1 })
    for (const name of templates) {
      const res = await page.goto(`${api}/dev/mail/${name}`, { waitUntil: 'load' })
      if (!res || res.status() !== 200) throw new Error(`${name}: HTTP ${res?.status()}`)
      await page.screenshot({ path: new URL(`${name}-${v.suffix}.png`, out).pathname, fullPage: true })
      console.log(`saved ${name}-${v.suffix}.png`)
    }
    await page.close()
  }
} finally {
  await browser.close()
}
for (const doc of ['receipt', 'invoice']) {
  const res = await fetch(`${api}/dev/mail/pdf/${doc}`)
  if (!res.ok) throw new Error(`pdf ${doc}: HTTP ${res.status}`)
  await writeFile(new URL(`${doc}-pdf.pdf`, out), Buffer.from(await res.arrayBuffer()))
  console.log(`saved ${doc}-pdf.pdf`)
}
