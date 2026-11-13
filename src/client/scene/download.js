/**
 * scene/download.js — shared client-side text/GeoJSON/CSV file download helper.
 */

/** Trigger a client-side Blob download without a Host round-trip. */
export function downloadText(filename, text, mime) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') return false
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
