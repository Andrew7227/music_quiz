import { useEffect, useState } from 'react'

export interface AsyncData<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/** Runs `load` whenever `deps` change. Passing null clears the result. Stale responses are ignored. */
export function useAsyncData<T>(load: (() => Promise<T>) | null, deps: readonly unknown[]): AsyncData<T> {
  const [state, setState] = useState<AsyncData<T>>({ data: null, loading: false, error: null })

  useEffect(() => {
    if (!load) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let cancelled = false
    setState((s) => ({ data: s.data, loading: true, error: null }))
    load().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      },
      (err: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: err instanceof Error ? err.message : 'Something went wrong.' })
      }
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}

export function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(t)
  }, [value, delayMs])
  return debounced
}
