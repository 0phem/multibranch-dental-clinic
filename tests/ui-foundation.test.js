import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('GEN-03: .top-icon-btn has no border and accessible :focus-visible ring in styles.css and foundation.css', () => {
  const stylesCss = read('src/styles.css')
  const foundationCss = read('src/foundation.css')

  // styles.css: .top-icon-btn is decoupled from .icon-btn and has no border
  assert.doesNotMatch(stylesCss, /\.top-icon-btn,\.icon-btn\s*\{[^}]*border:\s*1px solid/, 'styles.css does not group top-icon-btn with bordered icon-btn')
  assert.match(stylesCss, /\.top-icon-btn\s*\{[^}]*border:\s*none;[^}]*background:\s*transparent/, 'styles.css defines .top-icon-btn with border:none and background:transparent')
  assert.match(stylesCss, /\.top-icon-btn:focus-visible\s*\{[^}]*outline:\s*2px solid/, 'styles.css provides an accessible :focus-visible ring for top-icon-btn')

  // foundation.css: confirms border: none !important and focus-visible outline
  assert.match(foundationCss, /\.top-icon-btn[^{]*\{[^}]*border:\s*none\s*!important/s, 'foundation.css ensures border: none !important on top-icon-btn')
  assert.match(foundationCss, /\.top-icon-btn:focus-visible[^{]*\{[^}]*outline:\s*2px solid/s, 'foundation.css provides focus-visible ring')
})

test('GEN-06: select controls maintain accessible height and table-wrap retains horizontal scroll', () => {
  const foundationCss = read('src/foundation.css')

  // Native selects have min-height for touch targets
  assert.match(foundationCss, /select[^{]*\{[^}]*font-family:\s*inherit/s, 'selects inherit font')
  assert.match(foundationCss, /\.filter-bar-controls select[^{]*\{[^}]*min-height:\s*var\(--control-height\)/s, 'filter bar selects have accessible control height')

  // Table wrappers retain scrollability without broken overflow
  assert.match(foundationCss, /\.table-wrap\s*\{[^}]*overflow:\s*auto/, '.table-wrap keeps overflow: auto')

  // Custom popovers (e.g. auth country menu) maintain absolute positioning and high z-index
  assert.match(foundationCss, /\.auth-country-menu\s*\{[^}]*position:\s*absolute;[^}]*z-index:\s*30;/, '.auth-country-menu maintains high z-index and absolute positioning')
})
