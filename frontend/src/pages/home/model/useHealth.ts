import { useEffect, useState } from 'react'
import { getHealth } from '@/shared/api'

export function useHealth() {
  const [status, setStatus] = useState<string>('checking…')

  useEffect(() => {
    const ctrl = new AbortController()
    getHealth(ctrl.signal)
      .then((h) => setStatus(h.status))
      .catch((e: unknown) => {
        if (!ctrl.signal.aborted) setStatus(`error: ${String(e)}`)
      })
    return () => ctrl.abort()
  }, [])

  return status
}
