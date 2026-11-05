import { useSearchParams } from 'react-router'
import type { ComboOption, ComboSearch } from '@/shared/ui/Combobox'

/**
 * Column filter kinds; each maps to the query parameters the API takes for it
 * (see backend `app/services/table.py`), and the page URL uses the same names:
 * text/prefix `key=…`, number `key_min`/`key_max`, datetime `key_from`/`key_to`,
 * enum and lookup a repeated `key=…`.
 */
export type FilterSpec =
  | { type: 'text' | 'prefix'; placeholder?: string }
  | { type: 'number' }
  | { type: 'datetime' }
  | { type: 'enum'; options: { value: string; label: string }[] }
  /** Exact values picked from a searchable list too long to show at once (DMAs, sites). */
  | {
      type: 'lookup'
      search: ComboSearch
      /** Label of a value picked earlier, e.g. read from the URL. */
      labelOf?: (value: string) => Pick<ComboOption, 'label' | 'title'>
      placeholder?: string
    }

export type RangeValue = { min: string; max: string }
/** Datetimes are `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, UTC like the rest of the data. */
export type FilterValue = string | RangeValue | string[]
export type Filters = Record<string, FilterValue>
export type SortState = { key: string; desc: boolean }

export type FilterableColumn = { key: string; filter: FilterSpec }

const rangeKeys = (key: string, spec: FilterSpec) =>
  spec.type === 'number' ? [`${key}_min`, `${key}_max`] : [`${key}_from`, `${key}_to`]

/** URL / API parameter names a column filter occupies. */
export const filterParams = (key: string, spec: FilterSpec) =>
  spec.type === 'number' || spec.type === 'datetime' ? rangeKeys(key, spec) : [key]

export function isActive(value: FilterValue | undefined): value is FilterValue {
  if (value === undefined) return false
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return value.min !== '' || value.max !== ''
}

function readFilter(params: URLSearchParams, key: string, spec: FilterSpec): FilterValue | undefined {
  let value: FilterValue
  if (spec.type === 'enum' || spec.type === 'lookup') value = params.getAll(key)
  else if (spec.type === 'number' || spec.type === 'datetime') {
    const [min, max] = rangeKeys(key, spec)
    value = { min: params.get(min) ?? '', max: params.get(max) ?? '' }
  } else value = params.get(key) ?? ''
  return isActive(value) ? value : undefined
}

function writeFilter(params: URLSearchParams, key: string, spec: FilterSpec, value: FilterValue | null) {
  for (const name of filterParams(key, spec)) params.delete(name)
  if (!value || !isActive(value)) return
  if (Array.isArray(value)) value.forEach((v) => params.append(key, v))
  else if (typeof value === 'string') params.set(key, value.trim())
  else {
    const [min, max] = rangeKeys(key, spec)
    if (value.min !== '') params.set(min, value.min)
    if (value.max !== '') params.set(max, value.max)
  }
}

export type TableState = {
  sort: SortState | null
  /** Sort applied when none is chosen, shown in the header but kept out of the URL. */
  defaultSort: SortState | null
  filters: Filters
  setSort: (sort: SortState | null) => void
  setFilter: (key: string, value: FilterValue | null) => void
  clearFilters: () => void
  /** Filter and sort parameters for the API, in the order they appear in the URL. */
  query: [string, string][]
}

/**
 * Per-column filters and sorting kept in the URL (`sort`, `order` and the filter params).
 * Any change goes back to the first page.
 */
export function useTableState(
  columns: FilterableColumn[],
  defaultSort: SortState | null = null,
): TableState {
  const [params, setParams] = useSearchParams()

  const filters: Filters = {}
  for (const c of columns) {
    const value = readFilter(params, c.key, c.filter)
    if (value) filters[c.key] = value
  }
  const sortKey = params.get('sort')
  const sort =
    sortKey && columns.some((c) => c.key === sortKey)
      ? { key: sortKey, desc: params.get('order') === 'desc' }
      : defaultSort

  const query: [string, string][] = []
  for (const c of columns) {
    for (const name of filterParams(c.key, c.filter)) {
      for (const v of params.getAll(name)) query.push([name, v])
    }
  }
  if (sort) query.push(['sort', sort.key], ['order', sort.desc ? 'desc' : 'asc'])

  const update = (change: (next: URLSearchParams) => void) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      change(next)
      next.delete('page')
      return next
    })

  const specOf = (key: string) => columns.find((c) => c.key === key)?.filter

  return {
    sort,
    defaultSort,
    filters,
    query,
    setSort: (next) =>
      update((p) => {
        const isDefault =
          !next || (defaultSort && next.key === defaultSort.key && next.desc === defaultSort.desc)
        if (isDefault) {
          p.delete('sort')
          p.delete('order')
        } else {
          p.set('sort', next.key)
          p.set('order', next.desc ? 'desc' : 'asc')
        }
      }),
    setFilter: (key, value) =>
      update((p) => {
        const spec = specOf(key)
        if (spec) writeFilter(p, key, spec, value)
      }),
    clearFilters: () =>
      update((p) => {
        for (const c of columns) writeFilter(p, c.key, c.filter, null)
      }),
  }
}

/** Upper bounds cover their whole last unit, as on the server: a date its day, a minute its minute. */
function timeBound(raw: string, upper: boolean) {
  const t = Date.parse(raw.length === 10 ? `${raw}T00:00Z` : `${raw}Z`)
  if (!upper || Number.isNaN(t)) return { t, exclusive: false }
  const step = raw.length === 10 ? 86_400_000 : raw.length === 16 ? 60_000 : 0
  return { t: t + step, exclusive: step > 0 }
}

type Valued<T> = FilterableColumn & {
  /** Raw value to filter and sort by; datetimes as UTC milliseconds. */
  value?: (row: T) => string | number | null
}

function matches(v: string | number | null, spec: FilterSpec, f: FilterValue) {
  if (v === null) return false
  if (Array.isArray(f)) return f.includes(String(v))
  if (typeof f === 'string') {
    const s = String(v).toLowerCase()
    const q = f.trim().toLowerCase()
    return spec.type === 'prefix' ? s.startsWith(q) : s.includes(q)
  }
  const n = Number(v)
  if (spec.type === 'datetime') {
    const low = f.min ? timeBound(f.min, false).t : -Infinity
    const high = f.max ? timeBound(f.max, true) : { t: Infinity, exclusive: false }
    return n >= low && (high.exclusive ? n < high.t : n <= high.t)
  }
  return (f.min === '' || n >= Number(f.min)) && (f.max === '' || n <= Number(f.max))
}

/** Client-side counterpart of the server filters, for tables that have all rows at hand. */
export function filterAndSort<T>(
  rows: T[],
  columns: Valued<T>[],
  filters: Filters,
  sort: SortState | null,
): T[] {
  const active = columns.filter((c) => c.value && filters[c.key])
  let result = active.length
    ? rows.filter((r) => active.every((c) => matches(c.value!(r), c.filter, filters[c.key])))
    : rows
  const by = sort && columns.find((c) => c.key === sort.key)?.value
  if (by) {
    const dir = sort.desc ? -1 : 1
    result = [...result].sort((a, b) => {
      const x = by(a)
      const y = by(b)
      if (x === y) return 0
      // Empty values last in both directions
      if (x === null) return 1
      if (y === null) return -1
      return (x < y ? -1 : 1) * dir
    })
  }
  return result
}
