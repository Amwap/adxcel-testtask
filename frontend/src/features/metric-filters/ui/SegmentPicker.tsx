import { useState } from 'react'
import { useDmaNames } from '@/entities/dma'
import type { Dimension, Exclusions, Segment } from '@/shared/api'
import { formatNumber } from '@/shared/lib'
import { Combobox, SegmentedControl } from '@/shared/ui'
import { MAX_EXCLUDED } from '../model/segment'
import { searchSegments, segmentOptionLabel } from '../model/segmentLookup'
import { useSegmentRow } from '../model/useSegmentRow'

/**
 * Smaller segments are left out of the list: their hourly rates are mostly noise.
 * They can still be opened from the Aggregates table.
 */
export const MIN_SEGMENT_IMPRESSIONS = 5_000

type Scope = Dimension | 'all'

const SCOPES: { value: Scope; label: string; title: string }[] = [
  { value: 'all', label: 'Campaign', title: 'All impressions' },
  { value: 'mm_dma', label: 'DMA', title: 'One designated market area' },
  { value: 'site_id', label: 'Site', title: 'One site' },
]

const DIMENSIONS: { value: Dimension; label: string; placeholder: string }[] = [
  { value: 'mm_dma', label: 'DMAs', placeholder: 'Exclude DMAs…' },
  { value: 'site_id', label: 'sites', placeholder: 'Exclude sites…' },
]

type SegmentPickerProps = {
  segment: Segment | undefined
  onChange: (segment: Segment | null) => void
  /** DMAs and sites left out; only of the dimensions other than the picked scope. */
  excluded?: Exclusions
  onExcludedChange?: (dimension: Dimension, keys: string[]) => void
  /** Label above, controls at full width: for a filters column. */
  stacked?: boolean
}

/**
 * Narrows metrics to one DMA or site, searched among the ones with enough volume
 * (a DMA by a part of its name or a code prefix, a site by a part of the domain),
 * and leaves out any DMAs and sites: of both dimensions campaign-wide, of the other one
 * within a segment.
 */
export function SegmentPicker({
  segment,
  onChange,
  excluded,
  onExcludedChange,
  stacked = false,
}: SegmentPickerProps) {
  // A dimension picked before any of its values is, so the value list can show
  const [pending, setPending] = useState<Dimension | null>(null)
  const scope: Scope = segment?.dimension ?? pending ?? 'all'

  const selected = useSegmentRow(segment)
  const dmaNames = useDmaNames()

  const pickScope = (next: Scope) => {
    setPending(next === 'all' ? null : next)
    if (next !== segment?.dimension) onChange(null)
    // A single value of a dimension leaves nothing of it to exclude
    if (next !== 'all') onExcludedChange?.(next, [])
  }
  const excludable = DIMENSIONS.filter((d) => d.value !== scope)

  return (
    <div
      className={`flex gap-2 text-sm text-slate-600 dark:text-slate-400 ${stacked ? 'flex-col' : 'flex-wrap items-center'}`}
    >
      <span>Segment</span>
      <SegmentedControl
        label="Segment"
        value={scope}
        options={SCOPES}
        onChange={pickScope}
        layout={stacked ? 'fill' : 'inline'}
      />
      {scope !== 'all' && (
        <Combobox
          // Fresh search text and picked labels for each dimension
          key={scope}
          label={scope === 'mm_dma' ? 'DMA' : 'Site'}
          className={stacked ? 'w-full' : 'w-72'}
          title={`Segments with at least ${formatNumber(MIN_SEGMENT_IMPRESSIONS)} impressions, by volume`}
          search={searchSegments(scope, MIN_SEGMENT_IMPRESSIONS)}
          labelOf={(key) => segmentOptionLabel(scope, key, selected?.name)}
          placeholder={scope === 'mm_dma' ? 'Search a city or code…' : 'Search a domain…'}
          value={segment ? [segment.key] : []}
          onChange={([key]) => onChange(key ? { dimension: scope, key } : null)}
        />
      )}
      {excluded && onExcludedChange && (
        <>
          <span className={stacked ? 'mt-1' : ''}>Exclude</span>
          {excludable.map((d) => (
            <Combobox
              key={d.value}
              multiple
              label={`Excluded ${d.label}`}
              className={stacked ? 'w-full' : 'w-72'}
              title={`Impressions of these ${d.label} are left out (up to ${MAX_EXCLUDED})`}
              search={searchSegments(d.value)}
              labelOf={(key) => segmentOptionLabel(d.value, key, dmaNames?.get(Number(key)))}
              placeholder={d.placeholder}
              value={excluded[d.value]}
              onChange={(keys) => onExcludedChange(d.value, keys.slice(0, MAX_EXCLUDED))}
            />
          ))}
        </>
      )}
    </div>
  )
}
