// The ID scan, loaded only when a patient taps "Scan your ID" (it is a separate chunk, so the landing and sign-up pages stay
// fast). Everything runs on the patient's device: the photo is drawn on a canvas in memory, read, and dropped; nothing is
// uploaded. First a PhilID QR code (jsQR), then a passport MRZ or labelled text through on-device OCR (Tesseract.js, with its
// files served by this site from /ocr, never a third-party CDN).
import jsQR from 'jsqr'
import { looksClean, parseIdText, parsePhilIdQr, readScore } from './id-parse.js'

async function toCanvas(file, targetWidth = 2000) {
  const bitmap = await createImageBitmap(file)
  // Phone photos and small screenshots alike: about 2000 px wide is where on-device OCR reads ID text best.
  const scale = targetWidth / bitmap.width
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return { canvas, ctx }
}

function readQr(ctx, canvas) {
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })
  return code?.data ? parsePhilIdQr(code.data) : null
}

/** A grey, contrast-stretched copy of the photo, optionally rotated (degrees) and thresholded (Otsu), for OCR. */
function variant(source, { angle = 0, threshold = false } = {}) {
  const rad = (angle * Math.PI) / 180
  const w = source.width, h = source.height
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad)))
  canvas.height = Math.round(Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad)))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2); ctx.rotate(rad); ctx.drawImage(source, -w / 2, -h / 2)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let min = 255, max = 0
  for (let i = 0; i < d.length; i += 4) { const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = g; if (g < min) min = g; if (g > max) max = g }
  const range = Math.max(1, max - min), hist = new Array(256).fill(0)
  for (let i = 0; i < d.length; i += 4) { const v = Math.round(((d[i] - min) * 255) / range); d[i] = d[i + 1] = d[i + 2] = v; hist[v]++ }
  if (threshold) {
    const total = d.length / 4
    let sum = 0, sumB = 0, wB = 0, best = 0, t0 = 128
    for (let t = 0; t < 256; t++) sum += t * hist[t]
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue
      const wF = total - wB; if (!wF) break
      sumB += t * hist[t]
      const between = wB * wF * ((sumB / wB) - ((sum - sumB) / wF)) ** 2
      if (between > best) { best = between; t0 = t }
    }
    for (let i = 0; i < d.length; i += 4) { const v = d[i] > t0 ? 255 : 0; d[i] = d[i + 1] = d[i + 2] = v }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.putImageData(img, 0, 0)
  return canvas
}

const found = r => (r ? Object.values(r.fields).filter(Boolean).length : 0)
const better = (a, b) => (readScore(b) > readScore(a) ? b : a)


let workerPromise = null
async function ocrWorker(onProgress) {
  if (!workerPromise) {
    workerPromise = import('tesseract.js').then(({ createWorker }) => createWorker('eng', 1, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr', langPath: '/ocr', gzip: true, workerBlobURL: false, cacheMethod: 'none',
      logger: m => { if (m.status === 'recognizing text') onProgress?.(m.progress) },
    }))
  }
  return workerPromise
}

/**
 * Reads one ID photo. Returns { source: 'qr'|'mrz'|'ocr', id_type, fields: { first_name, last_name, date_of_birth }, confidence }
 * or null when nothing usable was found. Never returns the ID number, the address or the image.
 */
export async function scanId(file, { onProgress } = {}) {
  const { canvas, ctx } = await toCanvas(file)
  try {
    const qr = readQr(ctx, canvas)
    if (qr) return qr
    const worker = await ocrWorker(onProgress)
    // Straight photo first; if a field is missing, try a thresholded copy and a slight tilt either way (phone photos are rarely
    // level). The best read wins; every copy is dropped right after.
    let best = null
    for (const options of [null, {}, { threshold: true }, { angle: 3 }, { angle: -3 }]) {
      const copy = options ? variant(canvas, options) : canvas // the photo as taken first
      const { data } = await worker.recognize(copy)
      if (copy !== canvas) copy.width = copy.height = 0
      best = better(best, parseIdText(data.text, data.confidence))
      if (looksClean(best)) break
    }
    return best
  } finally {
    // Drop the pixels at once: the photo is not kept anywhere.
    ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.width = canvas.height = 0
  }
}
