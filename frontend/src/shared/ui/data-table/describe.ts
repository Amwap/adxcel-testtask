import type { FilterSpec, FilterValue } from '@/shared/lib/table'

const time = (raw: string) => raw.replace('T', ' ')

/** Short human summary of an active filter, e.g. `≥ 100`, `iOS, Android`. */
export function describeFilter(spec: FilterSpec, value: FilterValue): string {
  if (Array.isArray(value)) {
    const labels =
      spec.type === 'enum'
        ? value.map((v) => spec.options.find((o) => o.value === v)?.label ?? v)
        : spec.type === 'lookup' && spec.labelOf
          ? value.map((v) => spec.labelOf!(v).label)
          : value
    return labels.length > 3 ? `${labels.slice(0, 2).join(', ')} +${labels.length - 2}` : labels.join(', ')
  }
  if (typeof value === 'string') return spec.type === 'prefix' ? `${value}…` : `“${value}”`
  const fmt = spec.type === 'datetime' ? time : (s: string) => s
  if (value.min && value.max) return `${fmt(value.min)} – ${fmt(value.max)}`
  return value.min ? `≥ ${fmt(value.min)}` : `≤ ${fmt(value.max)}`
}
