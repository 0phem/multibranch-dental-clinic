// Pure parsing for the ID scan (no browser APIs, so it is unit-tested): PhilID QR payloads, passport MRZ lines and the text
// that on-device OCR reads from common Philippine IDs. Only NAME PARTS and the BIRTH DATE are ever returned: ID numbers,
// addresses, photos and signatures are never extracted, kept or sent.

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12,
  JANUARY: 1, FEBRUARY: 2, MARCH: 3, APRIL: 4, JUNE: 6, JULY: 7, AUGUST: 8, SEPTEMBER: 9, OCTOBER: 10, NOVEMBER: 11, DECEMBER: 12 }

export const ID_TYPE_HINTS = [
  ['philid', /PHILIPPINE IDENTIFICATION|PAMBANSANG PAGKAKAKILANLAN|PHILSYS|EPHILID|E-PHILID/],
  ['drivers_license', /DRIVER.?S LICEN[SC]E|LAND TRANSPORTATION OFFICE|\bLTO\b/],
  ['umid', /UNIFIED MULTI.?PURPOSE|\bUMID\b|\bCRN\b/],
  ['passport', /PASSPORT|PASAPORTE|^P<PHL/m],
  ['postal', /POSTAL IDENTITY|PHLPOST|PHILPOST|POSTAL ID/],
  ['prc', /PROFESSIONAL REGULATION COMMISSION|\bPRC\b/],
  ['voters', /COMMISSION ON ELECTIONS|\bCOMELEC\b|VOTER/],
  ['senior', /SENIOR CITIZEN|\bOSCA\b/],
]

