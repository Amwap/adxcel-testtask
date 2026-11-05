/** Names longer than this are shortened in labels, with the full one in a tooltip. */
export const MAX_NAME = 28

// Most names end with the state: "Harrisburg-Lancaster-Lebanon-York, PA"
const STATE = /,\s?([A-Z]{2})$/
// Markets across states name one after each city: "Providence, RI-New Bedford, MA"
const HAS_STATE = /,\s?[A-Z]{2}\b/

/** `(501) New York, NY`, or `DMA 501` while the name is unknown. */
export const dmaLabel = (code: number | string, name?: string | null) =>
  name ? `(${code}) ${name}` : `DMA ${code}`

/**
 * Cuts a long name after its first cities and keeps the state:
 * `Harrisburg-Lancaster-Lebanon-York, PA` → `Harrisburg-Lancaster…, PA`,
 * `Providence, RI-New Bedford, MA` → `Providence, RI…`.
 */
export function shortDmaName(name: string, max = MAX_NAME) {
  if (name.length <= max) return name
  const state = STATE.exec(name)
  const suffix = state ? `, ${state[1]}` : ''
  const base = state ? name.slice(0, state.index) : name
  const room = max - suffix.length - 1
  const head = base.slice(0, room + 1)
  // Cities are joined by dashes; a parenthesis starts a note on the area
  let cut = Math.max(head.lastIndexOf('-'), head.lastIndexOf('('))
  if (cut <= 0) cut = head.lastIndexOf(' ')
  const short = (cut > 0 ? head.slice(0, cut) : base.slice(0, room)).replace(/[\s,(-]+$/, '')
  return HAS_STATE.test(short) ? `${short}…` : `${short}…${suffix}`
}

/** The label to show and the full one for a tooltip, unset when nothing was cut. */
export function dmaLabels(code: number | string, name?: string | null) {
  const full = dmaLabel(code, name)
  const label = name ? dmaLabel(code, shortDmaName(name)) : full
  return { label, title: label === full ? undefined : full }
}
