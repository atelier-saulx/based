import { BasedClient } from './index.js'
import { CacheValue } from './types/cache.js'

export const createCacheObject = (
  client: BasedClient
): {
  [key: string]: CacheValue
} => {
  const m: any = {}
  client.cache.forEach((v, k) => {
    m[k] = v
  })
  return m
}

export const createCacheScriptTag = (client: BasedClient): string => {
  return `<script>window.__basedcache__=${JSON.stringify(
    createCacheObject(client)
  )}</script>`
}
