import { apiGet } from './client'
import { pageSearch, type Page, type PageQuery } from './data'

/** How events of a uid with several impressions are attributed. */
export type AttributionMode = 'first' | 'all'
export type Granularity = 'hour' | 'day'
export type Dimension = 'mm_dma' | 'site_id'

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

export type MetricRow = Metrics & {
  key: string
  /** DMA region name, e.g. `New York, NY`; null for sites. */
  name: string | null
}

export type MetricPage = Page<MetricRow> & { totals: Metrics }

export type EventTypes = { tags: string[]; click_tag: string }

/** A DMA or site for a picker. */
export type SegmentOption = {
  /** DMA code or site domain */
  key: string
  /** DMA name; null for sites */
  name: string | null
  impressions: number
}

/** Nielsen DMA; code 0 is an unknown region. */
export type DmaRegion = { code: number; name: string }

export type MetricQuery = { tag: string; mode: AttributionMode }

export type AggregateQuery = MetricQuery & PageQuery

const toSearch = (params: Record<string, string | number | string[] | undefined>) =>
  new URLSearchParams(
    Object.entries(params).flatMap(([k, v]) =>
      (Array.isArray(v) ? v : [v]).flatMap((x) => (x === undefined || x === '' ? [] : [[k, String(x)]])),
    ),
  ).toString()

export type SegmentOptionsQuery = {
  /** A part of the site domain; for DMAs a part of the name or a code prefix. */
  q: string
  limit?: number
  minImpressions?: number
}

/** DMAs or sites matching `q`, by impressions descending. */
export const getSegmentOptions = (
  dimension: Dimension,
  { q, limit, minImpressions }: SegmentOptionsQuery,
  signal?: AbortSignal,
) =>
  apiGet<SegmentOption[]>(
    `/metrics/segments/${dimension}?${toSearch({ q, limit, min_impressions: minImpressions })}`,
    { signal },
  )

export const getDmaRegions = (signal?: AbortSignal) =>
  apiGet<DmaRegion[]>('/metrics/dma-regions', { signal })

export const getEventTypes = (signal?: AbortSignal) =>
  apiGet<EventTypes>('/metrics/event-types', { signal })

/** One DMA or site; `key` is the DMA code or the site domain. */
export type Segment = { dimension: Dimension; key: string }

/** DMA codes and site domains left out of the metrics. */
export type Exclusions = Record<Dimension, string[]>

export type TimeSeriesQuery = {
  tags: string[]
  mode: AttributionMode
  granularity: Granularity
  /** Campaign-wide when absent. */
  segment?: Segment
  /** Not of the segment's own dimension. */
  exclude?: Exclusions
}

export const getTimeSeries = (
  { tags, mode, granularity, segment, exclude }: TimeSeriesQuery,
  signal?: AbortSignal,
) =>
  apiGet<TimeSeries>(
    `/metrics/timeseries?${toSearch({
      tag: tags,
      mode,
      granularity,
      ...(segment && { [segment.dimension]: segment.key }),
      exclude_mm_dma: exclude?.mm_dma,
      exclude_site_id: exclude?.site_id,
    })}`,
    { signal },
  )

export const getAggregates = (
  dimension: Dimension,
  { tag, mode, ...page }: AggregateQuery,
  signal?: AbortSignal,
) => {
  const search = pageSearch(page)
  search.set('tag', tag)
  search.set('mode', mode)
  return apiGet<MetricPage>(`/metrics/aggregates/${dimension}?${search}`, { signal })
}
