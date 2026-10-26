// FDI teeth lists per arch
export const ADULT_UPPER = ['18', '17', '16', '15', '14', '13', '12', '11', '21', '22', '23', '24', '25', '26', '27', '28']
export const ADULT_LOWER = ['48', '47', '46', '45', '44', '43', '42', '41', '31', '32', '33', '34', '35', '36', '37', '38']
export const ADULT_TEETH = [...ADULT_UPPER, ...ADULT_LOWER]

export const PRIMARY_UPPER = ['55', '54', '53', '52', '51', '61', '62', '63', '64', '65']
export const PRIMARY_LOWER = ['85', '84', '83', '82', '81', '71', '72', '73', '74', '75']
export const PRIMARY_TEETH = [...PRIMARY_UPPER, ...PRIMARY_LOWER]

// Front quadrant rows (preserved from historical view)
export const ADULT_FRONT_ROWS = [
  ['18', '17', '16', '15', '14', '13', '12', '11'],
  ['21', '22', '23', '24', '25', '26', '27', '28'],
  ['48', '47', '46', '45', '44', '43', '42', '41'],
  ['31', '32', '33', '34', '35', '36', '37', '38'],
]

export const PRIMARY_FRONT_ROWS = [
  ['55', '54', '53', '52', '51'],
  ['61', '62', '63', '64', '65'],
  ['85', '84', '83', '82', '81'],
  ['71', '72', '73', '74', '75'],
]

export const QUADRANT_NAMES = ['Upper right', 'Upper left', 'Lower right', 'Lower left']

/** Convert FDI code to Universal numbering if selected */
export function toothLabel(fdi, numbering = 'fdi') {
  if (numbering !== 'universal') return fdi
  const q = Number(fdi[0]), n = Number(fdi[1])
  if (q <= 4) return String({ 1: 9 - n, 2: 8 + n, 3: 25 - n, 4: 24 + n }[q])
  return 'ABCDEFGHIJKLMNOPQRST'[{ 5: 5 - n, 6: 4 + n, 7: 15 - n, 8: 14 + n }[q]]
}

/** Formal anatomical name for each tooth */
export function getToothFullName(fdi) {
  const q = Number(fdi[0]), n = Number(fdi[1])
  const arch = (q === 1 || q === 2 || q === 5 || q === 6) ? 'Maxillary' : 'Mandibular'
  const side = (q === 1 || q === 4 || q === 5 || q === 8) ? 'Right' : 'Left'
  const isPrimary = q >= 5

  const permanentTypes = {
    1: 'Central Incisor',
    2: 'Lateral Incisor',
    3: 'Canine',
    4: 'First Premolar',
    5: 'Second Premolar',
    6: 'First Molar',
    7: 'Second Molar',
    8: 'Third Molar',
  }

  const primaryTypes = {
    1: 'Primary Central Incisor',
    2: 'Primary Lateral Incisor',
    3: 'Primary Canine',
    4: 'Primary First Molar',
    5: 'Primary Second Molar',
  }

  const typeName = isPrimary ? (primaryTypes[n] || 'Tooth') : (permanentTypes[n] || 'Tooth')
  return `${arch} ${side} ${typeName}`
}

export function getToothType(fdi) {
  const n = Number(fdi[1])
  const isPrimary = Number(fdi[0]) >= 5
  if (isPrimary) {
    if (n <= 2) return 'incisor'
    if (n === 3) return 'canine'
    return 'molar'
  }
  if (n <= 2) return 'incisor'
  if (n === 3) return 'canine'
  if (n <= 5) return 'premolar'
  return 'molar'
}

/** Precalculated arch coordinates for top-down view (ViewBox: 0 0 540 500) */
function generateArchMap(teethList, centerX, centerY, radiusX, radiusY, startAngleDeg, endAngleDeg) {
  const map = {}
  const n = teethList.length
  for (let i = 0; i < n; i++) {
    const fraction = i / (n - 1)
    const angleDeg = startAngleDeg + fraction * (endAngleDeg - startAngleDeg)
    const angleRad = (angleDeg * Math.PI) / 180
    const x = Math.round(centerX + radiusX * Math.cos(angleRad))
    const y = Math.round(centerY + radiusY * Math.sin(angleRad))
    const numDist = 30
    const numX = Math.round(x + numDist * Math.cos(angleRad))
    const numY = Math.round(y + numDist * Math.sin(angleRad))
    const rotDeg = Math.round(angleDeg + 90)
    map[teethList[i]] = { x, y, numX, numY, rotDeg, fdi: teethList[i] }
  }
  return map
}

export const ARCH_COORDS = {
  // Adult permanent arch (32 teeth)
  ...generateArchMap(ADULT_UPPER, 270, 240, 185, 175, 195, 345),
  ...generateArchMap(ADULT_LOWER, 270, 260, 185, 175, 165, 15),
  // Primary deciduous arch (20 teeth)
  ...generateArchMap(PRIMARY_UPPER, 270, 240, 150, 140, 200, 340),
  ...generateArchMap(PRIMARY_LOWER, 270, 260, 150, 140, 160, 20),
}
