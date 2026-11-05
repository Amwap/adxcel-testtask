import { dmaLabels, type DmaNames } from '@/entities/dma'
import { getSegmentOptions, type Dimension } from '@/shared/api'
import { formatCompact, type FilterSpec } from '@/shared/lib'
import type { ComboOption, ComboSearch } from '@/shared/ui'

const LIMIT = 50

/** `(501) New York, NY` for a DMA (shortened, full in `title`), the domain for a site. */
export const segmentOptionLabel = (
  dimension: Dimension,
  key: string,
  name?: string | null,
): Pick<ComboOption, 'label' | 'title'> =>
  dimension === 'mm_dma' ? dmaLabels(key, name) : { label: key }

/**
 * Search of DMAs (by a part of the name or a code prefix) or sites (by a part of the domain),
 * by impressions descending.
 */
export const searchSegments =
  (dimension: Dimension, minImpressions?: number): ComboSearch =>
  async (q, signal) => {
    const options = await getSegmentOptions(dimension, { q, limit: LIMIT, minImpressions }, signal)
    return options.map((o) => ({
      value: o.key,
      ...segmentOptionLabel(dimension, o.key, o.name),
      hint: formatCompact(o.impressions),
    }))
  }

/** Column filter that picks exact DMAs or sites from a searchable list. */
export const segmentFilter = (dimension: Dimension, dmaNames?: DmaNames): FilterSpec => ({
  type: 'lookup',
  search: searchSegments(dimension),
  labelOf: (key) => segmentOptionLabel(dimension, key, dmaNames?.get(Number(key))),
  placeholder: dimension === 'mm_dma' ? 'City or code…' : 'Part of the domain…',
})
