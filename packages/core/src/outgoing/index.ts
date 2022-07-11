import { BasedCoreClient } from '../'
import { GenericObject } from '../types'
import { functionId } from '@based/ids'

const encoder = new TextEncoder() // always utf-8

const ping = new Uint8Array(0)

export const idleTimeout = (client: BasedCoreClient) => {
  const updateTime = 60 * 1e3
  clearTimeout(client.idlePing)
  client.idlePing = setTimeout(() => {
    if (
      client.connection &&
      client.connected &&
      !client.connection.disconnected
    ) {
      console.info(ping)
      client.connection.ws.send(ping)
    }
  }, updateTime)
}

export const drainQueue = (client: BasedCoreClient) => {
  console.log('>hello', client.connected)

  if (
    client.connected &&
    !client.drainInProgress &&
    (client.functionQueue.length || client.observeQueue.length)
  ) {
    client.drainInProgress = true
    client.drainTimeout = setTimeout(() => {
      client.drainInProgress = false
      if (client.functionQueue.length || client.observeQueue.length) {
        const fn = client.functionQueue
        // const ob = client.observeQueue

        client.functionQueue = []
        client.observeQueue = []

        const buff = new Uint8Array()

        // bit types
        // 000 => fn
        // 001 => subNoReply
        // 002 => subReply

        for (const f of fn) {
          // id 3 | name 8
          let len = 3 + 8
          const [id, name, payload] = f

          const n = encoder.encode(functionId(name, client.envId).slice(2))

          // encode length in 1 bytes (1-255 bytes)
          // then there is no max length
          // 3 bytes flag
          // 5e+6
          let p
          if (payload) {
            p = encoder.encode(JSON.stringify(payload))
          }

          len += p.length

          console.info(len, ~~(50000 / 8) + 1)
        }

        // client.connection.ws.send(JSON.stringify(queue))
        idleTimeout(client)
      }
    }, 0)
  }
}

export const stopDrainQueue = (client: BasedCoreClient) => {
  if (client.drainInProgress) {
    clearTimeout(client.drainTimeout)
    client.drainInProgress = false
  }
}

export const addToFunctionQueue = (
  client: BasedCoreClient,
  payload: GenericObject,
  name: string,
  resolve: (response: any) => void,
  reject: (err: Error) => void
) => {
  client.requestId++
  // 3 bytes
  if (client.requestId > 16777215) {
    client.requestId = 0
  }

  const id = client.requestId
  client.functionResponseListeners[id] = [resolve, reject]
  client.functionQueue.push([id, name, payload])

  //   let x = encoder.encode(name)
  //   console.info(x)
  drainQueue(client)
}

// export const addToObserveQueue = (client: BasedCoreClient) => {}
