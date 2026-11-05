import { useState } from 'react'
import type { Dimension, Segment } from '@/shared/api'
import { formatNumber } from '@/shared/lib'
import { Combobox, SegmentedControl } from '@/shared/ui'
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

type SegmentPickerProps = {
  segment: Segment | undefined
  onChange: (segment: Segment | null) => void
  /** Label above, controls at full width: for a filters column. */
  stacked?: boolean
}

/**
 * Narrows metrics to one DMA or site, searched among the ones with enough volume
 * (a DMA by a part of its name or a code prefix, a site by a part of the domain).
 */
export function SegmentPicker({ segment, onChange, stacked = false }: SegmentPickerProps) {
  // A dimension picked before any of its values is, so the value list can show
  const [pending, setPending] = useState<Dimension | null>(null)
  const scope: Scope = segment?.dimension ?? pending ?? 'all'

  const selected = useSegmentRow(segment)

  const pickScope = (next: Scope) => {
    setPending(next === 'all' ? null : next)
    if (next !== segment?.dimension) onChange(null)
  }

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
    </div>
  )
}
