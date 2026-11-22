/** In-memory TTL cache that also de-duplicates concurrent loads of the same key. */
export class TtlCache<V> {
  private store = new Map<string, { value: V; expires: number }>()
  private inflight = new Map<string, Promise<V>>()

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 300
  ) {}

  async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
    const hit = this.store.get(key)
    if (hit && hit.expires > Date.now()) return hit.value
    const pending = this.inflight.get(key)
    if (pending) return pending
    const promise = load()
      .then((value) => {
        this.store.set(key, { value, expires: Date.now() + this.ttlMs })
        if (this.store.size > this.maxEntries) {
          const oldest = this.store.keys().next().value
          if (oldest !== undefined) this.store.delete(oldest)
        }
        return value
      })
      .finally(() => this.inflight.delete(key))
    this.inflight.set(key, promise)
    return promise
  }

  clear(): void {
    this.store.clear()
  }
}
