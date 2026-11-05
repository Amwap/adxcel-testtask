import type { AttributionMode } from '@/shared/api'
import { useListParams } from '@/shared/lib'

export const DEFAULT_TAG = 'fclick'
export const DEFAULT_MODE: AttributionMode = 'first'

/** Event type and attribution mode, kept in the URL next to the list params. */
export function useMetricParams() {
  const list = useListParams()
  const mode: AttributionMode = list.get('mode') === 'all' ? 'all' : DEFAULT_MODE

  return {
    ...list,
    tag: list.get('tag') || DEFAULT_TAG,
    mode,
    setTag: (tag: string) => list.setFilter('tag', tag === DEFAULT_TAG ? '' : tag),
    setMode: (next: AttributionMode) => list.setFilter('mode', next === DEFAULT_MODE ? '' : next),
  }
}
