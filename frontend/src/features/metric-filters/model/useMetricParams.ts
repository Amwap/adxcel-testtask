import type { AttributionMode, Segment } from '@/shared/api'
import { useListParams } from '@/shared/lib'
import { readSegment, segmentParams } from './segment'

export const DEFAULT_TAG = 'fclick'
export const DEFAULT_MODE: AttributionMode = 'first'

/** Link to the Trends page narrowed to one segment, keeping the attribution mode. */
export function segmentTrendsUrl(segment: Segment, mode: AttributionMode) {
  const changes = { ...segmentParams(segment), mode: mode === DEFAULT_MODE ? null : mode }
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(changes)) if (v) search.set(k, v)
  return `/trends?${search}`
}

/** Event type, attribution mode and segment, kept in the URL next to the list params. */
export function useMetricParams() {
  const list = useListParams()
  const mode: AttributionMode = list.get('mode') === 'all' ? 'all' : DEFAULT_MODE

  return {
    ...list,
    tag: list.get('tag') || DEFAULT_TAG,
    mode,
    /** One DMA or site, or the whole campaign when undefined. */
    segment: readSegment(list.get),
    setTag: (tag: string) => list.setFilter('tag', tag === DEFAULT_TAG ? '' : tag),
    setMode: (next: AttributionMode) => list.setFilter('mode', next === DEFAULT_MODE ? '' : next),
    setSegment: (next: Segment | null) => list.setFilters(segmentParams(next)),
  }
}
