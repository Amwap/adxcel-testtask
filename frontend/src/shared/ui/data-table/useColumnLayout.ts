import { useState } from 'react'

export const DEFAULT_WIDTH = 160
export const MIN_WIDTH = 64

type Layout = { order: string[]; widths: Record<string, number>; hidden: string[] }

const EMPTY: Layout = { order: [], widths: {}, hidden: [] }

const storageKey = (id: string) => `table-layout:${id}`

function load(id: string): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(id)) ?? 'null') as Partial<Layout> | null
    return {
      order: Array.isArray(saved?.order) ? saved.order : [],
      widths: saved?.widths && typeof saved.widths === 'object' ? saved.widths : {},
      hidden: Array.isArray(saved?.hidden) ? saved.hidden : [],
    }
  } catch {
    return EMPTY
  }
}

function save(id: string, layout: Layout) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(layout))
  } catch {
    // Storage may be unavailable (private mode); the layout then lasts for the visit
  }
}

/**
 * Column order, widths and visibility of a table, remembered per browser under the table `id`.
 * Columns missing from the saved order (new ones) keep their place at the end and are shown.
 */
export function useColumnLayout<C extends { key: string; width?: number }>(id: string, columns: C[]) {
  const [layout, setLayout] = useState(() => load(id))

  const update = (next: Layout) => {
    setLayout(next)
    save(id, next)
  }

  const known = layout.order.filter((k) => columns.some((c) => c.key === k))
  const order = [...known, ...columns.map((c) => c.key).filter((k) => !known.includes(k))]
  const ordered = order.map((k) => columns.find((c) => c.key === k)!)
  const widthOf = (c: C) => layout.widths[c.key] ?? c.width ?? DEFAULT_WIDTH
  const isHidden = (key: string) => layout.hidden.includes(key)
  const visible = ordered.filter((c) => !isHidden(c.key))

  return {
    /** All columns in order, hidden ones included. */
    columns: ordered,
    visible,
    isHidden,
    widthOf,
    resize: (key: string, width: number) =>
      update({ ...layout, widths: { ...layout.widths, [key]: Math.max(MIN_WIDTH, Math.round(width)) } }),
    resetWidth: (key: string) => {
      const widths = { ...layout.widths }
      delete widths[key]
      update({ ...layout, widths })
    },
    /** Moves `key` to the position of `target`, before or after it. */
    move: (key: string, target: string, after: boolean) => {
      if (key === target) return
      const next = order.filter((k) => k !== key)
      next.splice(next.indexOf(target) + (after ? 1 : 0), 0, key)
      update({ ...layout, order: next })
    },
    /** Hides or shows a column; the last visible one stays. */
    toggle: (key: string) => {
      if (isHidden(key)) update({ ...layout, hidden: layout.hidden.filter((k) => k !== key) })
      else if (visible.length > 1) update({ ...layout, hidden: [...layout.hidden, key] })
    },
    reset: () => update(EMPTY),
    customized:
      layout.order.length > 0 || Object.keys(layout.widths).length > 0 || layout.hidden.length > 0,
  }
}
