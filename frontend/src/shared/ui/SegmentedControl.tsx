import type { ReactNode } from 'react'

type SegmentedControlProps<T extends string> = {
  label: string
  value: T
  /** With an `icon` the option shows only the icon; its label becomes the accessible name. */
  options: { value: T; label: string; title?: string; icon?: ReactNode }[]
  onChange: (value: T) => void
  /** `fill` stretches to the container width; `vertical` stacks the options. */
  layout?: 'inline' | 'fill' | 'vertical'
}

const LAYOUTS = {
  inline: 'inline-flex',
  fill: 'flex w-full',
  vertical: 'inline-flex flex-col',
}

/** A small single-choice button group (radio semantics). */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  layout = 'inline',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={`${LAYOUTS[layout]} rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200 ring-inset dark:bg-slate-800 dark:ring-slate-700`}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={o.title ?? (o.icon ? o.label : undefined)}
            aria-label={o.icon ? o.label : undefined}
            onClick={() => onChange(o.value)}
            className={`${layout === 'fill' ? 'flex-1' : ''} cursor-pointer rounded-md ${o.icon ? 'p-1.5' : layout === 'fill' ? 'px-2 py-1.5' : 'px-3 py-1.5'} text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              active
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            {o.icon ?? o.label}
          </button>
        )
      })}
    </div>
  )
}
