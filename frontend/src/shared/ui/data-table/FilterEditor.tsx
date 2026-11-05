import { useState, type FormEvent, type ReactNode } from 'react'
import type { FilterSpec, FilterValue, RangeValue } from '@/shared/lib/table'
import { Combobox } from '../Combobox'

const field =
  'block w-full rounded-md border-0 bg-white px-2.5 py-1.5 text-sm text-slate-900 ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-600 focus:outline-none dark:bg-slate-950 dark:text-white dark:ring-slate-700 dark:[color-scheme:dark] dark:focus:ring-indigo-500'
const small = 'cursor-pointer rounded-md px-2.5 py-1.5 text-sm font-medium'

const TEXT_HINT = { text: 'Contains…', prefix: 'Starts with…' }

function Labeled({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs text-slate-500 dark:text-slate-400">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  )
}

function RangeEditor({
  type,
  value,
  onChange,
}: {
  type: 'number' | 'datetime'
  value: RangeValue
  onChange: (v: RangeValue) => void
}) {
  const input = type === 'number' ? { type: 'number', step: 'any' } : { type: 'datetime-local' }
  const [low, high] = type === 'number' ? ['Min', 'Max'] : ['From, UTC', 'To, UTC']
  return (
    <div className={`grid gap-2 ${type === 'number' ? 'w-56 grid-cols-2' : 'w-56'}`}>
      <Labeled label={low}>
        <input
          {...input}
          autoFocus
          className={field}
          value={value.min}
          onChange={(e) => onChange({ ...value, min: e.target.value })}
        />
      </Labeled>
      <Labeled label={high}>
        <input
          {...input}
          className={field}
          value={value.max}
          onChange={(e) => onChange({ ...value, max: e.target.value })}
        />
      </Labeled>
    </div>
  )
}

function EnumEditor({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const shown = options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
  const toggle = (v: string, on: boolean) =>
    onChange(on ? [...value, v] : value.filter((x) => x !== v))

  return (
    <div className="w-60">
      {options.length > 8 && (
        <input
          type="search"
          autoFocus
          aria-label="Find an option"
          placeholder="Find…"
          className={`${field} mb-2`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}
      <div className="max-h-60 space-y-0.5 overflow-y-auto">
        {shown.map((o) => (
          <label
            key={o.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <input
              type="checkbox"
              className="size-4 accent-indigo-600"
              checked={value.includes(o.value)}
              onChange={(e) => toggle(o.value, e.target.checked)}
            />
            {o.label}
          </label>
        ))}
        {shown.length === 0 && <p className="px-1.5 py-1 text-slate-500">No options</p>}
      </div>
    </div>
  )
}

function initial(spec: FilterSpec, value: FilterValue | undefined): FilterValue {
  if (value !== undefined) return value
  if (spec.type === 'enum' || spec.type === 'lookup') return []
  if (spec.type === 'number' || spec.type === 'datetime') return { min: '', max: '' }
  return ''
}

/** Editor for one column filter; changes apply on submit (Enter or the Apply button). */
export function FilterEditor({
  spec,
  value,
  onApply,
}: {
  spec: FilterSpec
  value: FilterValue | undefined
  onApply: (value: FilterValue | null) => void
}) {
  const [draft, setDraft] = useState(() => initial(spec, value))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    onApply(draft)
  }

  return (
    <form onSubmit={submit}>
      {spec.type === 'enum' ? (
        <EnumEditor options={spec.options} value={draft as string[]} onChange={setDraft} />
      ) : spec.type === 'lookup' ? (
        <Combobox
          label="Filter values"
          multiple
          inline
          autoFocus
          className="w-72"
          search={spec.search}
          labelOf={spec.labelOf}
          placeholder={spec.placeholder ?? 'Search…'}
          value={draft as string[]}
          onChange={setDraft}
        />
      ) : spec.type === 'number' || spec.type === 'datetime' ? (
        <RangeEditor type={spec.type} value={draft as RangeValue} onChange={setDraft} />
      ) : (
        <input
          type="search"
          autoFocus
          aria-label="Filter value"
          maxLength={100}
          placeholder={spec.placeholder ?? TEXT_HINT[spec.type]}
          className={`${field} w-56`}
          value={draft as string}
          onChange={(e) => setDraft(e.target.value)}
        />
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onApply(null)}
          className={`${small} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800`}
        >
          Clear
        </button>
        <button
          type="submit"
          className={`${small} bg-indigo-600 text-white hover:bg-indigo-500 dark:bg-indigo-500 dark:hover:bg-indigo-400`}
        >
          Apply
        </button>
      </div>
    </form>
  )
}
