import { apiGet } from './client'

export type Page<T> = { items: T[]; total: number; page: number; page_size: number }

export type PageQuery = { page: number; pageSize: number; q?: string }

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
}

function toSearch({ page, pageSize, q, ...rest }: PageQuery & Record<string, unknown>) {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (q) params.set('q', q)
  for (const [k, v] of Object.entries(rest)) if (v) params.set(k, String(v))
  return params.toString()
}

export const getSummary = (signal?: AbortSignal) => apiGet<DatasetSummary>('/summary', { signal })

export const getImpressions = (query: PageQuery, signal?: AbortSignal) =>
  apiGet<Page<Impression>>(`/impressions?${toSearch(query)}`, { signal })

export const getEvents = (query: PageQuery & { tag?: string }, signal?: AbortSignal) =>
  apiGet<Page<AdEvent>>(`/events?${toSearch(query)}`, { signal })
