import type { Range } from './series'

/** URL form of an hour: `2021-07-25T14`, UTC. */
export const toHourParam = (t: number) => new Date(t).toISOString().slice(0, 13)

const parseHourParam = (value: string) => {
  const t = /^\d{4}-\d{2}-\d{2}T\d{2}$/.test(value) ? Date.parse(`${value}:00:00Z`) : NaN
  return Number.isNaN(t) ? null : t
}

/** The period from `from`/`to` URL params; a missing end means the edge of the data. */
export function parsePeriod(from: string, to: string): Range | null {
  const start = parseHourParam(from)
  const end = parseHourParam(to)
  if (start === null && end === null) return null
  return { from: start ?? -Infinity, to: end ?? Infinity }
}

/** `YYYY-MM-DD` for a date input, or empty for an open end. */
export const toDateInput = (t: number) => (Number.isFinite(t) ? toHourParam(t).slice(0, 10) : '')
