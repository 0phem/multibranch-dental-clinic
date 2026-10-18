// Prints process_documentation.html to ../PROCESS_DOCUMENTATION.pdf (A4, page numbers). Needs Playwright:
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node pdf.mjs
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' })
const page = await browser.newPage()
await page.goto('file://' + join(here, 'process_documentation.html'), { waitUntil: 'load' })
await page.pdf({ path: join(here, '..', 'PROCESS_DOCUMENTATION.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;color:#5a6b7d;width:100%;padding:0 12mm;display:flex;justify-content:space-between"><span>Process documentation · Dr. Dana E. Roxas Dental Clinic</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>' })
await browser.close()
console.log('pdf written')
