// Renders every .mmd in this folder to svg/NAME.svg and png/NAME.png in ONE browser session, using the Mermaid library.
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs MERMAID_JS=/path/to/mermaid/dist/mermaid.min.js node render.mjs [files…]
// Mermaid is not a project dependency: point MERMAID_JS at any mermaid 11 build (for example one fetched by
// `npx @mermaid-js/mermaid-cli`). Diagram ids are unique per file, so the SVGs can be inlined together in one document.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, basename } from 'node:path'
const here = dirname(fileURLToPath(import.meta.url))
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const config = JSON.parse(readFileSync(join(here, 'mermaid-config.json'), 'utf8'))
const files = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(here).filter(f => f.endsWith('.mmd')).sort()
mkdirSync(join(here, 'svg'), { recursive: true }); mkdirSync(join(here, 'png'), { recursive: true })
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' })
const page = await browser.newPage({ deviceScaleFactor: 2 })
await page.setContent('<!doctype html><html><body style="margin:0;background:#fff"><div id="out" style="display:inline-block;padding:12px;background:#fff"></div></body></html>')
await page.addScriptTag({ path: process.env.MERMAID_JS })
await page.evaluate(cfg => window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', ...cfg }), config)
let failed = 0
for (const file of files) {
  const name = basename(file, '.mmd')
  const id = 'd-' + name.replace(/[^a-zA-Z0-9-]/g, '-')
  try {
    const svg = await page.evaluate(async ([id, text]) => (await window.mermaid.render(id, text)).svg, [id, readFileSync(join(here, file), 'utf8')])
    writeFileSync(join(here, 'svg', `${name}.svg`), svg)
    await page.evaluate(svg => { document.getElementById('out').innerHTML = svg }, svg)
    await page.locator('#out').screenshot({ path: join(here, 'png', `${name}.png`) })
    console.log('rendered', name)
  } catch (e) { failed++; console.log('FAILED', name, String(e.message || e).split('\n')[0]) }
}
await browser.close()
console.log(`${files.length - failed} rendered, ${failed} failed`)