const pad = n => String(n).padStart(2, '0')
const validDate = (y, m, d) => {
  if (!(y > 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCMonth() !== m - 1 || dt > new Date()) return null
  return `${y}-${pad(m)}-${pad(d)}`
}

/** A birth date in the usual Philippine ID formats → YYYY-MM-DD, or null. */
export function parseDate(text) {
  const t = String(text || '').toUpperCase().replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  let m
  if ((m = /\b(19\d{2}|20\d{2})[/\- ](\d{1,2})[/\- ](\d{1,2})\b/.exec(t))) return validDate(+m[1], +m[2], +m[3])
  // OCR often reads the slashes of 1975/11/02 as "1" or "I": 1975111102.
  if ((m = /\b(19\d{2}|20\d{2})[1IL|](\d{2})[1IL|](\d{2})\b/.exec(t))) return validDate(+m[1], +m[2], +m[3])
  if ((m = /\b(\d{1,2})[/\-](\d{1,2})[/\-](19\d{2}|20\d{2})\b/.exec(t))) return validDate(+m[3], +m[1], +m[2]) // MM/DD/YYYY (Philippine usage)
  if ((m = /\b([A-Z]{3,9}) (\d{1,2}) (19\d{2}|20\d{2})\b/.exec(t)) && MONTHS[m[1]]) return validDate(+m[3], MONTHS[m[1]], +m[2])
  if ((m = /\b(\d{1,2}) ([A-Z]{3,9}) (19\d{2}|20\d{2})\b/.exec(t)) && MONTHS[m[2]]) return validDate(+m[3], MONTHS[m[2]], +m[1])
  return null
}

const clean = s => String(s || '').toUpperCase().replace(/[^A-ZÑ\- ']/g, ' ').replace(/\s+/g, ' ').trim()
const title = s => clean(s).toLowerCase().replace(/(^|[\s\-'])([a-zñ])/g, (_, p, c) => p + c.toUpperCase())

/**
 * PhilID / ePhilID QR: a JSON payload with a `subject` (lName, fName, mName, DOB, …). Only the names and DOB are read; the PCN,
 * place of birth and the rest are ignored.
 */
export function parsePhilIdQr(payload) {
  let data
  try { data = JSON.parse(payload) } catch { return null }
  const s = data?.subject || data
  if (!s || typeof s !== 'object' || !(s.lName || s.fName)) return null
  const fields = { last_name: title(s.lName), first_name: title(s.fName), date_of_birth: parseDate(s.DOB) }
  return { source: 'qr', id_type: 'philid', fields, middle_name: title(s.mName), confidence: fields.date_of_birth ? 0.99 : 0.8 }
}

/** Passport TD3 machine-readable zone: names from line 1, birth date (YYMMDD) from line 2. */
export function parseMrz(text) {
  const lines = String(text || '').toUpperCase().split(/\n/).map(l => l.replace(/\s/g, '').replace(/[«‹]/g, '<')).filter(l => l.length >= 30)
  const i = lines.findIndex(l => /^P[A-Z<][A-Z<]{3}/.test(l) && l.includes('<<'))
  if (i < 0 || !lines[i + 1]) return null
  const l1 = lines[i], l2 = lines[i + 1]
  const [surname, given = ''] = l1.slice(5).split('<<')
  const birth = /^[A-Z0-9<]{9}[0-9<][A-Z<]{3}(\d{6})/.exec(l2)?.[1]
  if (!surname || !birth) return null
  const yy = +birth.slice(0, 2), now = new Date().getUTCFullYear() % 100
  const date = validDate((yy > now ? 1900 : 2000) + yy, +birth.slice(2, 4), +birth.slice(4, 6))
  const givenNames = given.split('<').filter(Boolean)
  return { source: 'mrz', id_type: 'passport', fields: { last_name: title(surname.replace(/</g, ' ')), first_name: title(givenNames.join(' ')), date_of_birth: date }, confidence: date ? 0.95 : 0.6 }
}

// Labels are found anywhere in a line: on a phone photo the photo frame often adds junk in front ("~ |", "PHOTO |").
const LABEL = {
  middle: /\b(MIDDLE NAME|GITNANG APELYIDO)\b/,
  last: /\b(SURNAME|LAST NAME|APELYIDO|APELIDO)\b/,
  first: /\b(GIVEN NAMES?|FIRST NAME|MGA PANGALAN)\b/,
  dob: /(DATE OF BIRTH|BIRTH ?DATE|PETSA NG KAPANGANAKAN|\bDOB\b)/,
  combined: /LAST NAME\s*,?\s*FIRST NAME/,
  full: /(?:^|[^A-Z])(NAME|PANGALAN NG MAY.?ARI)\b\s*[:.]?/,
}
/** The text of a value line without the junk an angled photo adds: everything after the last "|", then from the first letter. */
const valueOf = line => line.split('|').pop().replace(/^[^A-Z0-9Ñ]+/, '').replace(/^[A-Z]\s+(?=[A-Z]{2,})/, '').trim()
const LAST_PARTICLES = ['DE', 'DEL', 'DELA', 'DELOS', 'LA', 'LOS', 'SAN', 'SANTA', 'STA']
// Label words (English and Filipino) that may sit next to a value on bilingual cards: never part of a name.
const LABEL_WORDS = /\b(APELYIDO|APELIDO|LAST NAME|SURNAME|MGA PANGALAN|PANGALAN|GIVEN NAMES?|FIRST NAME|GITNANG APELYIDO|MIDDLE NAME|PETSA NG KAPANGANAKAN|DATE OF BIRTH|NAME)\b/g

function afterLabel(lines, i, re) {
  const line = lines[i]
  const at = line.search(re)
  const rest = valueOf(line.slice(at).replace(re, '').replace(LABEL_WORDS, ' ').replace(/^[\s:./\-]+/, '').replace(/[\s:./\-]+$/, ''))
  if (rest.replace(/[^A-Z]/g, '').length >= 2) return rest
  const next = lines.slice(i + 1, i + 3).map(valueOf).find(l => l.replace(/[^A-Z]/g, '').length >= 2 && !Object.values(LABEL).some(r => r.test(l)))
  return next || ''
}

/** Splits "JUAN SANTOS DELA CRUZ" into first and last names (Filipino surname particles stay with the surname). */
export function splitFullName(full) {
  const words = clean(full).split(' ').filter(Boolean).filter(w => !/^[A-Z]\.?$/.test(w) || w.length > 2)
  if (words.length < 2) return { first_name: title(words.join(' ')), last_name: '' }
  let cut = words.length - 1
  while (cut > 1 && LAST_PARTICLES.includes(words[cut - 1])) cut--
  return { first_name: title(words.slice(0, cut).join(' ')), last_name: title(words.slice(cut).join(' ')) }
}

/**
 * OCR text of an ID → { id_type, fields: { first_name, last_name, date_of_birth }, confidence }. `ocrConfidence` (0–100) is the
 * recognizer's own score; the result's confidence also drops for every field that could not be found.
 */
export function parseIdText(text, ocrConfidence = 70) {
  const upper = String(text || '').toUpperCase()
  const mrz = parseMrz(upper)
  if (mrz) return mrz
  const id_type = ID_TYPE_HINTS.find(([, re]) => re.test(upper))?.[0] || 'other'
  // Keep "|": on an angled photo it separates the photo frame from the value (valueOf). The word PHOTO is a frame label.
  const lines = upper.split(/\n/).map(l => l.replace(/[_~]+/g, ' ').replace(/\bPHOTO\b/g, ' ').replace(/\s+/g, ' ').trim()).filter(l => l.replace(/[^A-Z0-9]/g, '').length > 0)
  const fields = { first_name: '', last_name: '', date_of_birth: null }
  lines.forEach((line, i) => {
    if (LABEL.middle.test(line) && !LABEL.combined.test(line)) return // the middle name is not collected
    if (!fields.last_name && LABEL.combined.test(line)) {
      const value = lines.slice(i + 1).find(l => l.includes(',')) || ''
      const [last, rest = '', middle] = value.split(',')
      if (rest) {
        fields.last_name = title(last)
        // "LAST, FIRST MIDDLE" under a header that names a middle name: the last word is the middle name.
        const given = clean(rest).split(' ').filter(Boolean)
        fields.first_name = title((/MIDDLE/.test(line) && middle === undefined && given.length > 1 ? given.slice(0, -1) : given).join(' '))
      }
    } else if (!fields.last_name && LABEL.last.test(line)) fields.last_name = title(afterLabel(lines, i, LABEL.last))
    else if (!fields.first_name && LABEL.first.test(line)) fields.first_name = title(afterLabel(lines, i, LABEL.first))
    else if (!fields.first_name && !fields.last_name && LABEL.full.test(line) && !/(SUR|FIRST|GIVEN|MIDDLE|LAST) ?NAME/.test(line)) Object.assign(fields, splitFullName(afterLabel(lines, i, LABEL.full)))
    if (!fields.date_of_birth && LABEL.dob.test(line)) fields.date_of_birth = parseDate(line.split(LABEL.dob).pop()) || parseDate(lines[i + 1]) || parseDate(lines[i + 2])
  })
  if (!fields.date_of_birth) fields.date_of_birth = null
  const found = ['first_name', 'last_name', 'date_of_birth'].filter(k => fields[k]).length
  return { source: 'ocr', id_type, fields, confidence: Math.max(0, Math.min(1, (ocrConfidence / 100) * (found / 3))) }
}

/** Plain-language verdict for the form: good reads are prefilled for checking; poor ones ask the patient to type. */
export function scanVerdict(result) {
  if (!result) return { ok: false, message: 'We couldn’t read it clearly, please type it.' }
  const n = Object.values(result.fields).filter(Boolean).length
  if (n === 0 || result.confidence < 0.45) return { ok: false, message: 'We couldn’t read it clearly, please type it.' }
  return { ok: true, message: result.confidence >= 0.8 ? 'Filled in from your ID. Please check every field.' : 'Partly read. Please check every field carefully.' }
}

// Short words that really start Filipino names (so they are not mistaken for OCR noise from a photo frame).
const SHORT_NAME_WORDS = new Set(['ANA', 'ANN', 'JO', 'MA', 'MAY', 'JAY', 'JON', 'KIM', 'LEA', 'MIA', 'NOE', 'ROY', 'TEO', 'IAN', 'ELY', 'ABE', 'BEN', 'DAN', 'DE', 'DEL', 'LA', 'LOS', 'SAN', 'STA', 'DI', 'DY', 'GO', 'LU', 'NG', 'ONG', 'SY', 'TAN', 'UY', 'YU', 'LIM', 'LEE'])

/** How believable a read is: fields found, the recognizer's confidence, minus name words that look like frame noise. */
export function readScore(result) {
  if (!result) return -1
  const f = result.fields
  const noise = [f.first_name, f.last_name].filter(Boolean).map(n => clean(n).split(' ')[0]).filter(w => w.length <= 3 && !SHORT_NAME_WORDS.has(w)).length
  return Object.values(f).filter(Boolean).length * 10 + result.confidence * 5 - noise * 8
}

export const looksClean = result => readScore(result) >= 28 && Object.values(result.fields).every(Boolean)
