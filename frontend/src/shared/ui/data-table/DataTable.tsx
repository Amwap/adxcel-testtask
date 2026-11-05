import { useState, type DragEvent, type PointerEvent, type ReactNode } from 'react'
import type { FilterSpec, TableState } from '@/shared/lib/table'
import { Spinner } from '../Button'
import { Popover } from '../Popover'
import { describeFilter } from './describe'
import { FilterEditor } from './FilterEditor'
import { MIN_WIDTH, useColumnLayout } from './useColumnLayout'

export type Column<T> = {
  /** Also the name of the column's sort key and filter parameters in the API. */
  key: string
  header: string
  /** Tooltip explaining the header. */
  hint?: string
  cell: (row: T) => ReactNode
  className?: string
  /** Initial width in px. */
  width?: number
  filter: FilterSpec
  sortable?: boolean
  /** Raw value for tables filtered and sorted in the browser (see `filterAndSort`). */
  value?: (row: T) => string | number | null
}

type DataTableProps<T> = {
  /** Key the column layout (order, widths) is remembered under. */
  id: string
  columns: Column<T>[]
  rows: T[] | undefined
  rowKey: (row: T) => string | number
  state: TableState
  loading?: boolean
  error?: Error | null
  empty?: ReactNode
  /** Rendered with the same cells as a summary row under the body. */
  footer?: T
  /** Table-wide parameters, shown above the table next to the filter and column controls. */
  toolbar?: ReactNode
  /** Extra classes of the scroll container, e.g. a max height; the header stays in view. */
  scrollClassName?: string
}

const iconButton =
  'inline-flex shrink-0 cursor-pointer items-center justify-center rounded p-1 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700'
const chipButton =
  'inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-slate-300 ring-inset hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800'

const isRight = (c: { className?: string }) => c.className?.includes('text-right') ?? false
// Numbers are usually wanted largest first, labels in alphabetical order
const startsDesc = (spec: FilterSpec) => spec.type === 'number'

function FunnelIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="size-3.5" aria-hidden="true">
      <path d="M2.6 3.6A1 1 0 0 1 3.5 3h13a1 1 0 0 1 .8 1.6L12 11.3V16a1 1 0 0 1-.55.9l-2 1A1 1 0 0 1 8 17v-5.7L2.7 4.6a1 1 0 0 1-.1-1Z" />
    </svg>
  )
}

function SortArrow({ state }: { state: 'asc' | 'desc' | null }) {
  return (
    <span aria-hidden="true" className={`w-3 shrink-0 ${state ? '' : 'opacity-0'}`}>
      {state === 'asc' ? '↑' : '↓'}
    </span>
  )
}

