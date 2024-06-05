import { BasedClient } from '../index.js'

export const cacheId = '/-74rxe8kzryxek07e36yr'

export const forceReload = (client: BasedClient, type: number) => {
  // 0 = all
  // 1 = browser
  // 2 = non-browser
  if (typeof window !== 'undefined') {
    // prob browser...
    if (type === 1 || type === 0) {
      window.location.href =
        window.location.href + cacheId + (~~(Math.random() * 1e6)).toString(16)
    }
  } else {
    if (type === 2 || type === 0) {
      client.disconnect()
      setTimeout(() => {
        client.connect()
      }, 100)
    }
  }
}
