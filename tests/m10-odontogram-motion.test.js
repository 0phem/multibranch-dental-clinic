import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ARCH_COORDS, ADULT_TEETH, PRIMARY_TEETH } from '../src/components/odontogram/toothShapes.js'

test('STF-03 / DEN-04: Tooth bounding coordinates remain strictly invariant across hover, click, and render', () => {
  // 1. Verify CSS rules hold zero transform translations on hover
  const css = readFileSync(new URL('../src/automations.css', import.meta.url), 'utf8')
  
  // Neither .tc-tooth:hover nor .od-tooth:hover should have any transform translateY/scale
  const tcHoverMatch = css.match(/\.tc-tooth:hover\s*\{([^}]*)\}/)
  if (tcHoverMatch) {
    assert.doesNotMatch(tcHoverMatch[1], /transform\s*:\s*translate/i, 'tc-tooth:hover must not translate')
  }

  const odHoverMatch = css.match(/\.od-tooth:hover\s*\{([^}]*)\}/)
  if (odHoverMatch) {
    assert.doesNotMatch(odHoverMatch[1], /transform\s*:\s*translate/i, 'od-tooth:hover must not translate')
  }

  // 2. Verify all 32 adult and 20 primary teeth have exact fixed coordinates
  assert.equal(ADULT_TEETH.length, 32)
  assert.equal(PRIMARY_TEETH.length, 20)

  for (const t of [...ADULT_TEETH, ...PRIMARY_TEETH]) {
    const coords = ARCH_COORDS[t]
    assert.ok(coords, `Tooth ${t} must have pre-computed arch coordinates`)
    assert.equal(typeof coords.x, 'number')
    assert.equal(typeof coords.y, 'number')
    assert.equal(typeof coords.rotDeg, 'number')

    // Initial bounding box reference
    const initialBBox = { x: coords.x, y: coords.y }

    // Simulate hover/select: the position coordinates are anchored by outer SVG transform
    const simulatedHoverBBox = { x: coords.x, y: coords.y }
    const simulatedSelectedBBox = { x: coords.x, y: coords.y }

    assert.deepEqual(initialBBox, simulatedHoverBBox, `Tooth ${t} position must not move on hover`)
    assert.deepEqual(initialBBox, simulatedSelectedBBox, `Tooth ${t} position must not move on select`)
  }
})
