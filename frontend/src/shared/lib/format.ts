const numberFormat = new Intl.NumberFormat('en-US')
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
// Timestamps are shown exactly as logged, without converting to the viewer's time zone
const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZone: 'UTC',
})
const dayFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const hourFormat = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

export const formatNumber = (n: number) => numberFormat.format(n)

export const formatCompact = (n: number) => compactFormat.format(n)

/** Fixed decimals with a unit, e.g. `0.41%`, `10.92‰`. */
export const formatRate = (n: number, unit: '%' | '‰', digits = 2) => `${n.toFixed(digits)}${unit}`

/** Parses a naive API datetime (`2021-07-21T19:25:47`) as UTC milliseconds. */
export const parseApiDate = (iso: string) => Date.parse(`${iso.slice(0, 19)}Z`)

export const formatDateTime = (iso: string) => dateTimeFormat.format(parseApiDate(iso))

export const formatDay = (ms: number) => dayFormat.format(ms)

export const formatHour = (ms: number) => hourFormat.format(ms)
