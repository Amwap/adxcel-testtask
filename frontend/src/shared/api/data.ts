import { apiGet } from './client'

export type Page<T> = { items: T[]; total: number; page: number; page_size: number }

/** `filters` are column filter and sort parameters, as built by `useTableState`. */
export type PageQuery = { page: number; pageSize: number; filters?: [string, string][] }

export type Impression = {
  id: number
  reg_time: string
  uid: string
  fc_imp_chk: number
  fc_time_chk: number
  utmtr: number
  mm_dma: number
  os_name: string | null
  model: string | null
  hardware: string | null
  site_id: string
  events: string[]
}

export type AdEvent = {
  id: number
  uid: string
  tag: string
  reg_time: string | null
  site_id: string | null
}

export type DataSource = { table: string; file_name: string; rows: number; synced_at: string }

export type DatasetSummary = {
  sources: DataSource[]
  event_tags: { tag: string; count: number }[]
  /** Distinct values of low-cardinality impression columns, e.g. `os_name`. */
  impression_facets: Record<string, { value: string; count: number }[]>
}

export const pageSearch = ({ page, pageSize, filters = [] }: PageQuery) =>
  new URLSearchParams([['page', String(page)], ['page_size', String(pageSize)], ...filters])

export const getSummary = (signal?: AbortSignal) => apiGet<DatasetSummary>('/summary', { signal })

export const getImpressions = (query: PageQuery, signal?: AbortSignal) =>
  apiGet<Page<Impression>>(`/impressions?${pageSearch(query)}`, { signal })

export const getEvents = (query: PageQuery, signal?: AbortSignal) =>
  apiGet<Page<AdEvent>>(`/events?${pageSearch(query)}`, { signal })
