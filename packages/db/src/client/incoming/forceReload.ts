import { BasedClient } from '../index.js'

export const cacheId = '/-74rxe8kzryxek07e36yr'

// clear based cache (extra byte)
// if to background reconnect needs to know if it handled the bust
// add seqId
// keep seqId in mem for 24h ? :/ ? how long
// add seqId on connect after access key
export const forceReload = (
  client: BasedClient,
  type: number,
  seqId: number,
) => {
  // 0 = all
  // 1 = browser
  // 2 = non-browser

  if (client.lastForceId === seqId) {
    // all good and handled
    return
  }

  client.lastForceId = seqId

  // prob browser...
  if (typeof window !== 'undefined') {
    if (type === 1 || type === 0) {
      // seqId is the bust part
      const r = cacheId + seqId
      let p = location.pathname
      while (p.endsWith('/')) {
        p = p.slice(0, -1)
      }
      location.pathname = p + r
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
