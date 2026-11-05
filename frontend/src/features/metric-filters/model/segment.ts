import { dmaLabel } from '@/entities/dma'
import type { Dimension, Exclusions, Segment } from '@/shared/api'

/** URL parameter of each segment dimension: `?dma=501` or `?site=nypost.com`. */
const PARAMS: Record<Dimension, string> = { mm_dma: 'dma', site_id: 'site' }

export function readSegment(get: (name: string) => string): Segment | undefined {
  const dma = get(PARAMS.mm_dma)
  if (/^\d+$/.test(dma)) return { dimension: 'mm_dma', key: dma }
  const site = get(PARAMS.site_id)
  return site ? { dimension: 'site_id', key: site } : undefined
}

/** URL changes that select `segment`, or clear the selection. */
export const segmentParams = (segment: Segment | null): Record<string, string | null> => ({
  [PARAMS.mm_dma]: segment?.dimension === 'mm_dma' ? segment.key : null,
  [PARAMS.site_id]: segment?.dimension === 'site_id' ? segment.key : null,
})

/** URL parameter of the excluded values of each dimension: `?xdma=501,524&xsite=nypost.com`. */
const EXCLUDE_PARAMS: Record<Dimension, string> = { mm_dma: 'xdma', site_id: 'xsite' }

/** The API takes at most this many excluded values of a dimension. */
export const MAX_EXCLUDED = 50

/** Excluded DMAs and sites; none of the dimension of `segment`, which is one value already. */
export function readExclusions(get: (name: string) => string, segment?: Segment): Exclusions {
  const read = (dimension: Dimension) =>
    dimension === segment?.dimension
      ? []
      : get(EXCLUDE_PARAMS[dimension])
          .split(',')
          .filter((v) => (dimension === 'mm_dma' ? /^\d+$/.test(v) : v))
          .slice(0, MAX_EXCLUDED)
  return { mm_dma: read('mm_dma'), site_id: read('site_id') }
}

/** URL change that sets the excluded values of `dimension`. */
export const exclusionParams = (dimension: Dimension, keys: string[]) => ({
  [EXCLUDE_PARAMS[dimension]]: keys.length ? keys.join(',') : null,
})

/** A site domain, or a DMA as `(501) New York, NY` once its `name` is known. */
export const segmentLabel = ({ dimension, key }: Segment, name?: string | null) =>
  dimension === 'site_id' ? key : dmaLabel(key, name)
