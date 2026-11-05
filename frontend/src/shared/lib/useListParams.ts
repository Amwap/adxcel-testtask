import { useSearchParams } from 'react-router'

export const PAGE_SIZES = [25, 50, 100] as const

const toPositiveInt = (value: string | null, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

/** Page, page size, search and extra filters kept in the URL, so they survive reloads. */
export function useListParams() {
  const [params, setParams] = useSearchParams()
  const sizeParam = toPositiveInt(params.get('size'), PAGE_SIZES[0])
  const pageSize = (PAGE_SIZES as readonly number[]).includes(sizeParam) ? sizeParam : PAGE_SIZES[0]

  const update = (changes: Record<string, string | number | null>, resetPage = true) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(changes)) {
        if (v === null || v === '' || (k === 'page' && v === 1)) next.delete(k)
        else next.set(k, String(v))
      }
      if (resetPage && !('page' in changes)) next.delete('page')
      return next
    })

  return {
    page: toPositiveInt(params.get('page'), 1),
    pageSize,
    q: params.get('q') ?? '',
    get: (name: string) => params.get(name) ?? '',
    setPage: (page: number) => update({ page }, false),
    setPageSize: (size: number) => update({ size: size === PAGE_SIZES[0] ? null : size }),
    setQuery: (q: string) => update({ q: q.trim() }),
    setFilter: (name: string, value: string) => update({ [name]: value }),
  }
}
