import { BasedClient } from './index.js'
import { removeStorage } from './persistentStorage/index.js'

export const freeCacheMemory = (client: BasedClient) => {
  client.cache.forEach((v, k) => {
    if (!client.observeState.has(k)) {
      client.cacheSize -= v.s
      client.cache.delete(k)
      removeStorage(client, String(k))
    }
  })
}
