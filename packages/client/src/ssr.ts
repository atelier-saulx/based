import { genObserveId } from './genObserveId.js'
import { BasedClient } from './index.js'
import { CacheValue } from './types/cache.js'

export const createCacheObject = (
  client: BasedClient,
): {
  [key: string]: CacheValue
} => {
  const m: any = {}
  client.cache.forEach((v, k) => {
    m[k] = v
  })
  return m
}

export const createCacheScriptTag = (
  client: BasedClient,
  queries?: { endpoint: string; payload?: any }[],
): string => {
  if (queries) {
    const m: any = {}
    for (const q of queries) {
      const key = genObserveId(q.endpoint, q.payload)
      if (client.cache.has(key)) {
        m[key] = client.cache.get(key)
      }
    }
    return `<script>window.__basedcache__=${JSON.stringify(m)}</script>`
  }

  return `<script>window.__basedcache__=${JSON.stringify(
    createCacheObject(client),
  )}</script>`
}
