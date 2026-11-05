import type { SelectHTMLAttributes } from 'react'

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  /** `title` is shown on hover, e.g. the full text of a shortened label. */
  options: { value: string; label: string; title?: string }[]
}

export function Select({ label, options, className = '', ...props }: SelectProps) {
  return (
    <select
      aria-label={label}
      className={`block cursor-pointer rounded-lg border-0 bg-white py-2 pr-8 pl-3 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset focus:ring-2 focus:ring-indigo-600 focus:outline-none dark:bg-slate-900 dark:text-white dark:ring-slate-700 dark:focus:ring-indigo-500 ${className}`}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} title={o.title}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
