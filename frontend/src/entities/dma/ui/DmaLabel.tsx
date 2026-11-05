import { dmaLabel } from '../lib/label'

/**
 * `(501) New York, NY` in full, for table cells; the tooltip repeats it for a column
 * too narrow to fit it.
 */
export function DmaLabel({ code, name }: { code: number | string; name?: string | null }) {
  const label = dmaLabel(code, name)
  return <span title={label}>{label}</span>
}