function ColumnsMenu<T>({
  columns,
  onMove,
  isHidden,
  onToggle,
  onReset,
  customized,
}: {
  columns: Column<T>[]
  onMove: (key: string, target: string, after: boolean) => void
  isHidden: (key: string) => boolean
  onToggle: (key: string) => void
  onReset: () => void
  customized: boolean
}) {
  return (
    <Popover
      label="Columns"
      align="end"
      triggerClassName={chipButton}
      trigger={
        <>
          <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
            <path d="M3 4a1 1 0 0 1 1-1h3v14H4a1 1 0 0 1-1-1V4Zm5.5-1h3v14h-3V3ZM13 3h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-3V3Z" />
          </svg>
          Columns
        </>
      }
    >
      {() => (
        <div className="w-60">
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Untick to hide a column. Drag headers to reorder and their edges to resize, or use the
            arrows.
          </p>
          <ol className="space-y-0.5">
            {columns.map((c, i) => {
              const hidden = isHidden(c.key)
              const last = !hidden && columns.filter((o) => !isHidden(o.key)).length === 1
              return (
                <li key={c.key} className="flex items-center gap-1 rounded px-1.5 py-1">
                  <label
                    className={`flex min-w-0 flex-1 items-center gap-2 ${last ? 'cursor-default' : 'cursor-pointer'} ${hidden ? 'text-slate-400 dark:text-slate-500' : ''}`}
                    title={last ? 'At least one column stays visible' : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={!hidden}
                      disabled={last}
                      onChange={() => onToggle(c.key)}
                      className="size-3.5 shrink-0 cursor-pointer accent-indigo-600 disabled:cursor-default"
                    />
                    <span className="min-w-0 truncate">{c.header}</span>
                  </label>
                  <button
                    type="button"
                    className={`${iconButton} disabled:cursor-default disabled:opacity-30`}
                    disabled={i === 0}
                    aria-label={`Move ${c.header} left`}
                    onClick={() => onMove(c.key, columns[i - 1].key, false)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={`${iconButton} disabled:cursor-default disabled:opacity-30`}
                    disabled={i === columns.length - 1}
                    aria-label={`Move ${c.header} right`}
                    onClick={() => onMove(c.key, columns[i + 1].key, true)}
                  >
                    ↓
                  </button>
                </li>
              )
            })}
          </ol>
          <button
            type="button"
            disabled={!customized}
            onClick={onReset}
            className="mt-2 w-full cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-default disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reset columns
          </button>
        </div>
      )}
    </Popover>
  )
}

/**
 * Table with per-column sorting and typed filters (kept in `state`), resizable and
 * reorderable and hideable columns (remembered per browser), and a toolbar for table-wide
 * parameters.
 */
export function DataTable<T>({
  id,
  columns,
  rows,
  rowKey,
  state,
  loading = false,
  error = null,
  empty = 'Nothing found.',
  footer,
  toolbar,
  scrollClassName = '',
}: DataTableProps<T>) {
  const layout = useColumnLayout(id, columns)
  const [live, setLive] = useState<{ key: string; width: number } | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ key: string; after: boolean } | null>(null)

  const widthOf = (c: Column<T>) => (live?.key === c.key ? live.width : layout.widthOf(c))
  const total = layout.visible.reduce((sum, c) => sum + widthOf(c), 0)
  const active = layout.columns.filter((c) => state.filters[c.key])

  let message: ReactNode = null
  if (error) message = <span className="text-red-600 dark:text-red-400">{error.message}</span>
  else if (!rows) message = <Spinner className="mx-auto size-5 text-indigo-600" />
  else if (rows.length === 0) message = empty

  // First direction, the other one, then back to the default order
  const toggleSort = (c: Column<T>) => {
    const first = startsDesc(c.filter)
    const { sort } = state
    if (sort?.key !== c.key) state.setSort({ key: c.key, desc: first })
    else if (sort.desc === first) state.setSort({ key: c.key, desc: !first })
    else state.setSort(null)
  }

  const startResize = (e: PointerEvent<HTMLDivElement>, c: Column<T>) => {
    e.preventDefault()
    const handle = e.currentTarget
    const startX = e.clientX
    const startWidth = widthOf(c)
    let width = startWidth
    handle.setPointerCapture(e.pointerId)
    const onMove = (ev: globalThis.PointerEvent) => {
      width = Math.max(MIN_WIDTH, startWidth + ev.clientX - startX)
      setLive({ key: c.key, width })
    }
    const onUp = () => {
      handle.removeEventListener('pointermove', onMove)
      handle.removeEventListener('pointerup', onUp)
      handle.removeEventListener('pointercancel', onUp)
      if (width !== startWidth) layout.resize(c.key, width)
      setLive(null)
    }
    handle.addEventListener('pointermove', onMove)
    handle.addEventListener('pointerup', onUp)
    handle.addEventListener('pointercancel', onUp)
  }

  const onDragOver = (e: DragEvent<HTMLTableCellElement>, c: Column<T>) => {
    if (!dragKey || dragKey === c.key) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const after = e.clientX > rect.left + rect.width / 2
    if (drop?.key !== c.key || drop.after !== after) setDrop({ key: c.key, after })
  }

  const endDrag = () => {
    setDragKey(null)
    setDrop(null)
  }

  const cellClass = (c: Column<T>) =>
    `overflow-hidden px-3 py-2.5 text-ellipsis whitespace-nowrap ${c.className ?? ''}`

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {toolbar}
          <div className="ml-auto flex items-center gap-2">
            {active.length > 0 && (
              <button type="button" className={chipButton} onClick={state.clearFilters}>
                Clear filters
              </button>
            )}
            <ColumnsMenu
              columns={layout.columns}
              onMove={layout.move}
              isHidden={layout.isHidden}
              onToggle={layout.toggle}
              onReset={layout.reset}
              customized={layout.customized}
            />
          </div>
        </div>
        {active.length > 0 && (
          <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
            {active.map((c) => (
              <li
                key={c.key}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 py-0.5 pr-1 pl-2.5 text-xs text-indigo-900 ring-1 ring-indigo-200 ring-inset dark:bg-indigo-950/60 dark:text-indigo-100 dark:ring-indigo-800"
              >
                <span className="font-medium">{c.header}:</span>
                <span className="max-w-64 truncate">{describeFilter(c.filter, state.filters[c.key])}</span>
                <button
                  type="button"
                  className="cursor-pointer rounded-full px-1 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                  aria-label={`Remove the ${c.header} filter`}
                  onClick={() => state.setFilter(c.key, null)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`overflow-auto ${scrollClassName}`}>
        <table className="table-fixed text-left text-sm" style={{ width: `max(100%, ${total}px)` }}>
          <colgroup>
            {layout.visible.map((c) => (
              <col key={c.key} style={{ width: widthOf(c) }} />
            ))}
            {/* Takes the space left over when the columns are narrower than the table */}
            <col />
          </colgroup>
          <thead className="sticky top-0 z-20 bg-slate-50 text-xs font-medium tracking-wide text-slate-500 uppercase shadow-[inset_0_-1px_0] shadow-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:shadow-slate-800">
            <tr>
              {layout.visible.map((c) => {
                const sorted = state.sort?.key === c.key ? (state.sort.desc ? 'desc' : 'asc') : null
                const filtered = Boolean(state.filters[c.key])
                const sortable = c.sortable ?? true
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={sorted ? (sorted === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={`relative p-0 ${dragKey === c.key ? 'opacity-50' : ''}`}
                    onDragOver={(e) => onDragOver(e, c)}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (dragKey && drop) layout.move(dragKey, drop.key, drop.after)
                      endDrag()
                    }}
                  >
                    <div className={`flex items-center gap-1 py-1.5 pr-2 pl-3 ${isRight(c) ? 'justify-end' : 'justify-between'}`}>
                      <div
                        draggable
                        title={c.hint ? `${c.hint}. Drag to move the column.` : 'Drag to move the column'}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', c.key)
                          e.dataTransfer.effectAllowed = 'move'
                          setDragKey(c.key)
                        }}
                        onDragEnd={endDrag}
                        className="flex min-w-0 cursor-grab items-center gap-1 active:cursor-grabbing"
                      >
                        {sortable ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(c)}
                            className={`min-w-0 cursor-pointer truncate uppercase hover:text-slate-900 dark:hover:text-white ${sorted ? 'text-slate-900 dark:text-white' : ''}`}
                          >
                            {c.header}
                          </button>
                        ) : (
                          <span className="min-w-0 truncate">{c.header}</span>
                        )}
                        {sortable && <SortArrow state={sorted} />}
                      </div>
                      <Popover
                        label={`Filter by ${c.header}`}
                        align={isRight(c) ? 'end' : 'start'}
                        triggerClassName={`${iconButton} ${filtered ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'}`}
                        trigger={<FunnelIcon />}
                      >
                        {(close) => (
                          <>
                            <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                              {c.header}
                            </p>
                            <FilterEditor
                              spec={c.filter}
                              value={state.filters[c.key]}
                              onApply={(v) => {
                                state.setFilter(c.key, v)
                                close()
                              }}
                            />
                          </>
                        )}
                      </Popover>
                    </div>
                    {drop?.key === c.key && (
                      <span
                        aria-hidden="true"
                        className={`absolute inset-y-0 w-0.5 bg-indigo-500 ${drop.after ? 'right-0' : 'left-0'}`}
                      />
                    )}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Resize ${c.header}`}
                      title="Drag to resize, double-click to reset"
                      onPointerDown={(e) => startResize(e, c)}
                      onDoubleClick={() => layout.resetWidth(c.key)}
                      className="group absolute inset-y-0 -right-1.5 z-10 flex w-3 cursor-col-resize justify-center"
                    >
                      <span
                        className={`h-full w-px ${live?.key === c.key ? 'bg-indigo-500' : 'bg-slate-200 group-hover:bg-indigo-400 dark:bg-slate-700'}`}
                      />
                    </div>
                  </th>
                )
              })}
              <th aria-hidden="true" className="p-0" />
            </tr>
          </thead>
          <tbody
            aria-busy={loading}
            className={`divide-y divide-slate-100 transition-opacity dark:divide-slate-800 ${loading && rows ? 'opacity-50' : ''}`}
          >
            {message || !rows ? (
              <tr>
                <td colSpan={layout.visible.length + 1} className="px-4 py-12 text-center text-slate-500">
                  {message}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {layout.visible.map((c) => (
                    <td key={c.key} className={cellClass(c)}>
                      {c.cell(row)}
                    </td>
                  ))}
                  <td />
                </tr>
              ))
            )}
          </tbody>
          {footer && rows && rows.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold dark:border-slate-800 dark:bg-slate-900/60">
              <tr>
                {layout.visible.map((c) => (
                  <td key={c.key} className={cellClass(c)}>
                    {c.cell(footer)}
                  </td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </>
  )
}
