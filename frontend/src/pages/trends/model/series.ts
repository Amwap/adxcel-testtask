import type { TimePoint } from '@/shared/api'
import { parseApiDate } from '@/shared/lib'

/** `rolling` is a trailing 24-hour window recomputed at every hour. */
export type Resolution = 'rolling' | 'hour' | 'day'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type ChartPoint = {
  t: number
  /** Impressions in the bucket itself (the hour or the day). */
  impressions: number
  /** Impressions behind the rates: the bucket, or the whole window when rolling. */
  base: number
  clicks: number
  events: Record<string, number>
  /** Null when the bucket has too few impressions to be trusted. */
  ctr: number | null
  evpm: Record<string, number | null>
}

type Counts = { impressions: number; clicks: number; events: Record<string, number> }

const add = (acc: Counts, p: Counts, sign = 1) => {
  acc.impressions += sign * p.impressions
  acc.clicks += sign * p.clicks
  for (const [tag, n] of Object.entries(p.events)) acc.events[tag] = (acc.events[tag] ?? 0) + sign * n
}

const empty = (): Counts => ({ impressions: 0, clicks: 0, events: {} })

function toPoint(t: number, impressions: number, c: Counts, tags: string[], hidden: boolean): ChartPoint {
  const rate = (n: number, scale: number) => (hidden || !c.impressions ? null : (scale * n) / c.impressions)
  return {
    t,
    impressions,
    base: c.impressions,
    clicks: c.clicks,
    // Copied: the rolling window keeps mutating its counts after this point
    events: { ...c.events },
    ctr: rate(c.clicks, 100),
    evpm: Object.fromEntries(tags.map((tag) => [tag, rate(c.events[tag] ?? 0, 1000)])),
  }
}

/**
 * Turns the hourly series into chart points. Rates are always ratios of sums over the
 * bucket or window, never averages of rates, so quiet hours weigh as little as they should.
 * A bucket with fewer than `minImpressions` behind its rates (its own, or the window's when
 * rolling) keeps its place but has no rates.
 */
export function buildPoints(
  hourly: TimePoint[],
  tags: string[],
  resolution: Resolution,
  minImpressions: number,
): ChartPoint[] {
  const rows = hourly.map((p) => ({ ...p, t: parseApiDate(p.ts) }))
  const points = bucket(rows, tags, resolution, minImpressions)
  // Hidden buckets at the edges would only stretch the time axis
  const first = points.findIndex((p) => p.ctr !== null)
  const last = points.findLastIndex((p) => p.ctr !== null)
  return first === -1 ? points : points.slice(first, last + 1)
}

function bucket(
  rows: (TimePoint & { t: number })[],
  tags: string[],
  resolution: Resolution,
  minImpressions: number,
): ChartPoint[] {
  if (resolution === 'day') {
    const days = new Map<number, Counts>()
    for (const p of rows) {
      const day = p.t - (p.t % DAY)
      if (!days.has(day)) days.set(day, empty())
      add(days.get(day)!, p)
    }
    return [...days].map(([t, c]) => toPoint(t, c.impressions, c, tags, c.impressions < minImpressions))
  }

  if (resolution === 'hour') {
    return rows.map((p) => toPoint(p.t, p.impressions, p, tags, p.impressions < minImpressions))
  }

  // Sliding window over (t - 24h, t]; hours without impressions are simply absent
  const window = empty()
  let start = 0
  return rows.map((p) => {
    add(window, p)
    while (rows[start].t <= p.t - DAY) add(window, rows[start++], -1)
    return toPoint(p.t, p.impressions, window, tags, window.impressions < minImpressions)
  })
}

/**
 * Upper bound for the y axis when a few outliers would flatten everything else,
 * or null when the data fits comfortably as is.
 */
export function outlierCap(values: (number | null)[]): number | null {
  const sorted = values.filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (sorted.length < 20) return null
  const p98 = sorted[Math.floor(sorted.length * 0.98)]
  const cap = niceCeil(p98 * 1.25)
  return p98 > 0 && sorted[sorted.length - 1] > cap * 1.2 ? cap : null
}

/** A period of whole hours: `from` and `to` are the first and last hour starts, UTC ms. */
export type Range = { from: number; to: number }

export const lastHourOf = (point: number, resolution: Resolution) =>
  resolution === 'day' ? point + DAY - HOUR : point

/** Points whose bucket overlaps the range. */
export function inRange(points: ChartPoint[], range: Range | null, resolution: Resolution) {
  if (!range) return points
  return points.filter((p) => lastHourOf(p.t, resolution) >= range.from && p.t <= range.to)
}

export type Totals = Counts & { ctr: number; evpm: Record<string, number> }

/** Sums of the raw hourly series over the range, so the tiles match the visible period. */
export function totalsOf(hourly: TimePoint[], tags: string[], range: Range | null): Totals {
  const sum = empty()
  for (const p of hourly) {
    const t = parseApiDate(p.ts)
    if (!range || (t >= range.from && t <= range.to)) add(sum, p)
  }
  const rate = (n: number, scale: number) => (sum.impressions ? (scale * n) / sum.impressions : 0)
  return {
    ...sum,
    ctr: rate(sum.clicks, 100),
    evpm: Object.fromEntries(tags.map((tag) => [tag, rate(sum.events[tag] ?? 0, 1000)])),
  }
}

/** About four evenly spaced round ticks from 0 that cover `max` (steps of 1, 2, 2.5, 5 × 10ⁿ). */
export function niceTicks(max: number): number[] {
  if (!(max > 0)) return [0, 1]
  const rough = max / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = [1, 2, 2.5, 5, 10].map((s) => s * magnitude).find((s) => s >= rough) ?? rough
  const count = Math.ceil(max / step - 1e-9)
  return Array.from({ length: count + 1 }, (_, i) => Number((i * step).toPrecision(12)))
}

/** Smallest round number (1, 1.5, 2, 2.5, 3, 4, 5, 6, 8 × 10ⁿ) not below `v`. */
function niceCeil(v: number) {
  const magnitude = 10 ** Math.floor(Math.log10(v))
  const step = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= v) ?? 10
  return step * magnitude
}
