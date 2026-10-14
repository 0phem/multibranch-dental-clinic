// Owner logo upload: the same rules the server enforces (PNG or JPEG, <= 512 KB, >= 128 px, roughly square), checked first in the
// browser for faster feedback.
const MAX_LOGO_BYTES = 512 * 1024

/** Reads an image file's pixel size in the browser (before upload). */
export function imageSize(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file), img = new Image()
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
    img.src = url
  })
}

export async function checkLogoFile(file, sizeOf = imageSize) {
  if (!file) return 'Choose a logo file.'
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Use a PNG or JPEG image (email apps do not show SVG).'
  if (file.size > MAX_LOGO_BYTES) return 'Use an image of 512 KB or less.'
  const size = await sizeOf(file)
  if (!size) return 'That image could not be read.'
  if (size.width < 128 || size.height < 128) return 'Use an image at least 128 × 128 pixels, so it stays sharp.'
  if (size.width / size.height > 2 || size.height / size.width > 2) return 'Use a roughly square logo (no more than twice as wide as it is tall).'
  return ''
}
