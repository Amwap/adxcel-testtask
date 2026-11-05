import { getEventTypes, type AttributionMode } from '@/shared/api'
import { useRequest } from '@/shared/lib'
import { SegmentedControl, Select } from '@/shared/ui'

type MetricFiltersProps = {
  tag: string
  mode: AttributionMode
  onTagChange: (tag: string) => void
  onModeChange: (mode: AttributionMode) => void
}

const MODES: { value: AttributionMode; label: string; title: string }[] = [
  {
    value: 'first',
    label: 'First impression',
    title: 'An event counts once, for the earliest impression with its uid',
  },
  {
    value: 'all',
    label: 'Every impression',
    title: 'An event counts for every impression that shares its uid',
  },
]

/** How events of a uid with several impressions are attributed. */
export function ModeSwitch({
  mode,
  onChange,
  stacked = false,
}: {
  mode: AttributionMode
  onChange: (mode: AttributionMode) => void
  /** Label above, control at full width: for a filters column. */
  stacked?: boolean
}) {
  return (
    <div
      className={`flex gap-2 text-sm text-slate-600 dark:text-slate-400 ${stacked ? 'flex-col' : 'items-center'}`}
    >
      <span>Duplicate UIDs</span>
      <SegmentedControl
        label="Duplicate UIDs"
        value={mode}
        options={MODES}
        onChange={onChange}
        layout={stacked ? 'fill' : 'inline'}
      />
    </div>
  )
}

/** Event type for EvPM and how events of duplicate uids are attributed. */
export function MetricFilters({ tag, mode, onTagChange, onModeChange }: MetricFiltersProps) {
  const { data } = useRequest('event-types', getEventTypes)
  const tags = data?.tags ?? [tag]

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
        Event type
        <Select
          label="Event type"
          value={tag}
          onChange={(e) => onTagChange(e.target.value)}
          options={tags.map((t) => ({ value: t, label: t }))}
        />
      </label>
      <ModeSwitch mode={mode} onChange={onModeChange} />
    </div>
  )
}
