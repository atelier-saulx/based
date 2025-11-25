import urlLoader from './urlLoader.js'
import { Connection } from './types.js'
import { BasedClient } from '../index.js'
import { encodeAuthState } from '../authState/parseAuthState.js'
import { isStreaming } from '../stream/index.js'
import WebSocket from 'isomorphic-ws'
import { FakeWebsocket } from './FakeWebsocket.js'

type ActiveFn = (isActive: boolean, isOffline: boolean) => void

const activityListeners: Map<Connection, ActiveFn> = new Map()

let activeTimer: NodeJS.Timeout

if (typeof document !== 'undefined') {
  let putToOffline = false
  window.addEventListener('offline', () => {
    activityListeners.forEach((fn) => {
      putToOffline = true
      fn(false, true)
    })
  })

  window.addEventListener('online', () => {
    if (putToOffline) {
      putToOffline = false
      if (!document.hidden) {
        activityListeners.forEach((fn) => {
          fn(true, false)
        })
      }
    }
  })

  // Disconnect in the browser when a window is inactive (on the background) for 30 seconds
  document.addEventListener('visibilitychange', function () {
    clearTimeout(activeTimer)
    if (document.hidden) {
      activeTimer = setTimeout(() => {
        activityListeners.forEach((fn) => {
          fn(false, false)
        })
      }, 30e3)
    } else {
      activityListeners.forEach((fn) => {
        fn(true, false)
      })
    }
  })
}

// remove the logs here
const restPing = (
  ms: number = 1000,
  realUrl: string,
  connection: Connection,
  fallback: (t: string) => void,
) => {
  connection.fallBackTimer = setTimeout(() => {
    if (!connection.disconnected) {
      console.warn(`Cannot connect to ws in ${ms}ms`)
      let d = Date.now()
      connection.fallBackInProgress = true

      const x = realUrl.replace(/^wss?:\/\//, '').split('/')
      const url = `http${realUrl.startsWith('wss') ? 's' : ''}://${x[0]}/based:rpstatus`

      // fix this

      fetch(url).then(async (r) => {
        if (connection.fallBackInProgress) {
          connection.fallBackInProgress = false
          const t = await r.text()
          if (t && t[0] === '1') {
            const timeEllapsed = Date.now() - d
            console.warn(`Took ${timeEllapsed}ms for rest`)
            if (timeEllapsed < ms) {
              console.warn(
                `was able to connect to rpstatus within ${ms}ms need to fallback to rest`,
              )
              fallback(t)
            } else {
              restPing(timeEllapsed + 100, realUrl, connection, fallback)
            }
          }
        } else {
          console.warn('Connected while trying RP - skip')
        }
      })
    }
  }, ms)
}

const connect = (
  client: BasedClient,
  url: string | (() => Promise<string>),
  connection: Connection = {
    destroy: () => {
      clearInterval(connection.keepAliveCloseTimer)
      activityListeners.delete(connection)
    },
  },
  time = 0,
  reconnect = false,
): Connection => {
  urlLoader(url, (realUrl) => {
    setTimeout(() => {
      if (connection.disconnected) {
        return
      }

      let isActive = true

      activityListeners.set(connection, (active, isOffline) => {
        if (!connection.disconnected) {
          if (!active && isOffline) {
            isActive = false
            client.onClose()
            ws.close()
          } else if (!active && isActive) {
            if (
              client.functionResponseListeners.size ||
              isStreaming.streaming
            ) {
              console.warn(
                'Send to background - streams or functions in progress try again in 10 seconds...',
              )
              clearTimeout(activeTimer)
              activeTimer = setTimeout(() => {
                activityListeners.forEach((fn) => {
                  fn(false, false)
                })
              }, 10e3)
            } else {
              console.warn('Send to background - close connection')
              isActive = false
              client.onClose()
              ws.close()
            }
          } else if (!isActive && active) {
            activityListeners.delete(connection)
            connect(client, url, connection, 0, true)
          }
        }
      })

      if (reconnect) {
        client.authState.t = 1
      }
      //@ts-ignore
      const ws = (connection.ws = connection.useFallback
        ? new FakeWebsocket(realUrl, connection.useFallback, client)
        : new WebSocket(realUrl, [encodeAuthState(client.authState)]))

      // pretty shitty
      //@ts-ignore
      ws.binaryType = 'blob'

      let isError = false

      if (!connection.useFallback && client.restFallBack) {
        restPing(300, realUrl, connection, (t) => {
          connection.useFallback = t
          ws.close()
        })
      }

      if (client.opts?.lazy && !connection.keepAliveLastUpdated) {
        // @ts-ignore
        const keepAlive = client.opts?.lazy.keepAlive
        connection.keepAliveCloseTimer = setInterval(
          () => {
            connection.keepAliveLastUpdated! -= keepAlive / 2
            if (
              connection.keepAliveLastUpdated! <= 0 &&
              client.observeState.size === 0
            ) {
              client.disconnect()
              clearInterval(connection.keepAliveCloseTimer)
            }
          },
          // @ts-ignore
          keepAlive / 2, // loop
        )
        connection.keepAliveLastUpdated = keepAlive
      }

      ws.addEventListener('error', (err) => {
        clearTimeout(connection.fallBackTimer)
        // maybe this is a bad idea
        connection.fallBackInProgress = false

        // TODO: add a websocket close number
        // also for rateLimit
        if (err.message && err.message.includes('401')) {
          isError = true
        }
      })

      ws.addEventListener('message', (d) => {
        client.onData(d)
      })

      ws.addEventListener('open', () => {
        clearTimeout(connection.fallBackTimer)
        connection.fallBackInProgress = false
        if (isActive) {
          if (connection.disconnected) {
            return
          }
          time = 100
          if (reconnect) {
            client.onReconnect()
          }
          client.onOpen()
        }
      })

      ws.addEventListener('close', () => {
        clearTimeout(connection.fallBackTimer)
        connection.fallBackInProgress = false
        if (isActive) {
          if (connection.disconnected) {
            return
          }
          client.onClose()
          connect(
            client,
            url,
            connection,
            // relatively low backoff but will make it faster if multiple servers are down
            isError
              ? 5e3
              : Math.min(2500, time + ~~(Math.random() * 500) + 100),
            true,
          )
        }
      })
    }, time)
  })
  return connection
}

export default connect
