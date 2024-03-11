import urlLoader from './urlLoader.js'
import { Connection } from './types.js'
import { BasedClient } from '../index.js'
import { encodeAuthState } from '../authState/parseAuthState.js'
import { isStreaming } from '../stream/index.js'

import WebSocket from 'isomorphic-ws'

type ActiveFn = (isActive: boolean) => void

const activityListeners: Map<Connection, ActiveFn> = new Map()

let activeTimer: NodeJS.Timeout

// Disconnect in the browser when a window is inactive (on the background) for 30 seconds
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', function () {
    clearTimeout(activeTimer)
    if (document.hidden) {
      activeTimer = setTimeout(() => {
        activityListeners.forEach((fn) => {
          fn(false)
        })
      }, 30e3)
    } else {
      activityListeners.forEach((fn) => {
        fn(true)
      })
    }
  })
}

const connect = (
  client: BasedClient,
  url: string | (() => Promise<string>),
  connection: Connection = {
    destroy: () => {
      activityListeners.delete(connection)
    },
  },
  time = 0,
  reconnect = false
): Connection => {
  urlLoader(url, (realUrl) => {
    setTimeout(() => {
      if (connection.disconnected) {
        return
      }

      let isActive = true

      activityListeners.set(connection, (active) => {
        if (!connection.disconnected) {
          if (!active && isActive) {
            if (
              client.functionResponseListeners.size ||
              isStreaming.streaming
            ) {
              console.warn(
                'Send to background - streams or functions in progress try again in 10 seconds...'
              )
              clearTimeout(activeTimer)
              activeTimer = setTimeout(() => {
                activityListeners.forEach((fn) => {
                  fn(false)
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

      const ws = (connection.ws = new WebSocket(realUrl, [
        encodeAuthState(client.authState),
      ]))

      let isError = false

      ws.binaryType = 'blob'
      ws.addEventListener('error', (err) => {
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
            true
          )
        }
      })
    }, time)
  })
  return connection
}

export default connect
