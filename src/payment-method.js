// Display only: the stored payment method in plain words, matching the emails and PDFs (App\Support\Brand::paymentMethod).
// "PayMongo (GCASH)" -> "GCash", "PayMongo (CARD)" -> "Card". Methods recorded by Staff ("Cash", "Card/POS", ...) are shown as stored.
const WORDS = { CARD: 'Card', GCASH: 'GCash', MAYA: 'Maya', GRABPAY: 'GrabPay', 'ONLINE BANKING': 'Online banking', 'QR PH': 'QR Ph', SHOPEEPAY: 'ShopeePay', BILLEASE: 'BillEase', ONLINE: 'Online payment' }

export function paymentMethodLabel(stored) {
  const text = typeof stored === 'string' ? stored.trim() : ''
  const match = /^PayMongo \((.+)\)$/.exec(text)
  if (match) { const code = match[1].toUpperCase(); return WORDS[code] || code.charAt(0) + code.slice(1).toLowerCase() }
  return text
}
