import { Badge } from '@/shared/ui'
import { isViewThrough } from '../lib/tag'

export function EventTag({ tag }: { tag: string }) {
  return (
    <span title={isViewThrough(tag) ? 'View-through' : 'Click-through'}>
      <Badge tone={isViewThrough(tag) ? 'sky' : 'indigo'}>{tag}</Badge>
    </span>
  )
}
