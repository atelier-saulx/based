import { genObserveId } from './genObserveId.js'
import { BasedClient, BasedQuery } from './index.js'
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

export const createCacheObjectFiltered = (
  client: BasedClient,
  queries?: { endpoint: string; payload?: any }[],
): {
  [key: string]: CacheValue
} => {
  const m: any = {}
  for (const q of queries) {
    const key = genObserveId(q.endpoint, q.payload)
    if (client.cache.has(key)) {
      m[key] = client.cache.get(key)
    }
  }
  return m
}

export const createInlineFromCurrentCache = (
  client: BasedClient,
  queries?: { endpoint: string; payload?: any }[],
): string => {
  if (queries) {
    return `<script>window.__basedcache__=${JSON.stringify(createCacheObjectFiltered(client, queries))}</script>`
  }
  return `<script>window.__basedcache__=${JSON.stringify(
    createCacheObject(client),
  )}</script>`
}

export const createInlineCache = async (
  client: BasedClient,
  queries: BasedQuery[],
): Promise<string> => {
  const m = {}
  await Promise.all(
    queries.map(async (query) => {
      await query.get()
      m[query.id] = client.cache.get(query.id)
    }),
  )
  return `<script>window.__basedcache__=${JSON.stringify(m)}</script>`
}
