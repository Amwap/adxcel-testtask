import { useState } from 'react'

function load(key: string, fallback: boolean): boolean {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'true' || stored === 'false') return stored === 'true'
  } catch {
    // Storage can be unavailable (private mode, blocked site data)
  }
  return fallback
}

/** A boolean UI preference (a collapsed panel and the like), remembered per browser under `key`. */
export function useStoredFlag(key: string, fallback: boolean) {
  const [value, setValue] = useState(() => load(key, fallback))

  const update = (next: boolean) => {
    setValue(next)
    try {
      localStorage.setItem(key, String(next))
    } catch {
      // Not persisted, but still applied for this visit
    }
  }

  return [value, update] as const
}
