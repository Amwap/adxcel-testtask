import { dmaLabel } from '@/entities/dma'
import type { Dimension, Segment } from '@/shared/api'

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

/** A site domain, or a DMA as `(501) New York, NY` once its `name` is known. */
export const segmentLabel = ({ dimension, key }: Segment, name?: string | null) =>
  dimension === 'site_id' ? key : dmaLabel(key, name)
