import { useEffect, useRef, useState } from 'react'

type Settled<T> = { key: string | null; data: T | undefined; error: Error | null }

/**
 * Runs `fetcher` whenever `key` changes and aborts the previous request.
 * Keeps the previous data while the next one is loading, so tables don't flicker.
 */
export function useRequest<T>(key: string, fetcher: (signal: AbortSignal) => Promise<T>) {
  const fetcherRef = useRef(fetcher)
  const [settled, setSettled] = useState<Settled<T>>({ key: null, data: undefined, error: null })

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  useEffect(() => {
    const ctrl = new AbortController()
    fetcherRef.current(ctrl.signal).then(
      (data) => setSettled({ key, data, error: null }),
      (e: unknown) => {
        if (ctrl.signal.aborted) return
        const error = e instanceof Error ? e : new Error(String(e))
        setSettled((s) => ({ key, data: s.data, error }))
      },
    )
    return () => ctrl.abort()
  }, [key])

  return { data: settled.data, error: settled.error, loading: settled.key !== key }
}
