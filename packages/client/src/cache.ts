import { BasedClient } from './index.js'

export const freeCacheMemory = (client: BasedClient) => {
  client.cache.forEach((v, k) => {
    if (!client.observeState.has(k)) {
      client.cacheSize -= v.s
      client.cache.delete(k)
    }
  })
}

let i = 0
export const cacheClock = () => {
  return ++i
}
