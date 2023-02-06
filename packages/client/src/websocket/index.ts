import urlLoader from './urlLoader'
import { Connection } from './types'
import { BasedClient } from '..'
import WebSocket from 'isomorphic-ws'
import { encodeAuthState } from '../authState/parseAuthState'

type ActiveFn = (isActive: boolean) => void

const activityListeners: Map<Connection, ActiveFn> = new Map()

let activeTimer: NodeJS.Timeout

// Disconnect in the browser when a window is inactive (on the background) for 30 seconds
if (typeof window !== 'undefined') {
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
            console.warn('Send to background - close connection')
            isActive = false
            client.onClose()
            ws.close()
          } else if (!isActive && active) {
            activityListeners.delete(connection)
            connect(client, url, connection, 0, true)
          }
        }
      })

      const ws = (connection.ws = new WebSocket(realUrl, [
        encodeAuthState(client.authState),
      ]))

      ws.onerror = () => {
        // console.error()
      }

      ws.onmessage = (d) => {
        client.onData(d)
      }

      ws.onopen = () => {
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
      }

      ws.onclose = () => {
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
            Math.min(2000, Math.min(time + ~~(Math.random() * 500) + 100)),
            true
          )
        }
      }
    }, time)
  })
  return connection
}

export default connect
