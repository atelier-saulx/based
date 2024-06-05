import { BasedClient } from '../index.js'

export const cacheId = '/-74rxe8kzryxek07e36yr'

// clear based cache (extra byte)
// if to background reconnect needs to know if it handled the bust
// add seqId
// keep seqId in mem for 24h ? :/ ? how long
// add seqId on connect after access key
export const forceReload = (client: BasedClient, type: number) => {
  // 0 = all
  // 1 = browser
  // 2 = non-browser
  if (typeof window !== 'undefined') {
    // prob browser...
    if (type === 1 || type === 0) {
      window.location.href =
        window.location.href + cacheId + ~~(Math.random() * 9999)
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
