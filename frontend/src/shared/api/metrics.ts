import { apiGet } from './client'
import type { Page } from './data'

/** How events of a uid with several impressions are attributed. */
export type AttributionMode = 'first' | 'all'
export type Granularity = 'hour' | 'day'
export type Dimension = 'mm_dma' | 'site_id'
export type MetricSortField = 'key' | 'impressions' | 'clicks' | 'events' | 'ctr' | 'evpm'

export type Metrics = {
  impressions: number
  /** fclick events, the CTR numerator */
  clicks: number
  /** events of the requested type, the EvPM numerator */
  events: number
  /** percent */
  ctr: number
  /** per mille */
  evpm: number
}

/** Like `Metrics`, with an EvPM numerator per requested event type. */
export type SeriesMetrics = {
  impressions: number
  clicks: number
  ctr: number
  events: Record<string, number>
  evpm: Record<string, number>
}

export type TimePoint = SeriesMetrics & { ts: string }

export type TimeSeries = {
  tags: string[]
  mode: AttributionMode
  granularity: Granularity
  points: TimePoint[]
  totals: SeriesMetrics
}

export type MetricRow = Metrics & { key: string }

export type MetricPage = Page<MetricRow> & { totals: Metrics }

export type EventTypes = { tags: string[]; click_tag: string }

export type MetricQuery = { tag: string; mode: AttributionMode }

export type AggregateQuery = MetricQuery & {
  page: number
  pageSize: number
  q?: string
  minImpressions?: number
  sort?: MetricSortField
  order?: 'asc' | 'desc'
}

const toSearch = (params: Record<string, string | number | string[] | undefined>) =>
  new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      (Array.isArray(v) ? v : [v]).flatMap((x) => (x === undefined || x === '' ? [] : [[k, String(x)]])),
    ),
  ).toString()

export const getEventTypes = (signal?: AbortSignal) =>
  apiGet<EventTypes>('/metrics/event-types', { signal })

export type TimeSeriesQuery = { tags: string[]; mode: AttributionMode; granularity: Granularity }

export const getTimeSeries = ({ tags, mode, granularity }: TimeSeriesQuery, signal?: AbortSignal) =>
  apiGet<TimeSeries>(`/metrics/timeseries?${toSearch({ tag: tags, mode, granularity })}`, {
    signal,
  })

export const getAggregates = (dimension: Dimension, query: AggregateQuery, signal?: AbortSignal) =>
  apiGet<MetricPage>(
    `/metrics/aggregates/${dimension}?${toSearch({
      tag: query.tag,
      mode: query.mode,
      page: query.page,
      page_size: query.pageSize,
      q: query.q,
      min_impressions: query.minImpressions || undefined,
      sort: query.sort,
      order: query.order,
    })}`,
    { signal },
  )
