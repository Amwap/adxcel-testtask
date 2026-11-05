import { getDmaRegions } from '@/shared/api'
import { useRequest } from '@/shared/lib'

export type DmaNames = Map<number, string>

// The list is static, so it is loaded once per page load and shared by every caller
let names: Promise<DmaNames> | null = null

const load = () =>
  (names ??= getDmaRegions().then(
    (regions) => new Map(regions.map((r) => [r.code, r.name])),
    (e: unknown) => {
      names = null
      throw e
    },
  ))

/** DMA names by code; undefined while loading. */
export function useDmaNames(): DmaNames | undefined {
  return useRequest('dma-regions', load).data
}
