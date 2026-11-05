import { getAggregates, type Segment } from '@/shared/api'
import { useRequest } from '@/shared/lib'
import { DEFAULT_TAG } from './useMetricParams'

/**
 * The aggregate row of `segment` (DMA name, impressions), for labels.
 * The `key` filter is a code prefix / site substring, so the exact row is picked out of the matches.
 */
export function useSegmentRow(segment: Segment | undefined) {
  const { data } = useRequest(`segment-row|${segment?.dimension}|${segment?.key}`, (signal) =>
    segment
      ? getAggregates(
          segment.dimension,
          { tag: DEFAULT_TAG, mode: 'first', page: 1, pageSize: 100, filters: [['key', segment.key]] },
          signal,
        )
      : Promise.resolve(null),
  )
  // Data of the previous segment stays while the next one loads; it must not label the new one
  return data?.items.find((r) => r.key === segment?.key)
}
