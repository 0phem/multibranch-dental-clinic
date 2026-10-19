// Copies the on-device OCR files (Tesseract.js worker, its LSTM core and the English data) into public/ocr, so the ID scan is
// served by this site and never fetches code or data from a third-party CDN. Runs before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })
const files = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]
let copied = 0
for (const [from, to] of files) {
  const src = join(root, from), dst = join(out, to)
  if (!existsSync(src)) { console.warn(`[ocr] missing ${from} (run npm install)`); continue }
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue
  copyFileSync(src, dst); copied++
}
if (copied) console.log(`[ocr] ${copied} file(s) copied to public/ocr`)
