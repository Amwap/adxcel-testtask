import type { ReactNode } from 'react'
import { Spinner } from './Button'

export type Column<T> = {
  key: string
  header: ReactNode
  cell: (row: T) => ReactNode
  className?: string
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  loading?: boolean
  error?: Error | null
  empty?: ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  error = null,
  empty = 'Nothing found.',
}: DataTableProps<T>) {
  let message: ReactNode = null
  if (error) message = <span className="text-red-600 dark:text-red-400">{error.message}</span>
  else if (!rows) message = <Spinner className="mx-auto size-5 text-indigo-600" />
  else if (rows.length === 0) message = empty

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`px-4 py-3 whitespace-nowrap ${c.className ?? ''}`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          aria-busy={loading}
          className={`divide-y divide-slate-100 transition-opacity dark:divide-slate-800 ${loading && rows ? 'opacity-50' : ''}`}
        >
          {message || !rows ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-500">
                {message}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2.5 whitespace-nowrap ${c.className ?? ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
