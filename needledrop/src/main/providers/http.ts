import type { ProviderId } from '@shared/types'
import { ProviderError, type JsonFetcher } from './types'

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** At most `max` requests in any rolling `windowMs`. Callers wait their turn instead of failing. */
export class SlidingWindowLimiter {
  private stamps: number[] = []
  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now()
      this.stamps = this.stamps.filter((t) => now - t < this.windowMs)
      if (this.stamps.length < this.max) {
        this.stamps.push(now)
        return
      }
      await sleep((this.stamps[0] as number) + this.windowMs - now + 5)
    }
  }
}

export interface HttpOptions {
  provider: ProviderId
  label: string
  limiter?: SlidingWindowLimiter
  fetchImpl?: typeof fetch
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
}

/** JSON GET with rate limiting, timeout and retry on network errors, 429 and 5xx. */
export function createJsonFetcher(opts: HttpOptions): JsonFetcher {
  const { provider, label, limiter, timeoutMs = 10_000, retries = 2, retryDelayMs = 400 } = opts
  return async (url) => {
    const doFetch = opts.fetchImpl ?? fetch
    let lastError: ProviderError | null = null
    for (let attempt = 0; attempt <= retries; attempt++) {
      if (attempt > 0) await sleep(retryDelayMs * 2 ** (attempt - 1))
      await limiter?.acquire()
      try {
        const res = await doFetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json' } })
        if (res.status === 429) {
          lastError = new ProviderError('rate_limited', `${label} is limiting requests. Wait a few seconds and try again.`, provider)
          continue
        }
        if (res.status >= 500) {
          lastError = new ProviderError('unavailable', `${label} is having problems right now (HTTP ${res.status}).`, provider)
          continue
        }
        if (!res.ok) throw new ProviderError('unknown', `${label} returned HTTP ${res.status}.`, provider)
        return (await res.json()) as unknown
      } catch (err) {
        if (err instanceof ProviderError && err.code === 'unknown') throw err
        lastError = new ProviderError('network', `Can't reach ${label}. Check your internet connection.`, provider)
      }
    }
    throw lastError ?? new ProviderError('unknown', `${label} request failed.`, provider)
  }
}
