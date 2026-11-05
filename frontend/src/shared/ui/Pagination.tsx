import { formatNumber } from '@/shared/lib'
import { Select } from './Select'

type PaginationProps = {
  page: number
  pageSize: number
  total: number
  pageSizes: readonly number[]
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

type PageItem = number | 'gap'

/** First, last and the pages around the current one, with gaps in between. */
function pageItems(page: number, pages: number): PageItem[] {
  const shown = [...new Set([1, page - 1, page, page + 1, pages])]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b)
  const items: PageItem[] = []
  shown.forEach((p, i) => {
    if (i > 0 && p - shown[i - 1] > 1) items.push('gap')
    items.push(p)
  })
  return items
}

const navButton =
  'inline-flex min-w-9 cursor-pointer items-center justify-center rounded-lg px-2.5 py-1.5 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40'
const idle = 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
const current = 'bg-indigo-600 text-white dark:bg-indigo-500'

export function Pagination({
  page,
  pageSize,
  total,
  pageSizes,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800">
      <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
        <Select
          label="Rows per page"
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          options={pageSizes.map((s) => ({ value: String(s), label: `${s} / page` }))}
          className="py-1.5"
        />
        <span className="tabular-nums">
          {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
        </span>
      </div>

      <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className={`${navButton} ${idle}`}
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          ‹
        </button>
        {pageItems(page, pages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              aria-current={p === page ? 'page' : undefined}
              onClick={() => onPageChange(p)}
              className={`${navButton} ${p === page ? current : idle}`}
            >
              {formatNumber(p)}
            </button>
          ),
        )}
        <button
          type="button"
          className={`${navButton} ${idle}`}
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          ›
        </button>
      </nav>
    </div>
  )
}
